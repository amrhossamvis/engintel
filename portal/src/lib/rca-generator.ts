import { BugAnalysisResult, RCAReport, RCAInitialAnalysis, RCAFinalization } from '@/types';
import { runCopilotPrompt } from '@/lib/copilot-api';
import { logWarn, logError } from '@/lib/logger';

export class RCAGenerator {
  constructor() {}

  async generateRCA(bugData: BugAnalysisResult, githubToken?: string): Promise<RCAReport> {
    const bugContext = this.buildBugContext(bugData);

    const initialAnalysis = await this.generateInitialAnalysis(bugContext, bugData, githubToken);
    const finalization = await this.generateFinalization(bugContext, bugData, githubToken);

    return {
      bugId: bugData.id,
      bugTitle: bugData.title,
      initialAnalysis,
      finalization,
      generatedAt: new Date().toISOString(),
    };
  }

  private buildBugContext(bugData: BugAnalysisResult): string {
    let context = `Bug Information:\n`;
    context += `- ID: ${bugData.id}\n`;
    context += `- Title: ${bugData.title}\n`;
    context += `- Description: ${this.cleanDescription(bugData.description)}\n`;
    context += `- State: ${bugData.state}\n`;
    context += `- Created: ${bugData.created_date}\n`;
    context += `- Closed: ${bugData.closed_date || 'Not closed'}\n`;
    context += `- Priority: ${bugData.priority}\n`;
    context += `- Severity: ${bugData.severity}\n`;
    context += `- Area Path: ${bugData.area_path}\n`;
    context += `- Assigned To: ${bugData.assigned_to}\n\n`;

    context += `Classification Analysis:\n`;
    context += `- Classification: ${bugData.classification}\n`;
    context += `- Confidence: ${bugData.confidence}\n`;
    context += `- Reasoning: ${bugData.reasoning}\n\n`;

    if (bugData.issue_type) {
      context += `Issue Type Detection:\n`;
      context += `- Type: ${bugData.issue_type.type}\n`;
      context += `- Confidence: ${bugData.issue_type.confidence}\n`;
      context += `- Indicators: ${bugData.issue_type.indicators.join(', ')}\n\n`;
    }

    if (bugData.bug_origin) {
      context += `Bug Origin:\n`;
      context += `- Introduced By: ${bugData.bug_origin.introduced_by}\n`;
      context += `- Fixed By: ${bugData.bug_origin.fixed_by}\n`;
      context += `- Introduced In Commit: ${bugData.bug_origin.introduced_in_commit}\n`;
      context += `- Introduced Date: ${bugData.bug_origin.introduced_date}\n`;
      context += `- Files Affected: ${bugData.bug_origin.files_affected.slice(0, 5).join(', ')}\n\n`;
    }

    if (bugData.git_signals) {
      context += `Git Context:\n`;
      context += `- Repository: ${bugData.git_signals.repoName}\n`;
      context += `- Related files: ${bugData.git_signals.totalFiles}\n`;
      context += `- Recently changed files: ${bugData.git_signals.recentFiles}\n`;
      context += `- Recent commits in related files: ${bugData.git_signals.recentCommits}\n`;
      if (bugData.git_signals.latestChange) {
        context += `- Latest change: ${bugData.git_signals.latestChange}\n`;
      }
      if (bugData.git_signals.notes) {
        context += `- Notes: ${bugData.git_signals.notes}\n`;
      }
      context += `\n`;
    }

    if (bugData.linked_prs && bugData.linked_prs.length > 0) {
      context += `Linked Pull Requests (${bugData.pr_count}):\n`;
      bugData.linked_prs.forEach((pr, idx) => {
        context += `\nPR ${idx + 1}:\n`;
        context += `  - Title: ${pr.title}\n`;
        context += `  - Created: ${pr.creationDate}\n`;
        context += `  - Status: ${pr.status}\n`;
        context += `  - Created By: ${pr.createdBy}\n`;
        
        if (pr.commits && pr.commits.length > 0) {
          context += `  - Commits (${pr.commits.length}):\n`;
          pr.commits.slice(0, 3).forEach((commit) => {
            context += `    * ${commit.comment.substring(0, 100)}\n`;
          });
        }

        if (pr.changes && pr.changes.length > 0) {
          context += `  - Files Changed (${pr.changes.length}):\n`;
          pr.changes.slice(0, 5).forEach((change) => {
            context += `    * ${change.item} (${change.changeType})\n`;
          });
        }
      });
    } else {
      context += `No linked pull requests found.\n`;
    }

    return context;
  }

