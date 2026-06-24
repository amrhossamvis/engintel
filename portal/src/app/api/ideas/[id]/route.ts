import { NextRequest, NextResponse } from 'next/server';
import type { Comment } from '../route';

declare global {
  // eslint-disable-next-line no-var
  var _ideasStore: import('../route').Idea[] | undefined;
}

function getStore() {
  return global._ideasStore ?? [];
}

// PATCH /api/ideas/[id] — vote, change status, add comment
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const body = await req.json();
    const store = getStore();
    const idea = store.find(i => i.id === id);
    if (!idea) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

    // Vote toggle
    if (body.action === 'vote') {
      const voter = body.voter ?? 'anonymous';
      if (idea.voters.includes(voter)) {
        idea.voters = idea.voters.filter(v => v !== voter);
        idea.votes = Math.max(0, idea.votes - 1);
      } else {
        idea.voters.push(voter);
        idea.votes += 1;
      }
      return NextResponse.json({ ok: true, votes: idea.votes, voted: idea.voters.includes(voter) });
    }

    // Status change
    if (body.action === 'status') {
      idea.status = body.status;
      return NextResponse.json({ ok: true, status: idea.status });
    }

    // Add comment
    if (body.action === 'comment') {
      const comment: Comment = {
        id: `cmt_${Date.now()}`,
        ideaId: id,
        author: body.author ?? 'Anonymous',
        content: body.content,
        createdAt: new Date().toISOString(),
      };
      idea.comments.push(comment);
      return NextResponse.json({ ok: true, comment });
    }

    // Pin toggle
    if (body.action === 'pin') {
      idea.isPinned = !idea.isPinned;
      return NextResponse.json({ ok: true, isPinned: idea.isPinned });
    }

    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
  }
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const idea = getStore().find(i => i.id === params.id);
  if (!idea) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  return NextResponse.json({ idea });
}
