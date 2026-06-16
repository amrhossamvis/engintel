import { NextRequest, NextResponse } from 'next/server';
import { ADOService } from '@/lib/ado-service';
import { logDebug, logError } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    logDebug('Detect dates API called');
    
    const body = await request.json();
    const { queryUrl, patToken } = body;

    logDebug('Request body:', { queryUrl: queryUrl ? 'present' : 'missing', patToken: patToken ? 'present' : 'missing' });

    if (!queryUrl) {
      return NextResponse.json(
        { error: 'Query URL is required' },
        { status: 400 }
      );
    }

    if (!patToken) {
      return NextResponse.json(
        { error: 'PAT Token is required' },
        { status: 400 }
      );
    }

    // Initialize ADO service
    logDebug('Initializing ADO service...');
    const adoService = new ADOService(patToken);

    // Parse query URL
    logDebug('Parsing query URL...');
    const { organization, project, queryId } = adoService.parseQueryUrl(queryUrl);
    logDebug('Parsed:', { organization, project, queryId });

    // Fetch work items
    logDebug('Fetching work items...');
    const workItems = await adoService.executeQuery(organization, project, queryId);
    logDebug(`Found ${workItems.length} work items`);

    if (workItems.length === 0) {
      return NextResponse.json(
        { error: 'No work items found in query' },
        { status: 404 }
      );
    }

    // Detect sprint dates
    logDebug('Detecting sprint dates...');
    const detectedDates = await adoService.detectSprintDatesFromBugs(
      organization,
      project,
      workItems
    );

    if (!detectedDates) {
      logDebug('Could not detect dates');
      return NextResponse.json({
        success: false,
        message: 'Could not auto-detect sprint dates',
        totalBugs: workItems.length,
      });
    }

    logDebug('Detected dates:', detectedDates);
    return NextResponse.json({
      success: true,
      sprintStart: detectedDates.sprintStart,
      sprintEnd: detectedDates.sprintEnd,
      totalBugs: workItems.length,
    });
  } catch (error: any) {
    logError('Error detecting sprint dates:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to detect sprint dates' },
      { status: 500 }
    );
  }
}