  private cleanDescription(description: string): string {
    if (!description) return 'No description';
    
    // Remove HTML tags
    let clean = description.replace(/<[^>]+>/g, '');
    
    // Replace HTML entities
    clean = clean.replace(/&nbsp;/g, ' ');
    clean = clean.replace(/&lt;/g, '<');
    clean = clean.replace(/&gt;/g, '>');
    clean = clean.replace(/&amp;/g, '&');
    
    // Clean up whitespace
    clean = clean.replace(/\s+/g, ' ').trim();
    
    // Limit length
    if (clean.length > 300) {
      clean = clean.substring(0, 300) + '...';
    }
    
    return clean;
  }

  private async generateInitialAnalysis(
    bugContext: string,
    bugData: BugAnalysisResult,
    githubToken?: string
  ): Promise<RCAInitialAnalysis> {
    const prompt = `You are a senior software engineer analyzing a bug report to create an Initial Analysis section of a Root Cause Analysis (RCA) document.

This is the INITIAL ANALYSIS phase - before investigation begins. Focus on what you observe and what needs to be investigated.

${bugContext}

Based on this information, provide:

1. **Observation**: A brief summary of the issue with reference to any logs, errors, or symptoms. Be specific about what's broken or not working.

2. **Suspected Cause**: Identify the suspected area causing the issue (service, class, module, component). This is your initial hypothesis based on the available information.

3. **Next Steps**: List 3-5 specific investigation steps to identify the root cause. What will be checked or tested?

Respond with ONLY a JSON object in this exact format:
{
  "observation": "Brief summary with specific error details",
  "suspectedCause": "Suspected service/class/module with reasoning",
  "nextSteps": [
    "Step 1: What to investigate",
    "Step 2: What to check",
    "Step 3: What to test"
  ]
}`;

    try {
      const resultText = await runCopilotPrompt(prompt, githubToken);
      const parsed = await this.parseJSONResponse(resultText, `{
  "observation": "Brief summary with specific error details",
  "suspectedCause": "Suspected service/class/module with reasoning",
  "nextSteps": [
    "Step 1: What to investigate",
    "Step 2: What to check",
    "Step 3: What to test"
  ]
}`, githubToken);

      const observation = parsed.observation || '';
      const suspectedCause = parsed.suspectedCause || '';
      const nextSteps = Array.isArray(parsed.nextSteps) ? parsed.nextSteps : [];
      const isValid = observation.trim() && suspectedCause.trim() && nextSteps.length > 0;

      if (!isValid) {
        return this.getFallbackInitialAnalysis(bugData);
      }

      return {
        observation,
        suspectedCause,
        nextSteps,
      };
    } catch (error) {
      logError('Error generating initial analysis:', error);
      return this.getFallbackInitialAnalysis(bugData);
    }
  }

