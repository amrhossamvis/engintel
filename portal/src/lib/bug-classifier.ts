import { BugAnalysisResult } from '@/types';
import { runCopilotPrompt } from '@/lib/copilot-api';
import { logWarn } from '@/lib/logger';

export class BugClassifier {
  private useCopilot: boolean;

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
      const newFilePercentage = (gitSignals.newFiles / gitSignals.totalFiles) * 100;
      
      // Strong signal: newly created files (didn't exist before recent window)
      if (gitSignals.newFiles > 0) {
        return {
          classification: 'PROGRESSION',
          confidence: gitSignals.newFiles >= 2 ? 'HIGH' : 'MEDIUM',
          reasoning: `${gitSignals.newFiles} new file(s) recently created among ${gitSignals.totalFiles} related files - strong indication of new feature/code` +
            (gitSignals.latestChange ? ` (latest: ${gitSignals.latestChange})` : ''),
        };
      }
      
      // Require meaningful threshold: at least 30% of files OR 3+ files changed
      if (recentPercentage >= 30 || gitSignals.recentFiles >= 3) {
        const confidence = recentPercentage >= 50 ? 'HIGH' : (recentPercentage >= 30 ? 'MEDIUM' : 'LOW');
        return {
          classification: 'PROGRESSION',
          confidence,
          reasoning: `Significant recent activity in ${gitSignals.recentFiles}/${gitSignals.totalFiles} files (${recentPercentage.toFixed(0)}%) before the fix PR` +
            (gitSignals.latestChange ? ` (latest: ${gitSignals.latestChange})` : ''),
        };
      }
      
