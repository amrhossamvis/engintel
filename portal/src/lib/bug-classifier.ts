import { BugAnalysisResult } from '@/types';
import { runCopilotPrompt } from '@/lib/copilot-api';
import { logWarn } from '@/lib/logger';

export class BugClassifier {
  private useCopilot: boolean;
  /** Set to true after a successful Copilot API call, false otherwise. */
  public lastUsedCopilot: boolean = false;

  constructor(useCopilot: boolean = false) {
    this.useCopilot = useCopilot;
  }

  parseDateTimeSafe(dateString: string): Date | null {
    if (!dateString) return null;
    try {
      return new Date(dateString);
    } catch {
      return null;
    }
  }

  classifyBugRuleBased(
    bugData: Partial<BugAnalysisResult>,
    sprintStart: Date,
    sprintEnd: Date,
    gitSignals?: {
      recentFiles: number;
      recentCommits: number;
      totalFiles: number;
      newFiles: number;
      latestChange?: string;
      notes?: string;
    }
  ): { classification: string; confidence: string; reasoning: string } {
    if (gitSignals && gitSignals.totalFiles > 0) {
      const recentPercentage = (gitSignals.recentFiles / gitSignals.totalFiles) * 100;

      // Strong signal: newly created files (didn't exist before recent window)
      if (gitSignals.newFiles > 0) {
        return {
          classification: 'PROGRESSION',
          confidence: gitSignals.newFiles >= 2 ? 'HIGH' : 'MEDIUM',
          reasoning:
            `${gitSignals.newFiles} new file(s) recently created among ${gitSignals.totalFiles} related files — strong indication of new feature/code` +
            (gitSignals.latestChange ? ` (latest: ${gitSignals.latestChange})` : ''),
        };
      }

      // Require meaningful threshold: at least 30% of files OR 3+ files changed
      if (recentPercentage >= 30 || gitSignals.recentFiles >= 3) {
        const confidence =
          recentPercentage >= 50 ? 'HIGH' : recentPercentage >= 30 ? 'MEDIUM' : 'LOW';
        return {
          classification: 'PROGRESSION',
          confidence,
          reasoning:
            `Significant recent activity in ${gitSignals.recentFiles}/${gitSignals.totalFiles} files (${recentPercentage.toFixed(0)}%) before the fix PR` +
            (gitSignals.latestChange ? ` (latest: ${gitSignals.latestChange})` : ''),
        };
      }

      // Low activity: only 1-2 files changed in a larger set
      if (gitSignals.recentFiles > 0 && gitSignals.totalFiles >= 5) {
        return {
          classification: 'REGRESSION',
          confidence: 'MEDIUM',
          reasoning: `Minor recent activity (${gitSignals.recentFiles}/${gitSignals.totalFiles} files, ${recentPercentage.toFixed(0)}%) — likely touching existing bug in old code`,
        };
      }

      return {
        classification: 'REGRESSION',
        confidence: 'MEDIUM',
        reasoning: `No significant recent git activity detected in related files (${gitSignals.recentFiles}/${gitSignals.totalFiles}); likely long-standing issue`,
      };
    }

    const bugCreatedDate = bugData.created_date || '';
    const linkedPRs = bugData.linked_prs || [];
    const bugCreated = this.parseDateTimeSafe(bugCreatedDate);

    const recentChanges: any[] = [];
    const oldChanges: any[] = [];

    for (const pr of linkedPRs) {
      const prCreated = this.parseDateTimeSafe(pr.creationDate);
      if (prCreated) {
        const daysBeforeSprint = Math.floor(
          (sprintStart.getTime() - prCreated.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (prCreated >= sprintStart || daysBeforeSprint <= 14) {
          recentChanges.push({
            type: 'PR',
            date: prCreated,
            title: pr.title,
            daysBeforeSprint: prCreated < sprintStart ? daysBeforeSprint : 0,
          });
        } else {
          oldChanges.push({ type: 'PR', date: prCreated, title: pr.title, daysBeforeSprint });
        }

        for (const commit of pr.commits) {
          const commitDt = this.parseDateTimeSafe(commit.date);
          if (commitDt) {
            const commitDaysBefore = Math.floor(
              (sprintStart.getTime() - commitDt.getTime()) / (1000 * 60 * 60 * 24)
            );
            if (commitDt >= sprintStart || commitDaysBefore <= 14) {
              recentChanges.push({
                type: 'Commit',
                date: commitDt,
                title: commit.comment,
                daysBeforeSprint: commitDt < sprintStart ? commitDaysBefore : 0,
              });
            } else {
              oldChanges.push({
                type: 'Commit',
                date: commitDt,
                title: commit.comment,
                daysBeforeSprint: commitDaysBefore,
              });
            }
          }
        }
      }
    }

    let classification = 'UNCLEAR';
    let confidence = 'LOW';
    let reasoning = 'No linked PRs or commits found';

    if (recentChanges.length > 0) {
      recentChanges.sort((a, b) => b.date.getTime() - a.date.getTime());
      const bugFixKeywords = ['fix', 'bug', 'issue', 'error', 'crash', 'problem', 'defect', 'patch'];
      const recentBugFixes = recentChanges.filter((change) =>
        bugFixKeywords.some((keyword) => change.title.toLowerCase().includes(keyword))
      );

      if (recentBugFixes.length > 0) {
        classification = 'REGRESSION';
        confidence = 'MEDIUM';
        reasoning = `Found ${recentBugFixes.length} recent bug-fix related changes, suggesting this is a long-standing issue`;
      } else {
        const mostRecent = recentChanges[0];
        const daysDiff = mostRecent.daysBeforeSprint;
        if (daysDiff <= 7) {
          classification = 'PROGRESSION';
          confidence = 'HIGH';
          reasoning = `Recent code changes within ${daysDiff} days of sprint start. Most recent: ${mostRecent.title.substring(0, 100)}`;
        } else if (daysDiff <= 14) {
          classification = 'PROGRESSION';
          confidence = 'MEDIUM';
          reasoning = `Code changes ${daysDiff} days before sprint start. Most recent: ${mostRecent.title.substring(0, 100)}`;
        } else {
          classification = 'PROGRESSION';
          confidence = 'LOW';
          reasoning = `Code changes during sprint. Most recent: ${mostRecent.title.substring(0, 100)}`;
        }
      }
    } else if (oldChanges.length > 0) {
      classification = 'REGRESSION';
      confidence = 'MEDIUM';
      const oldestChange = oldChanges.reduce((prev, curr) =>
        prev.date < curr.date ? prev : curr
      );
      reasoning = `Only old code changes found (oldest: ${oldestChange.daysBeforeSprint} days before sprint)`;
    } else if (bugCreated && bugCreated >= sprintStart) {
      classification = 'REGRESSION';
      confidence = 'LOW';
      reasoning = 'Bug reported during sprint but no linked code changes found — likely existing issue';
    }

    return { classification, confidence, reasoning };
  }

  async classifyBugWithCopilot(
    bugData: Partial<BugAnalysisResult>,
    sprintStart: Date,
    sprintEnd: Date,
    onProgress?: (message: string) => void,
    gitSignals?: {
      recentFiles: number;
      recentCommits: number;
      totalFiles: number;
      newFiles: number;
      latestChange?: string;
      notes?: string;
    },
    githubToken?: string
  ): Promise<{ classification: string; confidence: string; reasoning: string }> {
    if (!this.useCopilot) {
      onProgress?.('Copilot disabled; using rule-based classification');
      return this.classifyBugRuleBased(bugData, sprintStart, sprintEnd, gitSignals);
    }

    const bugTitle = bugData.title || 'Unknown';
    const bugDescription = (bugData.description || 'No description provided')
      // Strip HTML tags from ADO descriptions
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim()
      .substring(0, 800);

    const bugCreatedDate = bugData.created_date
      ? new Date(bugData.created_date).toISOString().split('T')[0]
      : 'Unknown';

    const linkedPRs = bugData.linked_prs || [];

    // Build rich PR + commit context
    let prContext = '';
    for (const pr of linkedPRs) {
      const prDate = pr.creationDate
        ? new Date(pr.creationDate).toISOString().split('T')[0]
        : 'Unknown';
      const prTitle = pr.title || 'Unknown';
      const prDesc = (pr.description || '')
        .replace(/<[^>]+>/g, ' ')
        .trim()
        .substring(0, 200);
      prContext += `\nPR: "${prTitle}" (${prDate})`;
      if (prDesc) prContext += `\n  Description: ${prDesc}`;

      const changedFiles = pr.changes?.map((c) => c.item || c.sourceServerItem).filter(Boolean) || [];
      if (changedFiles.length > 0) {
        prContext += `\n  Changed files (${changedFiles.length}): ${changedFiles.slice(0, 10).join(', ')}${changedFiles.length > 10 ? ` ... +${changedFiles.length - 10} more` : ''}`;
      }

      for (const commit of pr.commits.slice(0, 5)) {
        const commitDate = commit.date
          ? new Date(commit.date).toISOString().split('T')[0]
          : 'Unknown';
        prContext += `\n  Commit (${commitDate}): "${commit.comment || 'No message'}" by ${commit.author || 'Unknown'}`;
      }
    }

    // Git signals context
    let gitContext = '';
    if (gitSignals) {
      gitContext = `
Git Activity (in files touched by the fix, 90 days before the PR):
- Total related files: ${gitSignals.totalFiles}
- Files changed recently (within sprint window): ${gitSignals.recentFiles}
- Newly created files (didn't exist before): ${gitSignals.newFiles}
- Recent commits in related files: ${gitSignals.recentCommits}${gitSignals.latestChange ? `\n- Latest change: ${gitSignals.latestChange}` : ''}${gitSignals.notes ? `\n- Notes: ${gitSignals.notes}` : ''}`;
    }

    const sprintStartStr = sprintStart.toISOString().split('T')[0];
    const sprintEndStr = sprintEnd.toISOString().split('T')[0];

    // Rich prompt that leverages Copilot's semantic understanding
    const prompt = `You are a senior software engineer performing root cause analysis on a bug found during a sprint.

Your task: Classify this bug as either PROGRESSION or REGRESSION.

Definitions:
- PROGRESSION: The bug was introduced by NEW code written during or shortly before this sprint. The affected area is new functionality, a new feature, or recently refactored code. The bug would not have existed before this sprint's changes.
- REGRESSION: The bug existed in OLD, pre-existing code. It was either always there (latent defect) or was broken by an unrelated change. The affected area is established, stable code that was working before.

Sprint: ${sprintStartStr} to ${sprintEndStr}
Bug reported: ${bugCreatedDate}

Bug Title: ${bugTitle}
Bug Description: ${bugDescription}

Linked Pull Requests and Commits:
${prContext || 'No linked PRs or commits found'}
${gitContext}

Instructions:
1. Read the bug title and description to understand WHAT broke.
2. Read the PR titles, commit messages, and changed files to understand WHAT CODE changed.
3. Determine if the changed code is NEW (new feature/new area) → PROGRESSION, or OLD (existing functionality) → REGRESSION.
4. Consider: if the PR title/commits mention adding a new feature, new endpoint, new configuration, or new integration → likely PROGRESSION.
5. Consider: if the PR title/commits mention fixing, refactoring, or updating existing functionality → likely REGRESSION.
6. Use git signals: many new files = new feature = PROGRESSION; all old files = existing code = REGRESSION.
7. Provide a specific, insightful reasoning that references the actual bug content and code changes — NOT just dates.

Respond with ONLY this JSON (no markdown, no extra text):
{"classification":"PROGRESSION or REGRESSION","confidence":"HIGH or MEDIUM or LOW","reasoning":"2-3 sentences referencing the specific bug and code changes"}`;

    try {
      onProgress?.('Calling GitHub Copilot API for semantic classification');
      console.log(`[BugClassifier] Calling Copilot API for bug ${bugData.id} — "${bugTitle}"`);

      const resultText = await runCopilotPrompt(prompt, githubToken);

      console.log(`[BugClassifier] Copilot raw response for bug ${bugData.id}:`, resultText.substring(0, 300));
      onProgress?.('Copilot response received; parsing JSON');

      const tryParseJson = (text: string) => {
        const normalized = text.replace(/\n\s+/g, ' ');
        const fenced = normalized.match(/```(?:json)?([\s\S]*?)```/i);
        const candidate = fenced ? fenced[1] : normalized;
        const jsonStart = candidate.indexOf('{');
        const jsonEnd = candidate.lastIndexOf('}') + 1;
        if (jsonStart >= 0 && jsonEnd > jsonStart) {
          return JSON.parse(candidate.substring(jsonStart, jsonEnd));
        }
        return null;
      };

      let parsedResult: any = null;
      try {
        parsedResult = tryParseJson(resultText);
      } catch {
        parsedResult = null;
      }

      if (parsedResult?.classification && parsedResult?.confidence && parsedResult?.reasoning) {
        let classification = String(parsedResult.classification).toUpperCase();
        if (!['PROGRESSION', 'REGRESSION', 'UNCLEAR'].includes(classification)) {
          classification = 'UNCLEAR';
        }
        let confidence = String(parsedResult.confidence).toUpperCase();
        if (!['HIGH', 'MEDIUM', 'LOW'].includes(confidence)) {
          confidence = 'LOW';
        }

        console.log(`[BugClassifier] Copilot classified bug ${bugData.id} as ${classification} (${confidence})`);
        onProgress?.(`Copilot classified as ${classification} (${confidence})`);
        this.lastUsedCopilot = true;
        return {
          classification,
          confidence,
          reasoning: String(parsedResult.reasoning),
        };
      }

      // JSON parsing failed — try heuristic extraction
      onProgress?.('Copilot response not strict JSON; extracting heuristically');
      logWarn('[BugClassifier] Non-JSON Copilot response:', resultText.substring(0, 200));

      const upperText = resultText.toUpperCase();
      let classification = 'UNCLEAR';
      let confidence = 'MEDIUM';

      if (upperText.includes('PROGRESSION')) classification = 'PROGRESSION';
      else if (upperText.includes('REGRESSION')) classification = 'REGRESSION';

      if (upperText.includes('"HIGH"') || upperText.includes("'HIGH'")) confidence = 'HIGH';
      else if (upperText.includes('"LOW"') || upperText.includes("'LOW'")) confidence = 'LOW';

      let reasoning = resultText;
      const reasoningMatch = resultText.match(/reasoning["\s:]+["']?([^"'}]+)/i);
      if (reasoningMatch) {
        reasoning = reasoningMatch[1].trim();
      } else {
        reasoning = resultText
          .replace(/[{}"]/g, '')
          .replace(/classification\s*:\s*\w+/gi, '')
          .replace(/confidence\s*:\s*\w+/gi, '')
          .replace(/reasoning\s*:/gi, '')
          .trim();
      }

      if (classification === 'UNCLEAR') {
        console.log(`[BugClassifier] Copilot returned UNCLEAR for bug ${bugData.id}; falling back to rule-based`);
        this.lastUsedCopilot = false;
        return this.classifyBugRuleBased(bugData, sprintStart, sprintEnd, gitSignals);
      }

      console.log(`[BugClassifier] Copilot (heuristic) classified bug ${bugData.id} as ${classification}`);
      this.lastUsedCopilot = true;
      return { classification, confidence, reasoning: reasoning.substring(0, 600) };
    } catch (error: any) {
      console.error(`[BugClassifier] Copilot API failed for bug ${bugData.id}:`, error.message);
      onProgress?.(`Copilot API failed (${error.message}); falling back to rule-based`);
      logWarn('[BugClassifier] Copilot classification failed, using rule-based fallback:', error.message);
      this.lastUsedCopilot = false;
      return this.classifyBugRuleBased(bugData, sprintStart, sprintEnd, gitSignals);
    }
  }

  async classify(
    bugData: Partial<BugAnalysisResult>,
    sprintStart: Date,
    sprintEnd: Date,
    onProgress?: (message: string) => void,
    gitSignals?: {
      recentFiles: number;
      recentCommits: number;
      totalFiles: number;
      newFiles: number;
      latestChange?: string;
      notes?: string;
    },
    githubToken?: string
  ): Promise<{ classification: string; confidence: string; reasoning: string }> {
    // Reset the flag before each classification
    this.lastUsedCopilot = false;

    if (this.useCopilot) {
      onProgress?.('Copilot classification started');
      const llmResult = await this.classifyBugWithCopilot(
        bugData,
        sprintStart,
        sprintEnd,
        onProgress,
        gitSignals,
        githubToken
      );

      // If Copilot returns UNCLEAR and we have PRs, try rule-based as backup
      if (llmResult.classification === 'UNCLEAR' && bugData.linked_prs && bugData.linked_prs.length > 0) {
        onProgress?.('Copilot returned UNCLEAR; running rule-based backup');
        this.lastUsedCopilot = false;
        const ruleResult = this.classifyBugRuleBased(bugData, sprintStart, sprintEnd, gitSignals);
        if (ruleResult.classification !== 'UNCLEAR') {
          return {
            ...ruleResult,
            reasoning: `[Rule-based fallback] ${ruleResult.reasoning}`,
          };
        }
      }

      return llmResult;
    }

    onProgress?.('Rule-based classification started');
    return this.classifyBugRuleBased(bugData, sprintStart, sprintEnd, gitSignals);
  }
}
