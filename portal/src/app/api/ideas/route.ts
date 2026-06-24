import { NextRequest, NextResponse } from 'next/server';

export type IdeaStatus = 'new' | 'under-review' | 'planned' | 'in-progress' | 'shipped' | 'declined';
export type IdeaDomain =
  | 'Mobile Guild'
  | 'Delivery Excellence'
  | 'Quality & Testing'
  | 'Engineering Productivity'
  | 'AI Value & Knowledge'
  | 'Platform & Infrastructure'
  | 'Other';

export type Comment = {
  id: string;
  ideaId: string;
  author: string;
  content: string;
  createdAt: string;
};

export type Idea = {
  id: string;
  title: string;
  problemStatement: string;
  proposedSolution: string;
  domain: IdeaDomain;
  estimatedImpact: 'low' | 'medium' | 'high';
  status: IdeaStatus;
  submittedBy: string;
  submittedAt: string;
  votes: number;
  voters: string[];
  comments: Comment[];
  tags: string[];
  isPinned: boolean;
};

declare global {
  // eslint-disable-next-line no-var
  var _ideasStore: Idea[] | undefined;
}

function getStore(): Idea[] {
  if (!global._ideasStore) {
    // Seed with a couple of example ideas
    global._ideasStore = [
      {
        id: 'idea_seed_1',
        title: 'Teams Integration for Bug Analyzer Alerts',
        problemStatement: 'Engineers miss critical bug spikes because they have to manually check the portal.',
        proposedSolution: 'Push real-time Teams notifications when a new P1/P2 bug cluster is detected by the Bug Analyzer.',
        domain: 'Mobile Guild',
        estimatedImpact: 'high',
        status: 'under-review',
        submittedBy: 'Engineering Team',
        submittedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
        votes: 14,
        voters: [],
        comments: [],
        tags: ['teams', 'notifications', 'bug-analyzer'],
        isPinned: true,
      },
      {
        id: 'idea_seed_2',
        title: 'Weekly AI Digest Email',
        problemStatement: 'Leadership wants a weekly summary of AI tool usage and impact without logging in.',
        proposedSolution: 'Auto-generate and email a weekly digest: top bugs found, stories extracted, Copilot ROI metrics.',
        domain: 'AI Value & Knowledge',
        estimatedImpact: 'medium',
        status: 'planned',
        submittedBy: 'Engineering Team',
        submittedAt: new Date(Date.now() - 86400000 * 5).toISOString(),
        votes: 9,
        voters: [],
        comments: [],
        tags: ['email', 'digest', 'reporting'],
        isPinned: false,
      },
      {
        id: 'idea_seed_3',
        title: 'Dark Mode for the Hub',
        problemStatement: 'Engineers working late find the bright white UI straining on the eyes.',
        proposedSolution: 'Add a dark mode toggle that persists across sessions using localStorage.',
        domain: 'Platform & Infrastructure',
        estimatedImpact: 'low',
        status: 'new',
        submittedBy: 'Engineering Team',
        submittedAt: new Date(Date.now() - 86400000).toISOString(),
        votes: 22,
        voters: [],
        comments: [],
        tags: ['ui', 'dark-mode', 'accessibility'],
        isPinned: false,
      },
    ];
  }
  return global._ideasStore;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sort = searchParams.get('sort') ?? 'votes'; // votes | recent | status
  const domain = searchParams.get('domain');
  const status = searchParams.get('status');

  let ideas = getStore().slice();

  if (domain) ideas = ideas.filter(i => i.domain === domain);
  if (status) ideas = ideas.filter(i => i.status === status);

  // Pinned always first
  ideas.sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    if (sort === 'votes') return b.votes - a.votes;
    if (sort === 'recent') return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
    return 0;
  });

  return NextResponse.json({ ideas });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, problemStatement, proposedSolution, domain, estimatedImpact, submittedBy } = body;

    if (!title || !problemStatement || !domain) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }

    const idea: Idea = {
      id: `idea_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      title,
      problemStatement,
      proposedSolution: proposedSolution ?? '',
      domain,
      estimatedImpact: estimatedImpact ?? 'medium',
      status: 'new',
      submittedBy: submittedBy ?? 'Anonymous',
      submittedAt: new Date().toISOString(),
      votes: 0,
      voters: [],
      comments: [],
      tags: [],
      isPinned: false,
    };

    getStore().push(idea);
    return NextResponse.json({ ok: true, idea }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
  }
}