      // Low activity: only 1-2 files changed in a larger set
      if (gitSignals.recentFiles > 0 && gitSignals.totalFiles >= 5) {
        return {
          classification: 'REGRESSION',
          confidence: 'MEDIUM',
          reasoning: `Minor recent activity (${gitSignals.recentFiles}/${gitSignals.totalFiles} files, ${recentPercentage.toFixed(0)}%) - likely touching existing bug in old code`,
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
        const daysBeforeSprint = Math.floor((sprintStart.getTime() - prCreated.getTime()) / (1000 * 60 * 60 * 24));

        if (prCreated >= sprintStart || daysBeforeSprint <= 14) {
          recentChanges.push({
            type: 'PR',
            date: prCreated,
            title: pr.title,
            daysBeforeSprint: prCreated < sprintStart ? daysBeforeSprint : 0,
          });
        } else {
          oldChanges.push({
            type: 'PR',
            date: prCreated,
            title: pr.title,
            daysBeforeSprint,
          });
        }

        for (const commit of pr.commits) {
          const commitDt = this.parseDateTimeSafe(commit.date);
          if (commitDt) {
            const commitDaysBefore = Math.floor((sprintStart.getTime() - commitDt.getTime()) / (1000 * 60 * 60 * 24));

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
      const oldestChange = oldChanges.reduce((prev, curr) => (prev.date < curr.date ? prev : curr));
      reasoning = `Only old code changes found (oldest: ${oldestChange.daysBeforeSprint} days before sprint)`;
    } else if (bugCreated && bugCreated >= sprintStart) {
      classification = 'REGRESSION';
      confidence = 'LOW';
      reasoning = 'Bug reported during sprint but no linked code changes found - likely existing issue';
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
    const bugDescription = bugData.description || 'No description';
    const bugCreatedDate = bugData.created_date || 'Unknown';
    const linkedPRs = bugData.linked_prs || [];

    let prContext = '';
    for (const pr of linkedPRs) {
      const prDate = pr.creationDate || 'Unknown';
      const prTitle = pr.title || 'Unknown';
      prContext += `- PR: ${prTitle} (Created: ${prDate})\n`;

      for (const commit of pr.commits) {
        const commitDate = commit.date || 'Unknown';
        const commitMsg = commit.comment || 'No message';
        prContext += `  * Commit: ${commitMsg} (Date: ${commitDate})\n`;
      }
    }

    const gitContext = gitSignals
      ? `\nGit Context:\n- Related files: ${gitSignals.totalFiles}\n- Recently changed files (last 7 days before sprint): ${gitSignals.recentFiles}\n- Newly created files: ${gitSignals.newFiles}\n- Recent commits in related files: ${gitSignals.recentCommits}${gitSignals.latestChange ? `\n- Latest change: ${gitSignals.latestChange}` : ''}${gitSignals.notes ? `\n- Notes: ${gitSignals.notes}` : ''}`
      : '';

    const prompt = `Classify this bug as PROGRESSION or REGRESSION based ONLY on the timeline evidence (PR dates, commit dates, git activity). Do NOT use the bug title or description to infer the classification.

Sprint Timeline: ${sprintStart.toISOString().split('T')[0]} to ${sprintEnd.toISOString().split('T')[0]}
Bug Reported Date: ${bugCreatedDate}

Related Pull Requests and Commits:
${prContext || 'No linked PRs found'}
${gitContext}

Classification Criteria:
- PROGRESSION: Code changes were made during or shortly before this sprint that introduced the bug
- REGRESSION: No recent code changes in the affected area; bug existed in older code but was only discovered during this sprint

Respond with ONLY a JSON object (keep reasoning to 2-3 sentences max):
{"classification":"PROGRESSION or REGRESSION","confidence":"HIGH or MEDIUM or LOW","reasoning":"brief explanation"}`;

    try {
      onProgress?.('Calling Copilot CLI for classification');
      const resultText = await runCopilotPrompt(prompt, githubToken);
      onProgress?.('Copilot response received; parsing');

      const tryParseJson = (text: string) => {
        // Normalize line-continuation (CLI wraps lines with \n + 2+ spaces)
        const normalized = text.replace(/\n {2,}/g, ' ');
        const fenced = normalized.match(/```json([\s\S]*?)```/i);
        const candidate = fenced ? fenced[1] : normalized;
        const jsonStart = candidate.indexOf('{');
        const jsonEnd = candidate.lastIndexOf('}') + 1;
        if (jsonStart >= 0 && jsonEnd > jsonStart) {
          const jsonText = candidate.substring(jsonStart, jsonEnd);
          return JSON.parse(jsonText);
        }
        return null;
      };

      let parsedResult: any = null;
      try {
        parsedResult = tryParseJson(resultText);
      } catch {
        parsedResult = null;
      }

      if (
        parsedResult &&
        parsedResult.classification &&
        parsedResult.confidence &&
        parsedResult.reasoning
      ) {
        onProgress?.('Parsed structured JSON response');
        let classification = String(parsedResult.classification).toUpperCase();
        if (!['PROGRESSION', 'REGRESSION', 'UNCLEAR'].includes(classification)) {
          classification = 'UNCLEAR';
        }

        let confidence = String(parsedResult.confidence).toUpperCase();
        if (!['HIGH', 'MEDIUM', 'LOW'].includes(confidence)) {
          confidence = 'LOW';
        }

        return {
          classification,
          confidence,
          reasoning: String(parsedResult.reasoning),
        };
      }

      // JSON parsing failed - try heuristic extraction from the text
      onProgress?.('Copilot response not strict JSON; extracting from text');
      logWarn('Non-JSON Copilot response, extracting heuristically:', resultText.substring(0, 100));
      
      const upperText = resultText.toUpperCase();
      let classification = 'UNCLEAR';
      let confidence = 'MEDIUM';

      if (upperText.includes('PROGRESSION')) {
        classification = 'PROGRESSION';
      } else if (upperText.includes('REGRESSION')) {
        classification = 'REGRESSION';
      }

      if (upperText.includes('"HIGH"') || upperText.includes("'HIGH'")) {
        confidence = 'HIGH';
      } else if (upperText.includes('"LOW"') || upperText.includes("'LOW'")) {
        confidence = 'LOW';
      }

      // Extract reasoning from text - look for "reasoning" field value or use cleaned text
      let reasoning = resultText;
      const reasoningMatch = resultText.match(/reasoning["\s:]+["']?([^"'}]+)/i);
      if (reasoningMatch) {
        reasoning = reasoningMatch[1].trim();
      } else {
        // Remove JSON-like noise and use the plain text
        reasoning = resultText
          .replace(/[{}"]/g, '')
          .replace(/classification\s*:\s*\w+/gi, '')
          .replace(/confidence\s*:\s*\w+/gi, '')
          .replace(/reasoning\s*:/gi, '')
          .trim();
      }

      if (classification === 'UNCLEAR') {
        // If we couldn't extract from Copilot, fall back to rule-based
        return this.classifyBugRuleBased(bugData, sprintStart, sprintEnd, gitSignals);
      }

      return {
        classification,
        confidence,
        reasoning: reasoning.substring(0, 500),
      };
    } catch (error: any) {
      onProgress?.('Copilot CLI failed; falling back to rule-based classification');
      logWarn('Copilot CLI classification failed, using rule-based fallback:', error.message);
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
    if (this.useCopilot) {
      onProgress?.('Copilot classification started');
      const llmResult = await this.classifyBugWithCopilot(bugData, sprintStart, sprintEnd, onProgress, gitSignals, githubToken);
      
      // If LLM returns unclear and we have PRs, try rule-based as backup
      if (llmResult.classification === 'UNCLEAR' && bugData.linked_prs && bugData.linked_prs.length > 0) {
        onProgress?.('Copilot returned UNCLEAR; running rule-based backup');
        const ruleResult = this.classifyBugRuleBased(bugData, sprintStart, sprintEnd, gitSignals);
        if (ruleResult.classification !== 'UNCLEAR') {
          return {
            ...ruleResult,
            reasoning: `Rule-based backup: ${ruleResult.reasoning}`,
          };
        }
      }
      
      return llmResult;
    }

    onProgress?.('Rule-based classification started');
    return this.classifyBugRuleBased(bugData, sprintStart, sprintEnd, gitSignals);
  }
}
