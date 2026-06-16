import { NextRequest, NextResponse } from 'next/server';
import { ADOService } from '@/lib/ado-service';
import { BugDataRequest, BugDataResult, BugDataResponse, Commit, PullRequest } from '@/types';
import { logDebug, logError } from '@/lib/logger';

const runWithConcurrency = async <T, R>(items: T[], limit: number, task: (item: T) => Promise<R>) => {
  const results: R[] = [];
  let index = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const currentIndex = index++;
      results[currentIndex] = await task(items[currentIndex]);
    }
  });

  await Promise.all(workers);
  return results;
};

export async function POST(request: NextRequest) {
  try {
    const body: BugDataRequest = await request.json();
    let { queryUrl, sprintStart, sprintEnd, patToken } = body;

    if (!queryUrl || !patToken) {
      return NextResponse.json(
        { error: 'Missing required fields: queryUrl and patToken are required' },
        { status: 400 }
      );
    }

    const adoService = new ADOService(patToken);

    const { organization, project, queryId } = adoService.parseQueryUrl(queryUrl);

    logDebug('Executing ADO query for consolidated data...');
    const workItems = await adoService.executeQuery(organization, project, queryId);

    if (!sprintStart || !sprintEnd) {
      logDebug('Sprint dates not provided, attempting auto-detection from bug iteration paths...');
      const detectedDates = await adoService.detectSprintDatesFromBugs(organization, project, workItems);

      if (detectedDates) {
        sprintStart = detectedDates.sprintStart;
        sprintEnd = detectedDates.sprintEnd;
        logDebug(`Auto-detected sprint dates: ${sprintStart} to ${sprintEnd}`);
      } else {
        return NextResponse.json(
          {
            error:
              'Could not auto-detect sprint dates and no manual dates provided. ' +
              'Please provide sprintStart and sprintEnd in the request.'
          },
          { status: 400 }
        );
      }
    }

    const closedBugs = workItems.filter((item) => {
      const state = item.fields['System.State']?.toLowerCase() || '';
      return state.includes('closed') || state.includes('done') || state.includes('resolved');
    });

    logDebug(`Found ${closedBugs.length} closed bugs out of ${workItems.length} total work items`);

    const prIdsByBug = new Map<number, number[]>();
    const commitInfoByBug = new Map<number, { repoId: string; commitId: string }[]>();
    const uniquePrIds = new Set<number>();
    const uniqueCommitKeys = new Map<string, { repoId: string; commitId: string }>();

    for (const workItem of closedBugs) {
      const relations = workItem.relations || [];
      const prIds: number[] = [];
      const commitInfos: { repoId: string; commitId: string }[] = [];

      for (const relation of relations) {
        const url = relation.url || '';
        if (!url) continue;

        const prInfo = adoService.extractPRInfoFromUrl(url);
        if (prInfo) {
          prIds.push(prInfo.prId);
          uniquePrIds.add(prInfo.prId);
          continue;
        }

        const commitInfo = adoService.extractCommitInfoFromUrl(url);
        if (commitInfo) {
          commitInfos.push(commitInfo);
          uniqueCommitKeys.set(`${commitInfo.repoId}:${commitInfo.commitId}`, commitInfo);
        }
      }

      if (prIds.length > 0) {
        prIdsByBug.set(workItem.id, prIds);
      }
      if (commitInfos.length > 0) {
        commitInfoByBug.set(workItem.id, commitInfos);
      }
    }

    const prIdList = Array.from(uniquePrIds);
    const prDetailsList = await runWithConcurrency(prIdList, 5, async (prId) => {
      return adoService.getPRDetails(organization, project, prId);
    });

    const prDetailsMap = new Map<number, PullRequest>();
    prDetailsList.forEach((pr, index) => {
      if (pr) {
        prDetailsMap.set(prIdList[index], pr);
      }
    });

    const commitInfoList = Array.from(uniqueCommitKeys.values());
    const commitDetailsList = await runWithConcurrency(commitInfoList, 5, async (info) => {
      return adoService.getCommitDetails(organization, project, info.repoId, info.commitId);
    });

    const commitDetailsMap = new Map<string, Commit>();
    commitDetailsList.forEach((commit, index) => {
      if (commit) {
        const info = commitInfoList[index];
        commitDetailsMap.set(`${info.repoId}:${info.commitId}`, commit);
      }
    });

    const results: BugDataResult[] = [];

    for (const workItem of closedBugs) {
      logDebug(`Processing bug ${workItem.id} for consolidated data...`);

      const fields = workItem.fields;
      const bugData: BugDataResult = {
        id: workItem.id,
        title: fields['System.Title'] || 'Unknown',
        description: fields['System.Description'] || '',
        state: fields['System.State'] || 'Unknown',
        created_date: fields['System.CreatedDate'] || '',
        closed_date: fields['System.ClosedDate'] || '',
        assigned_to: fields['System.AssignedTo']?.displayName || 'Unassigned',
        priority: fields['Microsoft.VSTS.Common.Priority']?.toString() || 'Unknown',
        severity: fields['Microsoft.VSTS.Common.Severity'] || 'Unknown',
        area_path: fields['System.AreaPath'] || 'Unknown',
        pr_count: 0,
        pr_titles: '',
        linked_prs: [],
      };

      const linkedPRs: PullRequest[] = [];

      const prIds = prIdsByBug.get(workItem.id) || [];
      prIds.forEach((prId) => {
        const pr = prDetailsMap.get(prId);
        if (pr) {
          linkedPRs.push(pr);
        }
      });

      const commitInfos = commitInfoByBug.get(workItem.id) || [];
      commitInfos.forEach((info) => {
        const commit = commitDetailsMap.get(`${info.repoId}:${info.commitId}`);
        if (commit) {
          linkedPRs.push({
            id: `commit-${commit.commitId.substring(0, 8)}`,
            title: commit.comment || 'Direct commit',
            description: commit.comment || '',
            createdBy: commit.author,
            creationDate: commit.date,
            closedDate: commit.date,
            status: 'completed',
            commits: [commit],
            changes: [],
          });
        }
      });

      linkedPRs.sort((a, b) => {
        const aDate = new Date(a.creationDate).getTime();
        const bDate = new Date(b.creationDate).getTime();
        return bDate - aDate;
      });

      bugData.linked_prs = linkedPRs;
      bugData.pr_count = linkedPRs.length;
      bugData.pr_titles = linkedPRs.map((pr) => pr.title).join('; ');

      if (linkedPRs.length > 0) {
        const latestPR = linkedPRs[0];
        bugData.issue_type = adoService.detectIssueType(latestPR);

        if (typeof latestPR.id === 'number') {
          const bugOrigin = await adoService.traceBugOrigin(organization, project, latestPR);
          if (bugOrigin) {
            bugData.bug_origin = bugOrigin;
          }
        }
      }

      results.push(bugData);
    }

    const response: BugDataResponse = {
      results,
      sprintStart,
      sprintEnd,
      totalBugs: workItems.length,
      closedBugs: closedBugs.length,
    };

    return NextResponse.json(response);
  } catch (error: any) {
    logError('ADO data error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch consolidated ADO data' },
      { status: 500 }
    );
  }
}