  private async generateFinalization(
    bugContext: string,
    bugData: BugAnalysisResult,
    githubToken?: string
  ): Promise<RCAFinalization> {
    // Determine issue type from detection or default
    let detectedIssueType = 'Coding issue';
    if (bugData.issue_type) {
      switch (bugData.issue_type.type) {
        case 'coding_error':
          detectedIssueType = 'Coding issue';
          break;
        case 'merge_issue':
          detectedIssueType = 'Merging issue';
          break;
        case 'integration_issue':
          detectedIssueType = 'Integration issue';
          break;
        default:
          detectedIssueType = 'Coding issue';
      }
    }

    const prompt = `You are a senior software engineer completing the RCA (Root Cause Analysis) section of a bug report.

This is the FINALIZATION phase - after the fix has been implemented. Based on the bug classification and analysis, generate the RCA details.

${bugContext}

**IMPORTANT: The issue type has been automatically detected as "${detectedIssueType}" based on code analysis. Use this as the Issue Type.**

Based on this information, provide:

1. **Issue Type**: Use "${detectedIssueType}" (already determined from code analysis)

2. **Scope of Issue**: Specify where the issue originated (e.g., "src/services/ValidationService.java, validateInput() method")

3. **Fix Applied**: Brief description of the solution that should be implemented. Be specific about the technical approach.

4. **Changed Area**: List the files, classes, or modules that would need to be modified (as an array of strings)

5. **Impact**: Does this fix affect other components?
   - If YES, provide specific details about which components and how
   - If NO, explain why it's isolated

Respond with ONLY a JSON object in this exact format:
{
  "issueType": "${detectedIssueType}",
  "scopeOfIssue": "Specific location in codebase",
  "fixApplied": "Description of the fix",
  "changedArea": ["file1.ts", "file2.tsx"],
  "impactOnOtherComponents": true,
  "impactDetails": "Details if impact is true, otherwise omit",
  "relatedWorkItemId": "${bugData.id}"
}`;

    try {
      const resultText = await runCopilotPrompt(prompt, githubToken);
      const parsed = await this.parseJSONResponse(resultText, `{
      "issueType": "${detectedIssueType}",
      "scopeOfIssue": "Specific location in codebase",
      "fixApplied": "Description of the fix",
      "changedArea": ["file1.ts", "file2.tsx"],
      "impactOnOtherComponents": true,
      "impactDetails": "Details if impact is true, otherwise omit",
      "relatedWorkItemId": "${bugData.id}"
    }`, githubToken);

      // Use detected issue type or fallback to parsed value
      let finalIssueType = detectedIssueType;
      if (parsed.issueType && parsed.issueType !== detectedIssueType) {
        // If the CLI returned a different type, validate and use detected type
        finalIssueType = detectedIssueType;
      }

      const scopeOfIssue = parsed.scopeOfIssue || '';
      const fixApplied = parsed.fixApplied || '';
      const changedArea = Array.isArray(parsed.changedArea) ? parsed.changedArea : [];
      const impactOnOtherComponents = typeof parsed.impactOnOtherComponents === 'boolean'
        ? parsed.impactOnOtherComponents
        : false;
      const impactDetails = parsed.impactDetails;
      const isValid = scopeOfIssue.trim() && fixApplied.trim() && changedArea.length > 0;

      if (!isValid) {
        return this.getFallbackFinalization(bugData);
      }

      return {
        issueType: this.validateIssueType(finalIssueType),
        scopeOfIssue,
        fixApplied,
        changedArea,
        impactOnOtherComponents,
        impactDetails,
        relatedWorkItemId: bugData.id.toString(),
      };
    } catch (error) {
      logError('Error generating finalization:', error);
      return this.getFallbackFinalization(bugData);
    }
  }

  private tryParseJson(text: string): any | null {
    // Normalize line-continuation (CLI wraps lines with \n + 2+ spaces)
    const normalized = text.replace(/\n {2,}/g, ' ');
    const fenced = normalized.match(/```json([\s\S]*?)```/i);
    const candidate = fenced ? fenced[1] : normalized;
    const jsonStart = candidate.indexOf('{');
    const jsonEnd = candidate.lastIndexOf('}') + 1;
    if (jsonStart >= 0 && jsonEnd > jsonStart) {
      return JSON.parse(candidate.substring(jsonStart, jsonEnd));
    }
    return null;
  }

  private async parseJSONResponse(text: string, formatHint: string, githubToken?: string): Promise<any> {
    try {
      const parsed = this.tryParseJson(text);
      if (parsed) {
        return parsed;
      }
    } catch (error) {
      logWarn('Failed to parse JSON response, attempting repair:', error);
    }

    try {
      const repairPrompt = `Convert the following response into valid JSON. Return ONLY JSON in this exact format:\n${formatHint}\n\nResponse:\n${text}`;
      const repaired = await runCopilotPrompt(repairPrompt, githubToken);
      const parsedRepair = this.tryParseJson(repaired);
      return parsedRepair || {};
    } catch (error) {
      logWarn('Failed to repair JSON response:', error);
      return {};
    }
  }

