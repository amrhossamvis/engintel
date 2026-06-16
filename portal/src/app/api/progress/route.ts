import { NextRequest, NextResponse } from 'next/server';
import { getProgressSnapshot, maybeCleanupProgress } from '@/lib/progress-store';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const requestId = searchParams.get('requestId') || '';
  const offset = Number.parseInt(searchParams.get('offset') || '0', 10) || 0;

  if (!requestId) {
    return NextResponse.json({ error: 'Missing requestId' }, { status: 400 });
  }

  const snapshot = getProgressSnapshot(requestId, offset);
  maybeCleanupProgress(requestId, snapshot.nextOffset);

  return NextResponse.json(snapshot);
}
