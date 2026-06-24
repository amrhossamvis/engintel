import { NextRequest, NextResponse } from 'next/server';

// In-memory store for MVP (replace with DB in production)
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

declare global {
  // eslint-disable-next-line no-var
  var _feedbackStore: FeedbackEntry[] | undefined;
}

function getStore(): FeedbackEntry[] {
  if (!global._feedbackStore) global._feedbackStore = [];
  return global._feedbackStore;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const appId = searchParams.get('appId');
  const store = getStore();
  const results = appId ? store.filter(f => f.appId === appId) : store;
  return NextResponse.json({ feedback: results.slice().reverse() });
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

    getStore().push(entry);
    return NextResponse.json({ ok: true, id: entry.id }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, status } = body;
    const store = getStore();
    const entry = store.find(f => f.id === id);
    if (!entry) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
    entry.status = status;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
  }
}
