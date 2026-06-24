'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppHeader } from '@/components/AppHeader';
import {
  Lightbulb, ChevronUp, MessageSquare, Pin, Plus, X,
  Flame, Sparkles, CheckCircle2, Clock, XCircle, Search,
  ChevronDown, ArrowUpRight, Rocket, AlertCircle,
} from 'lucide-react';

type IdeaStatus = 'new' | 'under-review' | 'planned' | 'in-progress' | 'shipped' | 'declined';
type IdeaDomain = 'Mobile Guild' | 'Delivery Excellence' | 'Quality & Testing' | 'Engineering Productivity' | 'AI Value & Knowledge' | 'Platform & Infrastructure' | 'Other';

type Idea = {
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
  comments: { id: string; author: string; content: string; createdAt: string }[];
  tags: string[];
  isPinned: boolean;
};

const STATUS_META: Record<IdeaStatus, { label: string; icon: React.ReactNode; color: string }> = {
  new: { label: 'New', icon: <AlertCircle className="w-3.5 h-3.5" />, color: 'bg-gray-100 text-gray-600 border-gray-200' },
  'under-review': { label: 'Under Review', icon: <Clock className="w-3.5 h-3.5" />, color: 'bg-amber-100 text-amber-700 border-amber-200' },
  planned: { label: 'Planned', icon: <Rocket className="w-3.5 h-3.5" />, color: 'bg-blue-100 text-blue-700 border-blue-200' },
  'in-progress': { label: 'In Progress', icon: <Sparkles className="w-3.5 h-3.5" />, color: 'bg-violet-100 text-violet-700 border-violet-200' },
  shipped: { label: 'Shipped 🎉', icon: <CheckCircle2 className="w-3.5 h-3.5" />, color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  declined: { label: 'Declined', icon: <XCircle className="w-3.5 h-3.5" />, color: 'bg-gray-100 text-gray-400 border-gray-200' },
};

const IMPACT_META = {
  low: { label: 'Low Impact', color: 'text-gray-500 bg-gray-50 border-gray-200' },
  medium: { label: 'Medium Impact', color: 'text-amber-600 bg-amber-50 border-amber-200' },
  high: { label: 'High Impact', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
};

const DOMAINS: IdeaDomain[] = [
  'Mobile Guild', 'Delivery Excellence', 'Quality & Testing',
  'Engineering Productivity', 'AI Value & Knowledge', 'Platform & Infrastructure', 'Other',
];

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function IdeaCard({ idea, onVote, onExpand }: { idea: Idea; onVote: (id: string) => void; onExpand: (idea: Idea) => void }) {
  const sm = STATUS_META[idea.status];
  const im = IMPACT_META[idea.estimatedImpact];
  const isTrending = idea.votes >= 10;

  return (
    <div className={`bg-white rounded-2xl border ${idea.isPinned ? 'border-amber-200 shadow-amber-50 shadow-md' : 'border-gray-200'} overflow-hidden hover:shadow-lg transition-all duration-200`}>
      {idea.isPinned && (
        <div className="bg-amber-50 border-b border-amber-100 px-4 py-1.5 flex items-center gap-1.5">
          <Pin className="w-3 h-3 text-amber-500" />
          <span className="text-xs font-medium text-amber-600">Pinned by team</span>
        </div>
      )}
      <div className="p-5">
        <div className="flex gap-4">
          {/* Vote button */}
          <button
            onClick={() => onVote(idea.id)}
            className="flex flex-col items-center gap-1 min-w-[48px] group"
          >
            <div className="w-10 h-10 rounded-xl border-2 border-gray-200 group-hover:border-violet-400 group-hover:bg-violet-50 flex items-center justify-center transition-all">
              <ChevronUp className="w-5 h-5 text-gray-400 group-hover:text-violet-600 transition-colors" />
            </div>
            <span className="text-sm font-bold text-gray-700">{idea.votes}</span>
          </button>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-2">
              <h3 className="font-semibold text-gray-900 leading-snug">{idea.title}</h3>
              {isTrending && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-600 border border-orange-200 shrink-0">
                  <Flame className="w-3 h-3" /> Trending
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 leading-relaxed mb-3 line-clamp-2">{idea.problemStatement}</p>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${sm.color}`}>
                {sm.icon}{sm.label}
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${im.color}`}>
                {im.label}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-50 text-gray-500 border border-gray-200">
                {idea.domain}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span>{idea.submittedBy}</span>
            <span>·</span>
            <span>{timeAgo(idea.submittedAt)}</span>
            <span>·</span>
            <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" />{idea.comments.length}</span>
          </div>
          <button
            onClick={() => onExpand(idea)}
            className="inline-flex items-center gap-1 text-xs font-medium text-violet-600 hover:text-violet-800 transition-colors"
          >
            View <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

function SubmitModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (data: Partial<Idea>) => void }) {
  const [form, setForm] = useState({
    title: '', problemStatement: '', proposedSolution: '',
    domain: 'Mobile Guild' as IdeaDomain, estimatedImpact: 'medium' as 'low' | 'medium' | 'high',
    submittedBy: '',
  });
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title || !form.problemStatement) return;
    setSubmitting(true);
    const res = await fetch('/api/ideas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (data.ok) { onSubmit(data.idea); onClose(); }
    setSubmitting(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
              <Lightbulb className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">Submit an Idea</h2>
              <p className="text-xs text-gray-400">Help shape the Engineering Intelligence Hub</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Idea Title <span className="text-red-400">*</span></label>
            <input
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Teams alerts for critical bug spikes"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">What problem does this solve? <span className="text-red-400">*</span></label>
            <textarea
              value={form.problemStatement}
              onChange={e => setForm(f => ({ ...f, problemStatement: e.target.value }))}
              placeholder="Describe the pain point or gap you're experiencing..."
              rows={3}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent resize-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Proposed Solution</label>
            <textarea
              value={form.proposedSolution}
              onChange={e => setForm(f => ({ ...f, proposedSolution: e.target.value }))}
              placeholder="How would you solve it? (optional but helpful)"
              rows={2}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Domain</label>
              <select
                value={form.domain}
                onChange={e => setForm(f => ({ ...f, domain: e.target.value as IdeaDomain }))}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
              >
                {DOMAINS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Estimated Impact</label>
              <select
                value={form.estimatedImpact}
                onChange={e => setForm(f => ({ ...f, estimatedImpact: e.target.value as 'low' | 'medium' | 'high' }))}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Your Name (optional)</label>
            <input
              value={form.submittedBy}
              onChange={e => setForm(f => ({ ...f, submittedBy: e.target.value }))}
              placeholder="Anonymous"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !form.title || !form.problemStatement}
              className="flex-1 px-4 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? 'Submitting…' : 'Submit Idea 💡'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function IdeaDetailPanel({ idea, onClose, onVote }: { idea: Idea; onClose: () => void; onVote: (id: string) => void }) {
  const sm = STATUS_META[idea.status];
  const im = IMPACT_META[idea.estimatedImpact];
  const [comment, setComment] = useState('');
  const [comments, setComments] = useState(idea.comments);

  async function submitComment() {
    if (!comment.trim()) return;
    const res = await fetch(`/api/ideas/${idea.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'comment', content: comment, author: 'You' }),
    });
    const data = await res.json();
    if (data.ok) { setComments(c => [...c, data.comment]); setComment(''); }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white w-full max-w-lg h-full overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="font-bold text-gray-900 text-sm">Idea Details</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Vote + title */}
          <div className="flex gap-4">
            <button onClick={() => onVote(idea.id)} className="flex flex-col items-center gap-1 group">
              <div className="w-12 h-12 rounded-xl border-2 border-gray-200 group-hover:border-violet-400 group-hover:bg-violet-50 flex items-center justify-center transition-all">
                <ChevronUp className="w-6 h-6 text-gray-400 group-hover:text-violet-600" />
              </div>
              <span className="text-sm font-bold text-gray-700">{idea.votes}</span>
            </button>
            <div>
              <h3 className="text-lg font-bold text-gray-900 leading-snug mb-2">{idea.title}</h3>
              <div className="flex flex-wrap gap-2">
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${sm.color}`}>{sm.icon}{sm.label}</span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${im.color}`}>{im.label}</span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-50 text-gray-500 border border-gray-200">{idea.domain}</span>
              </div>
            </div>
          </div>

          {/* Problem */}
          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Problem Statement</h4>
            <p className="text-sm text-gray-700 leading-relaxed">{idea.problemStatement}</p>
          </div>

          {/* Solution */}
          {idea.proposedSolution && (
            <div>
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Proposed Solution</h4>
              <p className="text-sm text-gray-700 leading-relaxed">{idea.proposedSolution}</p>
            </div>
          )}

          {/* Meta */}
          <div className="text-xs text-gray-400 flex gap-4">
            <span>By {idea.submittedBy}</span>
            <span>·</span>
            <span>{timeAgo(idea.submittedAt)}</span>
          </div>

          {/* Comments */}
          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Comments ({comments.length})
            </h4>
            {comments.length === 0 && (
              <p className="text-sm text-gray-400 italic">No comments yet. Be the first!</p>
            )}
            <div className="space-y-3 mb-4">
              {comments.map(c => (
                <div key={c.id} className="bg-gray-50 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-gray-700">{c.author}</span>
                    <span className="text-xs text-gray-400">{timeAgo(c.createdAt)}</span>
                  </div>
                  <p className="text-sm text-gray-600">{c.content}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={comment}
                onChange={e => setComment(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submitComment()}
                placeholder="Add a comment…"
                className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
              />
              <button
                onClick={submitComment}
                disabled={!comment.trim()}
                className="px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-40 transition-colors"
              >
                Post
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function IdeaBoxPage() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSubmit, setShowSubmit] = useState(false);
  const [selectedIdea, setSelectedIdea] = useState<Idea | null>(null);
  const [sort, setSort] = useState('votes');
  const [filterDomain, setFilterDomain] = useState('all');
  const [search, setSearch] = useState('');

  const loadIdeas = useCallback(async () => {
    const res = await fetch(`/api/ideas?sort=${sort}${filterDomain !== 'all' ? `&domain=${encodeURIComponent(filterDomain)}` : ''}`);
    const data = await res.json();
    setIdeas(data.ideas ?? []);
    setLoading(false);
  }, [sort, filterDomain]);

  useEffect(() => { loadIdeas(); }, [loadIdeas]);

  async function handleVote(id: string) {
    await fetch(`/api/ideas/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'vote', voter: 'user_session' }),
    });
    loadIdeas();
    if (selectedIdea?.id === id) {
      const res = await fetch(`/api/ideas/${id}`);
      const data = await res.json();
      setSelectedIdea(data.idea);
    }
  }

  const filtered = ideas.filter(i =>
    !search || i.title.toLowerCase().includes(search.toLowerCase()) ||
    i.problemStatement.toLowerCase().includes(search.toLowerCase())
  );

  const totalVotes = ideas.reduce((s, i) => s + i.votes, 0);
  const shipped = ideas.filter(i => i.status === 'shipped').length;
  const inProgress = ideas.filter(i => i.status === 'in-progress' || i.status === 'planned').length;

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <AppHeader
        title="Idea Box"
        subtitle="Submit ideas, vote on what matters, watch them get built"
        icon={<Lightbulb className="w-5 h-5 text-white" />}
        gradient="bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700"
      />

      <main className="container mx-auto px-6 py-10">

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
          {[
            { label: 'Total Ideas', value: ideas.length, icon: <Lightbulb className="w-5 h-5 text-violet-500" />, bg: 'bg-violet-50' },
            { label: 'Total Votes', value: totalVotes, icon: <ChevronUp className="w-5 h-5 text-blue-500" />, bg: 'bg-blue-50' },
            { label: 'In Pipeline', value: inProgress, icon: <Rocket className="w-5 h-5 text-amber-500" />, bg: 'bg-amber-50' },
            { label: 'Shipped', value: shipped, icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />, bg: 'bg-emerald-50' },
          ].map(stat => (
            <div key={stat.label} className={`${stat.bg} rounded-2xl p-5 border border-white`}>
              <div className="flex items-center gap-2 mb-2">{stat.icon}<span className="text-xs font-medium text-gray-500">{stat.label}</span></div>
              <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
            </div>
          ))}
        </div>

        {/* Controls */}
        <div className="flex flex-wrap gap-3 mb-8">
          {/* Search */}
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-gray-400 shrink-0" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search ideas…"
              className="flex-1 text-sm bg-transparent outline-none text-gray-700 placeholder-gray-400"
            />
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2">
            <select value={sort} onChange={e => setSort(e.target.value)} className="text-sm text-gray-700 bg-transparent outline-none">
              <option value="votes">Most Voted</option>
              <option value="recent">Most Recent</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
          </div>

          {/* Domain filter */}
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2">
            <select value={filterDomain} onChange={e => setFilterDomain(e.target.value)} className="text-sm text-gray-700 bg-transparent outline-none">
              <option value="all">All Domains</option>
              {DOMAINS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
          </div>

          {/* Submit button */}
          <button
            onClick={() => setShowSubmit(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition-colors shadow-sm shadow-violet-200"
          >
            <Plus className="w-4 h-4" /> Submit Idea
          </button>
        </div>

        {/* Ideas list */}
        {loading ? (
          <div className="text-center py-20 text-gray-400">Loading ideas…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Lightbulb className="w-12 h-12 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-400 font-medium">No ideas yet</p>
            <p className="text-sm text-gray-300 mt-1">Be the first to submit an idea!</p>
            <button onClick={() => setShowSubmit(true)} className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition-colors">
              <Plus className="w-4 h-4" /> Submit First Idea
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map(idea => (
              <IdeaCard
                key={idea.id}
                idea={idea}
                onVote={handleVote}
                onExpand={setSelectedIdea}
              />
            ))}
          </div>
        )}
      </main>

      {showSubmit && (
        <SubmitModal
          onClose={() => setShowSubmit(false)}
          onSubmit={() => loadIdeas()}
        />
      )}

      {selectedIdea && (
        <IdeaDetailPanel
          idea={selectedIdea}
          onClose={() => setSelectedIdea(null)}
          onVote={handleVote}
        />
      )}
    </div>
  );
}
