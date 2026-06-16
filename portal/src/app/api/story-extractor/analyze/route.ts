import { NextRequest, NextResponse } from 'next/server';
import { saveStoryModuleRecord } from '@/lib/story-persistence';
import { StoryBedrockAnalysisResult } from '@/types';
import { runCopilotChat } from '@/lib/copilot-api';

const MODEL_ID = 'claude-sonnet-4.5';

const SYSTEM_PROMPT = `You are an expert Agile Product Owner analyzing legacy iOS source files for the VFUK-iOS app. Your singular task is to reverse engineer the code files to extract user-facing functional behaviors. Completely ignore technical boilerplate, memory layouts, syntax constraints, or variable declarations. Focus purely on tracking inputs, system validations, conditional edge cases, user error scenarios, and underlying network API endpoint requests.

You must output your findings strictly as a raw JSON object adhering to this schema:
{
  "epicName": "Overarching feature domain name",
  "userStories": [
    {
      "title": "Descriptive Feature Capability Title",
      "description": "As a [User Persona], I want to [Action/Capability], So that [Business Value/Benefit].",
      "acceptanceCriteria": ["Given...", "When...", "Then..."]
    }
  ]
}

CRITICAL RULES:
- Output ONLY the raw JSON object. No markdown fences, no preamble, no explanation text.
- Every user story must have at minimum 3 acceptance criteria in Given/When/Then format.
- The epicName must be a concise, business-facing domain label (e.g. "Biometric Authentication", "Bill Management", "eSIM Provisioning").
- Extract as many distinct user stories as the code supports — do not merge unrelated behaviors.
- If a story involves an API call, mention the endpoint or operation in the acceptance criteria.`;

function parseAnalysisResponse(content: string): StoryBedrockAnalysisResult {
  const cleaned = content
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const parsed = JSON.parse(cleaned) as StoryBedrockAnalysisResult;
  if (!parsed.epicName || !Array.isArray(parsed.userStories)) {
    throw new Error('Invalid response structure: missing epicName or userStories array');
  }
  return parsed;
}

export async function POST(request: NextRequest) {
  try {
    const { moduleName, codeContent } = await request.json();
    if (!moduleName || !codeContent) {
      return NextResponse.json(
        { success: false, error: 'Missing moduleName or codeContent' },
        { status: 400 }
      );
    }

    const githubToken = request.headers.get('x-github-pat') || undefined;

    const userMessage =
      `Analyze the following iOS source code from the "${moduleName}" module of the VFUK-iOS application. ` +
      `Extract all user-facing functional behaviors and reverse-engineer them into structured Agile user stories.\n\n` +
      `<source_code>\n${codeContent}\n</source_code>\n\n` +
      `Remember: Output ONLY the raw JSON object. No markdown, no explanation.`;

    const content = await runCopilotChat(SYSTEM_PROMPT, userMessage, githubToken, MODEL_ID);
    const analysisResult = parseAnalysisResponse(content);

    // Attach UUIDs to each story using crypto.randomUUID (Node 19+ / Next.js edge-safe)
    const userStoriesWithIds = analysisResult.userStories.map((story) => ({
      id: crypto.randomUUID(),
      title: story.title,
      description: story.description,
      acceptanceCriteria: story.acceptanceCriteria,
    }));

    const record = saveStoryModuleRecord(moduleName, {
      lastAnalyzedAt: new Date().toISOString(),
      epicName: analysisResult.epicName,
      userStories: userStoriesWithIds,
    });

    return NextResponse.json({ success: true, record });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: `GitHub Copilot analysis failed: ${message}` },
      { status: 500 }
    );
  }
}
