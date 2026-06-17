import { NextRequest, NextResponse } from 'next/server';
import { ADOService } from '@/lib/ado-service';
import { BugClassifier } from '@/lib/bug-classifier';
import { BugAnalysisRequest, BugAnalysisResult, Commit, PullRequest } from '@/types';
import { logDebug, logError } from '@/lib/logger';
import { appendProgress, initProgress, markProgressDone } from '@/lib/progress-store';
import { loadCache, saveCache } from '@/lib/bug-analysis-cache';
import { analyseSingleBug } from '@/lib/bug-analyser';

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

    if (!queryUrl || !patToken) {
      return NextResponse.json(
        { error: 'Missing required fields: queryUrl and patToken are required' },
        { status: 400 }
      );
    }

    const githubToken = request.headers.get('x-github-pat') || undefined;
    const adoService = new ADOService(patToken);
    const classifier = new BugClassifier(useCopilot || false);

    const { organization, project, queryId } = adoService.parseQueryUrl(queryUrl);

    // Load persisted cache for this query
    const cache = loadCache(queryId);
    if (progressId && cache.size > 0) {
      appendProgress(progressId, `Found ${cache.size} previously analysed bug(s) in cache`);
    }

    logDebug('Executing ADO query...');
    if (progressId) appendProgress(progressId, 'Fetching work items from Azure DevOps');
    const workItems = await adoService.executeQuery(organization, project, queryId);

    if (!sprintStart || !sprintEnd) {
      logDebug('Sprint dates not provided, attempting auto-detection...');
      if (progressId) appendProgress(progressId, 'Auto-detecting sprint dates');
      const detectedDates = await adoService.detectSprintDatesFromBugs(organization, project, workItems);

      if (detectedDates) {
        sprintStart = detectedDates.sprintStart;
        sprintEnd = detectedDates.sprintEnd;
        if (progressId) appendProgress(progressId, `Sprint dates detected: ${sprintStart} to ${sprintEnd}`);
      } else {
        if (progressId) { appendProgress(progressId, 'Sprint date detection failed'); markProgressDone(progressId); }
        return NextResponse.json(
          { error: 'Could not auto-detect sprint dates and no manual dates provided. Please provide sprintStart and sprintEnd.' },
          { status: 400 }
        );
      }
    }

    const sprintStartDate = new Date(sprintStart);
    const sprintEndDate = new Date(sprintEnd);

    const closedBugs = workItems.filter((item) => {
      const state = item.fields['System.State']?.toLowerCase() || '';
      return state.includes('closed') || state.includes('done') || state.includes('resolved');
    });

    logDebug(`Found ${closedBugs.length} closed bugs out of ${workItems.length} total work items`);

    // Split into cached vs new.
    // When copilot is enabled, also re-analyse any cached bugs that were previously
    // classified with rule-based (or have no analysisMethod recorded) so they get
    // upgraded to a Copilot-powered result.
    const cachedResults: BugAnalysisResult[] = [];
    const bugsToAnalyse = closedBugs.filter((item) => {
      if (cache.has(item.id)) {
        const cached = cache.get(item.id)!;
        // Re-analyse if copilot is now enabled but the cached result used rule-based
        const needsUpgrade = useCopilot && cached.analysisMethod !== 'copilot';
        if (!needsUpgrade) {
          cachedResults.push({ ...cached, fromCache: true });
          return false;
        }
        // Fall through: this bug will be re-analysed with Copilot
        if (progressId) appendProgress(progressId, `Bug ${item.id} was cached as rule-based; re-analysing with Copilot`);
      }
      return true;
    });

    const reanalysedCount = bugsToAnalyse.filter((item) => cache.has(item.id)).length;

    if (progressId) {
      appendProgress(progressId, `${cachedResults.length} bug(s) loaded from cache, ${bugsToAnalyse.length} bug(s) to analyse${reanalysedCount > 0 ? ` (${reanalysedCount} re-analysed with Copilot)` : ''}`);
      if (bugsToAnalyse.length > 0) appendProgress(progressId, 'Collecting linked PRs and commits');
    }

    // ── Collect PRs / commits only for bugs that need analysis ──────────────
    const prIdsByBug = new Map<number, number[]>();
    const commitInfoByBug = new Map<number, { repoId: string; commitId: string }[]>();
    const uniquePrIds = new Set<number>();
    const uniqueCommitKeys = new Map<string, { repoId: string; commitId: string }>();

    for (const workItem of bugsToAnalyse) {
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
    }

    const prIdList = Array.from(uniquePrIds);
    if (progressId && prIdList.length > 0) appendProgress(progressId, `Fetching ${prIdList.length} unique PRs`);
    const prDetailsList = await runWithConcurrency(prIdList, 5, (prId) => adoService.getPRDetails(organization, project, prId));
    const prDetailsMap = new Map<number, PullRequest>();
    prDetailsList.forEach((pr, i) => { if (pr) prDetailsMap.set(prIdList[i], pr); });

    const commitInfoList = Array.from(uniqueCommitKeys.values());
    if (progressId && commitInfoList.length > 0) appendProgress(progressId, `Fetching ${commitInfoList.length} unique commits`);
    const commitDetailsList = await runWithConcurrency(commitInfoList, 5, (info) => adoService.getCommitDetails(organization, project, info.repoId, info.commitId));
    const commitDetailsMap = new Map<string, Commit>();
    commitDetailsList.forEach((commit, i) => { if (commit) { const info = commitInfoList[i]; commitDetailsMap.set(`${info.repoId}:${info.commitId}`, commit); } });

    // ── Analyse new bugs ─────────────────────────────────────────────────────
    const newResults: BugAnalysisResult[] = [];
    for (const workItem of bugsToAnalyse) {
      if (progressId) appendProgress(progressId, `Processing bug ${workItem.id}`);
      const result = await analyseSingleBug(workItem, {
        organization, project, queryId,
        sprintStartDate, sprintEndDate,
        adoService, classifier, githubToken, progressId,
        prDetailsMap, commitDetailsMap, prIdsByBug, commitInfoByBug,
      });
      newResults.push(result);
    }

    // Persist newly analysed results
    if (newResults.length > 0) {
      saveCache(queryId, newResults);
    }

    // Merge: cached first (marked), then new
    const results = [...cachedResults, ...newResults];

    if (progressId) { appendProgress(progressId, 'Analysis complete'); markProgressDone(progressId); }

    return NextResponse.json({
      results,
      sprintStart,
      sprintEnd,
      totalBugs: workItems.length,
      closedBugs: closedBugs.length,
      cachedCount: cachedResults.length,
      newCount: newResults.length,
    });
  } catch (error: any) {
    logError('Analysis error:', error);
    if (progressId) { appendProgress(progressId, 'Analysis failed'); markProgressDone(progressId); }
    return NextResponse.json({ error: error.message || 'Analysis failed' }, { status: 500 });
  }
}
