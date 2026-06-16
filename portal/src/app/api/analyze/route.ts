import { NextRequest, NextResponse } from 'next/server';
import { ADOService } from '@/lib/ado-service';
import { BugClassifier } from '@/lib/bug-classifier';
import { BugAnalysisRequest, BugAnalysisResult, Commit, PullRequest } from '@/types';
import { logDebug, logError } from '@/lib/logger';
import { appendProgress, initProgress, markProgressDone } from '@/lib/progress-store';
import { getGitSignalsForFiles } from '@/lib/git-context';

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
  let progressId: string | undefined;
  try {
    const body: BugAnalysisRequest = await request.json();
    let { queryUrl, sprintStart, sprintEnd, patToken, useCopilot, requestId } = body;
    progressId = requestId?.trim();

    if (progressId) {
      initProgress(progressId);
      appendProgress(progressId, 'Starting analysis');
    }

    // Validate required fields
    if (!queryUrl || !patToken) {
      return NextResponse.json(
        { error: 'Missing required fields: queryUrl and patToken are required' },
        { status: 400 }
      );
    }

    // Initialize services
    const githubToken = request.headers.get('x-github-pat') || undefined;
    const adoService = new ADOService(patToken);
    const classifier = new BugClassifier(useCopilot || false);

    // Parse query URL
    const { organization, project, queryId } = adoService.parseQueryUrl(queryUrl);

    // Execute query to get work items
    logDebug('Executing ADO query...');
    if (progressId) {
      appendProgress(progressId, 'Fetching work items from Azure DevOps');
    }
    const workItems = await adoService.executeQuery(organization, project, queryId);

    // Auto-detect sprint dates if not provided
    if (!sprintStart || !sprintEnd) {
      logDebug('Sprint dates not provided, attempting auto-detection from bug iteration paths...');
      if (progressId) {
        appendProgress(progressId, 'Auto-detecting sprint dates');
      }
      const detectedDates = await adoService.detectSprintDatesFromBugs(organization, project, workItems);

      if (detectedDates) {
        sprintStart = detectedDates.sprintStart;
        sprintEnd = detectedDates.sprintEnd;
        logDebug(`Auto-detected sprint dates: ${sprintStart} to ${sprintEnd}`);
        if (progressId) {
          appendProgress(progressId, `Sprint dates detected: ${sprintStart} to ${sprintEnd}`);
        }
      } else {
        if (progressId) {
          appendProgress(progressId, 'Sprint date detection failed');
          markProgressDone(progressId);
        }
        return NextResponse.json(
          {
            error: 'Could not auto-detect sprint dates and no manual dates provided. ' +
                   'Please provide sprintStart and sprintEnd in the request.'
          },
          { status: 400 }
        );
      }
    }

    // Parse dates
    const sprintStartDate = new Date(sprintStart);
    const sprintEndDate = new Date(sprintEnd);

    // Filter for closed bugs only
    const closedBugs = workItems.filter((item) => {
      const state = item.fields['System.State']?.toLowerCase() || '';
      return state.includes('closed') || state.includes('done') || state.includes('resolved');
    });

    logDebug(`Found ${closedBugs.length} closed bugs out of ${workItems.length} total work items`);
    if (progressId) {
      appendProgress(progressId, `Found ${closedBugs.length} closed bugs to analyze`);
      appendProgress(progressId, 'Collecting linked PRs and commits');
    }

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
    if (progressId && prIdList.length > 0) {
      appendProgress(progressId, `Fetching ${prIdList.length} unique PRs`);
    }
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
    if (progressId && commitInfoList.length > 0) {
      appendProgress(progressId, `Fetching ${commitInfoList.length} unique commits`);
    }
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

    // Analyze each bug
    const results: BugAnalysisResult[] = [];

    for (const workItem of closedBugs) {
      logDebug(`Processing bug ${workItem.id}...`);
      if (progressId) {
        appendProgress(progressId, `Processing bug ${workItem.id}`);
      }

      const fields = workItem.fields;
      const bugData: Partial<BugAnalysisResult> = {
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

      let gitSignals;
      const repoName = linkedPRs.find((pr) => pr.repositoryName)?.repositoryName;
      const filePaths = linkedPRs.flatMap((pr) => pr.changes?.map((change) => change.item) || []);
      const prCutoff = linkedPRs[0]?.creationDate ? new Date(linkedPRs[0].creationDate) : undefined;
      if (progressId) {
        appendProgress(progressId, `Analyzing git history for bug ${workItem.id}`);
      }
      if (repoName) {
        gitSignals = await getGitSignalsForFiles(repoName, filePaths, sprintStartDate, 90, prCutoff);
        if (progressId) {
          appendProgress(
            progressId,
            `Git signals: ${gitSignals.recentFiles}/${gitSignals.totalFiles} files changed before PR${gitSignals.newFiles > 0 ? `, ${gitSignals.newFiles} new file(s)` : ''}`
          );
          appendProgress(
            progressId,
            gitSignals.notes
              ? `Git repo: ${repoName} (${gitSignals.notes})`
              : `Git repo: ${repoName} (found locally)`
          );
          appendProgress(progressId, `Git files checked: ${gitSignals.totalFiles}/${filePaths.length}`);
        }
      } else if (progressId) {
        appendProgress(progressId, 'No repository name found for git analysis; skipping');
      }

      // Classify the bug
      if (progressId) {
        appendProgress(progressId, `Running classification for bug ${workItem.id}`);
      }
      const progressKey = progressId;
      const classification = await classifier.classify(
        bugData,
        sprintStartDate,
        sprintEndDate,
        progressKey
          ? (message) => appendProgress(progressKey, `Bug ${workItem.id}: ${message}`)
          : undefined,
        gitSignals,
        githubToken
      );

      // Detect issue type and trace bug origin from PRs
      let issueType = undefined;
      let bugOrigin = undefined;
      if (linkedPRs.length > 0) {
        if (progressId) {
          appendProgress(progressId, `Analyzing PRs for bug ${workItem.id}`);
        }
        const latestPR = linkedPRs[0];
        issueType = adoService.detectIssueType(latestPR);

        if (progressId) {
          appendProgress(progressId, `Tracing origin for bug ${workItem.id}`);
        }
        bugOrigin = await adoService.traceBugOrigin(organization, project, latestPR);
      }

      // Combine all data
      const result: BugAnalysisResult = {
        ...bugData,
        classification: classification.classification as any,
        confidence: classification.confidence as any,
        reasoning: classification.reasoning,
        pr_count: linkedPRs.length,
        pr_titles: linkedPRs.map((pr) => pr.title).join('; '),
        linked_prs: linkedPRs,
        issue_type: issueType,
        bug_origin: bugOrigin || undefined,
        git_signals: gitSignals,
      } as BugAnalysisResult;

      results.push(result);
    }

    if (progressId) {
      appendProgress(progressId, 'Analysis complete');
      markProgressDone(progressId);
    }

    return NextResponse.json({
      results,
      sprintStart,
      sprintEnd,
      totalBugs: workItems.length,
      closedBugs: closedBugs.length,
    });
  } catch (error: any) {
    logError('Analysis error:', error);
    if (progressId) {
      appendProgress(progressId, 'Analysis failed');
      markProgressDone(progressId);
    }
    return NextResponse.json(
      { error: error.message || 'Analysis failed' },
      { status: 500 }
    );
  }
}
