import { NextRequest, NextResponse } from 'next/server';
import { ADOService } from '@/lib/ado-service';
import { BugClassifier } from '@/lib/bug-classifier';
import { BugAnalysisResult, Commit, PullRequest } from '@/types';
import { logError } from '@/lib/logger';
import { saveSingleResult } from '@/lib/bug-analysis-cache';
import { analyseSingleBug } from '@/lib/bug-analyser';

/**
 * POST /api/analyze/reanalyze
 * Body: { queryUrl, patToken, bugId, sprintStart, sprintEnd, useCopilot? }
 *
 * Re-fetches the work item from ADO, runs a fresh analysis, updates the cache,
 * and returns the updated BugAnalysisResult.
 */
export async function POST(request: NextRequest) {
  try {
    const { queryUrl, patToken, bugId, sprintStart, sprintEnd, useCopilot } = await request.json();

    if (!queryUrl || !patToken || !bugId) {
      return NextResponse.json(
        { error: 'queryUrl, patToken and bugId are required' },
        { status: 400 }
      );
    }

    const githubToken = request.headers.get('x-github-pat') || undefined;
    const adoService = new ADOService(patToken);
    const classifier = new BugClassifier(useCopilot || false);

    const { organization, project, queryId } = adoService.parseQueryUrl(queryUrl);

    // Fetch just this one work item
    const workItems = await adoService.getWorkItemDetails(organization, project, [Number(bugId)]);
    if (!workItems || workItems.length === 0) {
      return NextResponse.json({ error: `Work item ${bugId} not found` }, { status: 404 });
    }
    const workItem = workItems[0];

    // Resolve sprint dates
    let resolvedStart = sprintStart;
    let resolvedEnd = sprintEnd;
    if (!resolvedStart || !resolvedEnd) {
      const detected = await adoService.detectSprintDatesFromBugs(organization, project, workItems);
      if (detected) {
        resolvedStart = detected.sprintStart;
        resolvedEnd = detected.sprintEnd;
      } else {
        return NextResponse.json(
          { error: 'Could not determine sprint dates. Please provide sprintStart and sprintEnd.' },
          { status: 400 }
        );
      }
    }

    const sprintStartDate = new Date(resolvedStart);
    const sprintEndDate = new Date(resolvedEnd);

    // Collect PRs and commits for this single bug
    const prIdsByBug = new Map<number, number[]>();
    const commitInfoByBug = new Map<number, { repoId: string; commitId: string }[]>();
    const uniquePrIds = new Set<number>();
    const uniqueCommitKeys = new Map<string, { repoId: string; commitId: string }>();

    const relations = workItem.relations || [];
    const prIds: number[] = [];
    const commitInfos: { repoId: string; commitId: string }[] = [];

    for (const relation of relations) {
      const url = relation.url || '';
      if (!url) continue;
      const prInfo = adoService.extractPRInfoFromUrl(url);
      if (prInfo) { prIds.push(prInfo.prId); uniquePrIds.add(prInfo.prId); continue; }
      const commitInfo = adoService.extractCommitInfoFromUrl(url);
      if (commitInfo) { commitInfos.push(commitInfo); uniqueCommitKeys.set(`${commitInfo.repoId}:${commitInfo.commitId}`, commitInfo); }
    }

    if (prIds.length > 0) prIdsByBug.set(workItem.id, prIds);
    if (commitInfos.length > 0) commitInfoByBug.set(workItem.id, commitInfos);

    const prIdList = Array.from(uniquePrIds);
    const prDetailsList = await Promise.all(prIdList.map((id) => adoService.getPRDetails(organization, project, id)));
    const prDetailsMap = new Map<number, PullRequest>();
    prDetailsList.forEach((pr, i) => { if (pr) prDetailsMap.set(prIdList[i], pr); });

    const commitInfoList = Array.from(uniqueCommitKeys.values());
    const commitDetailsList = await Promise.all(
      commitInfoList.map((info) => adoService.getCommitDetails(organization, project, info.repoId, info.commitId))
    );
    const commitDetailsMap = new Map<string, Commit>();
    commitDetailsList.forEach((commit, i) => {
      if (commit) {
        const info = commitInfoList[i];
        commitDetailsMap.set(`${info.repoId}:${info.commitId}`, commit);
      }
    });

    // Run fresh analysis
    const result = await analyseSingleBug(workItem, {
      organization, project, queryId,
      sprintStartDate, sprintEndDate,
      adoService, classifier, githubToken,
      prDetailsMap, commitDetailsMap, prIdsByBug, commitInfoByBug,
    });

    // Persist updated result
    saveSingleResult(queryId, result);

    return NextResponse.json({ result });
  } catch (error: any) {
    logError('Re-analysis error:', error);
    return NextResponse.json({ error: error.message || 'Re-analysis failed' }, { status: 500 });
  }
}
