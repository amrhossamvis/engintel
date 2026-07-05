import { NextRequest, NextResponse } from 'next/server';
import { runCopilotPrompt } from '@/lib/copilot-cli';

export type PromptTemplate = {
  id: string;
  name: string;
  description: string;
  category: string;
  prompt: string; // The full prompt sent to Copilot CLI
  variables: { key: string; label: string; placeholder: string; type: 'text' | 'textarea' | 'code' }[];
  isOfficial: boolean;
  usageCount: number;
};

const TEMPLATES: PromptTemplate[] = [
  {
    id: 'bug-classify',
    name: 'Classify Bug Severity',
    description: 'Classify a bug report by severity, type, and affected platform.',
    category: 'Bug Analysis',
    prompt: `You are an expert mobile engineering QA analyst. Classify the following bug report and return a structured analysis with:
- Severity: P1 / P2 / P3 / P4
- Type: crash / ui / performance / logic / network
- Platform: iOS / Android / Both / Unknown
- Root cause hypothesis (one line)
- Recommended priority action

Bug report:
{{bug_description}}`,
    variables: [
      { key: 'bug_description', label: 'Bug Description', placeholder: 'Paste the bug title and description here...', type: 'textarea' },
    ],
    isOfficial: true,
    usageCount: 0,
  },
  {
    id: 'rca-generator',
    name: 'Generate RCA from Stack Trace',
    description: 'Produce a structured Root Cause Analysis from a crash stack trace.',
    category: 'Bug Analysis',
    prompt: `You are a senior mobile engineer specializing in crash analysis. Given the following stack trace, produce a structured RCA with:
- Root Cause
- Contributing Factors
- Affected User Estimate
- Immediate Fix Recommendation
- Long-term Prevention Steps

App version: {{app_version}}
Platform: {{platform}}

Stack trace:
\`\`\`
{{stack_trace}}
\`\`\``,
    variables: [
      { key: 'stack_trace', label: 'Stack Trace', placeholder: 'Paste the crash stack trace...', type: 'code' },
      { key: 'app_version', label: 'App Version', placeholder: 'e.g. 5.12.1', type: 'text' },
      { key: 'platform', label: 'Platform', placeholder: 'iOS / Android', type: 'text' },
    ],
    isOfficial: true,
    usageCount: 0,
  },
  {
    id: 'story-extractor',
    name: 'Extract User Stories from Code',
    description: 'Reverse-engineer Agile user stories from source code.',
    category: 'Story Generation',
    prompt: `You are an expert Agile coach and mobile engineer. Given the following source code, extract structured user stories in the format:
"As a [user], I want to [action] so that [benefit]."

Include acceptance criteria for each story. Group related stories into epics.

Language: {{language}}

Source code:
\`\`\`
{{code}}
\`\`\``,
    variables: [
      { key: 'language', label: 'Language', placeholder: 'swift / kotlin / typescript', type: 'text' },
      { key: 'code', label: 'Source Code', placeholder: 'Paste your source code here...', type: 'code' },
    ],
    isOfficial: true,
    usageCount: 0,
  },
  {
    id: 'pr-review',
    name: 'Review PR for Mobile Issues',
    description: 'First-pass AI review of a mobile PR diff.',
    category: 'Code Review',
    prompt: `You are a senior mobile engineer reviewing a pull request. Analyze the following diff for:
- Memory leaks
- Force-unwraps (Swift) or null safety issues (Kotlin)
- ANR-prone patterns
- Performance bottlenecks
- Missing error handling
- Security concerns

Rate overall risk as Low / Medium / High and provide specific line-level comments.

PR title: {{pr_title}}
Platform: {{platform}}

Diff:
\`\`\`
{{diff}}
\`\`\``,
    variables: [
      { key: 'pr_title', label: 'PR Title', placeholder: 'e.g. Fix login crash on iOS 17', type: 'text' },
      { key: 'platform', label: 'Platform', placeholder: 'iOS / Android / React Native', type: 'text' },
      { key: 'diff', label: 'PR Diff', placeholder: 'Paste the git diff here...', type: 'code' },
    ],
    isOfficial: true,
    usageCount: 0,
  },
  {
    id: 'sprint-summary',
    name: 'Sprint Health Summary',
    description: 'Generate an executive-ready sprint health summary.',
    category: 'Delivery',
    prompt: `You are an engineering delivery manager. Given the following sprint metrics, write a concise executive summary (3-5 bullet points) covering velocity vs target, quality indicators, key risks, blockers, and a RAG status (Red/Amber/Green) with justification.

Sprint: {{sprint_name}}
Velocity: {{velocity}} / {{target}} points
Bugs opened: {{bugs_opened}}
Bugs closed: {{bugs_closed}}
PRs merged: {{prs_merged}}
Blockers: {{blockers}}`,
    variables: [
      { key: 'sprint_name', label: 'Sprint Name', placeholder: 'e.g. Sprint 42', type: 'text' },
      { key: 'velocity', label: 'Actual Velocity', placeholder: '34', type: 'text' },
      { key: 'target', label: 'Target Velocity', placeholder: '40', type: 'text' },
      { key: 'bugs_opened', label: 'Bugs Opened', placeholder: '12', type: 'text' },
      { key: 'bugs_closed', label: 'Bugs Closed', placeholder: '8', type: 'text' },
      { key: 'prs_merged', label: 'PRs Merged', placeholder: '23', type: 'text' },
      { key: 'blockers', label: 'Blockers', placeholder: 'Describe any blockers...', type: 'textarea' },
    ],
    isOfficial: true,
    usageCount: 0,
  },
  {
    id: 'test-gen',
    name: 'Generate Unit Tests',
    description: 'Generate unit tests for a given function or class.',
    category: 'Test Generation',
    prompt: `You are a senior QA engineer and mobile developer. Generate comprehensive unit tests for the following code. Cover: happy path, edge cases, error conditions, and boundary values. Use the appropriate testing framework.

Language: {{language}}
Testing framework: {{framework}}

Code to test:
\`\`\`
{{code}}
\`\`\``,
    variables: [
      { key: 'language', label: 'Language', placeholder: 'Swift / Kotlin / TypeScript', type: 'text' },
      { key: 'framework', label: 'Testing Framework', placeholder: 'XCTest / JUnit / Jest', type: 'text' },
      { key: 'code', label: 'Code to Test', placeholder: 'Paste the function or class...', type: 'code' },
    ],
    isOfficial: true,
    usageCount: 0,
  },
  {
    id: 'copilot-suggest',
    name: 'Copilot CLI: Suggest Command',
    description: 'Translate a natural language task into a shell command.',
    category: 'Copilot CLI',
    prompt: `Suggest the most appropriate shell command for the following task. Explain what the command does, any flags used, and warn about potential side effects. Show the command first, then the explanation.

Task: {{task_description}}
Context: {{context}}`,
    variables: [
      { key: 'task_description', label: 'What do you want to do?', placeholder: 'e.g. Find all Swift files modified in the last 7 days', type: 'textarea' },
      { key: 'context', label: 'Context (optional)', placeholder: 'e.g. macOS, git repo, Xcode project', type: 'text' },
    ],
    isOfficial: true,
    usageCount: 0,
  },
  {
    id: 'copilot-explain',
    name: 'Copilot CLI: Explain Command',
    description: 'Explain what a shell command does in plain English.',
    category: 'Copilot CLI',
    prompt: `Explain the following shell command in plain English. Break down each part, explain flags and options, describe what it does, potential side effects, and whether it is safe to run.

Command:
\`\`\`
{{command}}
\`\`\``,
    variables: [
      { key: 'command', label: 'Shell Command', placeholder: 'e.g. find . -name "*.swift" -mtime -7 | xargs grep -l "TODO"', type: 'code' },
    ],
    isOfficial: true,
    usageCount: 0,
  },
  {
    id: 'free-form',
    name: 'Free-Form Prompt',
    description: 'Blank canvas — write your own prompt.',
    category: 'Custom',
    prompt: `{{prompt}}`,
    variables: [
      { key: 'prompt', label: 'Your Prompt', placeholder: 'Ask anything...', type: 'textarea' },
    ],
    isOfficial: true,
    usageCount: 0,
  },
];

function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

export async function GET() {
  return NextResponse.json({ templates: TEMPLATES });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { templateId, prompt, variables = {} } = body;

    // Increment usage count
    const template = TEMPLATES.find(t => t.id === templateId);
    if (template) template.usageCount += 1;

    // Build the final prompt by filling variables
    const rawPrompt = prompt ?? template?.prompt ?? '';
    const filledPrompt = fillTemplate(rawPrompt, variables);

    if (!filledPrompt.trim()) {
      return NextResponse.json({ error: 'Prompt is empty.' }, { status: 400 });
    }

    const start = Date.now();
    const response = await runCopilotPrompt(filledPrompt);
    const latencyMs = Date.now() - start;

    return NextResponse.json({
      response,
      latencyMs,
      promptLength: filledPrompt.length,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
