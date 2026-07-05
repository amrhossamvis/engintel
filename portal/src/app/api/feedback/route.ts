import { NextRequest, NextResponse } from 'next/server';
import { readDB, writeDB } from '@/lib/db';

export type FeedbackEntry = {
  id: string;
  appId: string;
  appName: string;
  submittedAt: string;
  type: 'bug' | 'feature-request' | 'general' | 'praise';
  rating: 1 | 2 | 3 | 4 | 5;
  message: string;
  status: 'new' | 'acknowledged' | 'in-progress' | 'resolved' | 'wont-fix';
  contactConsent: boolean;
  tags: string[];
  sessionContext?: { page: string; action?: string };
};

const DB_KEY = 'feedback';

function getFeedback(): FeedbackEntry[] {
  return readDB<FeedbackEntry[]>(DB_KEY, []);
}

function saveFeedback(entries: FeedbackEntry[]) {
  writeDB(DB_KEY, entries);
}

function isAdmin(req: NextRequest) {
  return req.cookies.get('engintel_admin')?.value === 'true';
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const appId = searchParams.get('appId');
  const all = getFeedback();
  const results = appId ? all.filter(f => f.appId === appId) : all;
  return NextResponse.json({ feedback: results.slice().reverse(), isAdmin: isAdmin(req) });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { appId, appName, type, rating, message, contactConsent, sessionContext } = body;

    if (!appId || !type || !rating || !message) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }

    const entry: FeedbackEntry = {
      id: `fb_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      appId,
      appName: appName ?? appId,
      submittedAt: new Date().toISOString(),
      type,
      rating,
      message,
      status: 'new',
      contactConsent: contactConsent ?? false,
      tags: [],
      sessionContext,
    };

    const all = getFeedback();
    all.push(entry);
    saveFeedback(all);

    return NextResponse.json({ ok: true, id: entry.id }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
  }
}

// PATCH — update status (admin only)
export async function PATCH(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }
  try {
    const body = await req.json();
    const { id, status, message } = body;
    const all = getFeedback();
    const entry = all.find(f => f.id === id);
    if (!entry) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
    if (status)  entry.status = status;
    if (message) entry.message = message;
    saveFeedback(all);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
  }
}

// DELETE — admin only
export async function DELETE(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 });
    const all = getFeedback();
    const idx = all.findIndex(f => f.id === id);
    if (idx === -1) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
    all.splice(idx, 1);
    saveFeedback(all);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
  }
}
