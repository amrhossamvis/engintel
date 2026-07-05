import { NextRequest, NextResponse } from 'next/server';
import { RCAGenerator } from '@/lib/rca-generator';
import { logError } from '@/lib/logger';
import { BugAnalysisResult } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { bugData } = body;

    if (!bugData) {
      return NextResponse.json(
        { error: 'Bug data is required' },
        { status: 400 }
      );
    }

    // Generate RCA
    const githubToken = request.headers.get('x-github-pat') || undefined;
    const generator = new RCAGenerator();
    const rca = await generator.generateRCA(bugData as BugAnalysisResult, githubToken);
    const markdown = generator.formatRCAAsMarkdown(rca);

    return NextResponse.json({
      success: true,
      rca,
      markdown,
    });
  } catch (error: any) {
    logError('Error generating RCA:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate RCA' },
      { status: 500 }
    );
  }
}
