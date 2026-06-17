/**
 * bug-analyser.ts
 *
 * Core logic for analysing a single closed bug work item.
 * Extracted from the API route so it can be shared between
 * /api/analyze and /api/analyze/reanalyze without triggering
 * Next.js route-export type errors.
 */

import { ADOService } from '@/lib/ado-service';
import { BugClassifier } from '@/lib/bug-classifier';
import { BugAnalysisResult, Commit, PullRequest } from '@/types';
import { appendProgress } from '@/lib/progress-store';
import { getGitSignalsForFiles } from '@/lib/git-context';

export interface AnalyseSingleBugOptions {
  organization: string;
  project: string;
  queryId: string;
  sprintStartDate: Date;
  sprintEndDate: Date;
  adoService: ADOService;
  classifier: BugClassifier;
  githubToken?: string;
  progressId?: string;
  prDetailsMap: Map<number, PullRequest>;
  commitDetailsMap: Map<string, Commit>;
  prIdsByBug: Map<number, number[]>;
  commitInfoByBug: Map<number, { repoId: string; commitId: string }[]>;
}

/** Analyse a single closed bug work item and return a BugAnalysisResult. */
export async function analyseSingleBug(
  workItem: any,
  {
    organization,
    project,
    queryId,
    sprintStartDate,
    sprintEndDate,
    adoService,
    classifier,
    githubToken,
    progressId,
    prDetailsMap,
    commitDetailsMap,
    prIdsByBug,
    commitInfoByBug,
  }: AnalyseSingleBugOptions
): Promise<BugAnalysisResult> {
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
    if (pr) linkedPRs.push(pr);
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

  linkedPRs.sort((a, b) => new Date(b.creationDate).getTime() - new Date(a.creationDate).getTime());
  bugData.linked_prs = linkedPRs;

  let gitSignals;
  const repoName = linkedPRs.find((pr) => pr.repositoryName)?.repositoryName;
  const filePaths = linkedPRs.flatMap((pr) => pr.changes?.map((change) => change.item) || []);
  const prCutoff = linkedPRs[0]?.creationDate ? new Date(linkedPRs[0].creationDate) : undefined;

  if (progressId) appendProgress(progressId, `Analyzing git history for bug ${workItem.id}`);

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
    }
  } else if (progressId) {
    appendProgress(progressId, 'No repository name found for git analysis; skipping');
  }

  if (progressId) appendProgress(progressId, `Running classification for bug ${workItem.id}`);

  const classification = await classifier.classify(
    bugData,
    sprintStartDate,
    sprintEndDate,
    progressId ? (message: string) => appendProgress(progressId, `Bug ${workItem.id}: ${message}`) : undefined,
    gitSignals,
    githubToken
  );

  // Determine analysis method from the classifier's lastUsedCopilot flag,
  // which is set to true only when the Copilot API call actually succeeded.
  const analysisMethod = classifier.lastUsedCopilot ? 'copilot' : 'rule-based';

  let issueType = undefined;
  let bugOrigin = undefined;
  if (linkedPRs.length > 0) {
    if (progressId) appendProgress(progressId, `Analyzing PRs for bug ${workItem.id}`);
    const latestPR = linkedPRs[0];
    issueType = adoService.detectIssueType(latestPR);

    if (progressId) appendProgress(progressId, `Tracing origin for bug ${workItem.id}`);
    bugOrigin = await adoService.traceBugOrigin(organization, project, latestPR);
  }

  return {
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
    analysisMethod,
    analyzedAt: new Date().toISOString(),
  } as BugAnalysisResult;
}
