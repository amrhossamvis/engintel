import { NextRequest, NextResponse } from 'next/server';
import { readDB, writeDB } from '@/lib/db';
import type { Idea, Comment } from '../route';

const DB_KEY = 'ideas';

function getIdeas(): Idea[] {
  return readDB<Idea[]>(DB_KEY, []);
}

function saveIdeas(ideas: Idea[]) {
  writeDB(DB_KEY, ideas);
}

function isAdmin(req: NextRequest) {
  return req.cookies.get('engintel_admin')?.value === 'true';
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const idea = getIdeas().find(i => i.id === id);
  if (!idea) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  return NextResponse.json({ idea });
}

// PATCH — vote, status, comment, pin, or admin edit
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const ideas = getIdeas();
    const idea = ideas.find(i => i.id === id);
    if (!idea) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

    // Vote toggle (any user)
    if (body.action === 'vote') {
      const voter = body.voter ?? 'anonymous';
      if (idea.voters.includes(voter)) {
        idea.voters = idea.voters.filter(v => v !== voter);
        idea.votes = Math.max(0, idea.votes - 1);
      } else {
        idea.voters.push(voter);
        idea.votes += 1;
      }
      saveIdeas(ideas);
      return NextResponse.json({ ok: true, votes: idea.votes });
    }

    // Add comment (any user)
    if (body.action === 'comment') {
      const comment: Comment = {
        id: `cmt_${Date.now()}`,
        ideaId: id,
        author: body.author ?? 'Anonymous',
        content: body.content,
        createdAt: new Date().toISOString(),
      };
      idea.comments.push(comment);
      saveIdeas(ideas);
      return NextResponse.json({ ok: true, comment });
    }

    // ── Admin-only actions ──────────────────────────────────────────────────
    if (!isAdmin(req)) {
      return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
    }

    if (body.action === 'status') {
      idea.status = body.status;
      saveIdeas(ideas);
      return NextResponse.json({ ok: true, status: idea.status });
    }

    if (body.action === 'pin') {
      idea.isPinned = !idea.isPinned;
      saveIdeas(ideas);
      return NextResponse.json({ ok: true, isPinned: idea.isPinned });
    }

    if (body.action === 'edit') {
      if (body.title)            idea.title = body.title;
      if (body.problemStatement) idea.problemStatement = body.problemStatement;
      if (body.proposedSolution !== undefined) idea.proposedSolution = body.proposedSolution;
      if (body.domain)           idea.domain = body.domain;
      if (body.estimatedImpact)  idea.estimatedImpact = body.estimatedImpact;
      if (body.status)           idea.status = body.status;
      saveIdeas(ideas);
      return NextResponse.json({ ok: true, idea });
    }

    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
  }
}

// DELETE — admin only
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isAdmin(req)) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }
  const ideas = getIdeas();
  const idx = ideas.findIndex(i => i.id === id);
  if (idx === -1) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  ideas.splice(idx, 1);
  saveIdeas(ideas);
  return NextResponse.json({ ok: true });
}