  private validateIssueType(type: string): 'Coding issue' | 'Merging issue' | 'Integration issue' | 'Requirements gap' {
    const validTypes = ['Coding issue', 'Merging issue', 'Integration issue', 'Requirements gap'];
    return validTypes.includes(type) ? type as any : 'Coding issue';
  }

  private getFallbackInitialAnalysis(bugData: BugAnalysisResult): RCAInitialAnalysis {
    return {
      observation: `Bug #${bugData.id}: ${bugData.title}. ${bugData.classification === 'PROGRESSION' ? 'Recent code changes may have introduced this issue.' : 'Existing issue discovered during testing.'}`,
      suspectedCause: `${bugData.area_path} - based on bug classification as ${bugData.classification}`,
      nextSteps: [
        'Review linked pull requests and commits',
        'Analyze code changes in the affected area',
        'Test reproduction steps',
        'Review related test coverage',
      ],
    };
  }

  private getFallbackFinalization(bugData: BugAnalysisResult): RCAFinalization {
    // Use detected issue type if available
    let issueType = 'Coding issue';
    if (bugData.issue_type) {
      switch (bugData.issue_type.type) {
        case 'merge_issue':
          issueType = 'Merging issue';
          break;
        case 'integration_issue':
          issueType = 'Integration issue';
          break;
        case 'coding_error':
        default:
          issueType = 'Coding issue';
      }
    } else if (bugData.classification !== 'PROGRESSION') {
      issueType = 'Integration issue';
    }
    
    return {
      issueType: issueType as any,
      scopeOfIssue: `${bugData.area_path} - ${bugData.title}`,
      fixApplied: `Based on classification: ${bugData.reasoning}`,
      changedArea: bugData.linked_prs.length > 0 
        ? bugData.linked_prs[0].changes.slice(0, 3).map(c => c.item)
        : ['To be determined'],
      impactOnOtherComponents: false,
      impactDetails: undefined,
      relatedWorkItemId: bugData.id.toString(),
    };
  }

  formatRCAAsMarkdown(rca: RCAReport): string {
    let markdown = `# Root Cause Analysis (RCA) Report\n\n`;
    markdown += `**Bug ID:** ${rca.bugId}\n`;
    markdown += `**Bug Title:** ${rca.bugTitle}\n`;
    markdown += `**Generated:** ${new Date(rca.generatedAt).toLocaleString()}\n\n`;
    markdown += `---\n\n`;

    markdown += `## Initial Analysis (Before Investigation)\n\n`;
    markdown += `### Observation\n${rca.initialAnalysis.observation}\n\n`;
    markdown += `### Suspected Cause\n${rca.initialAnalysis.suspectedCause}\n\n`;
    markdown += `### Next Steps\n`;
    rca.initialAnalysis.nextSteps.forEach((step, idx) => {
      markdown += `${idx + 1}. ${step}\n`;
    });
    markdown += `\n---\n\n`;

    markdown += `## RCA (After Fix is Finalized)\n\n`;
    markdown += `### Issue Type\n✓ ${rca.finalization.issueType}\n\n`;
    markdown += `### Scope of Issue\n${rca.finalization.scopeOfIssue}\n\n`;
    markdown += `### Fix Applied\n${rca.finalization.fixApplied}\n\n`;
    markdown += `### Changed Area\n`;
    rca.finalization.changedArea.forEach(area => {
      markdown += `- ${area}\n`;
    });
    markdown += `\n`;
    markdown += `### Impact on Other Components\n`;
    markdown += `${rca.finalization.impactOnOtherComponents ? '✓ Yes' : '✗ No'}\n\n`;
    if (rca.finalization.impactDetails) {
      markdown += `**Impact Details:** ${rca.finalization.impactDetails}\n\n`;
    }
    markdown += `### Related Work Item\n**Work Item ID:** ${rca.finalization.relatedWorkItemId}\n\n`;

    return markdown;
  }
}
