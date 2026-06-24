'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { AdminBar } from '@/components/AdminBar';
import {
  MessageSquare, Bug, Sparkles, ThumbsUp, Star,
  Filter, BarChart2, CheckCircle, Clock, XCircle, AlertCircle, ChevronDown,
  Trash2,
} from 'lucide-react';

type FeedbackEntry = {
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
};

type FeedbackStatus = FeedbackEntry['status'];

const TYPE_META = {
  bug: { label: 'Bug Report', icon: <Bug className="w-3.5 h-3.5" />, color: 'bg-red-100 text-red-700 border-red-200' },
  'feature-request': { label: 'Feature Request', icon: <Sparkles className="w-3.5 h-3.5" />, color: 'bg-violet-100 text-violet-700 border-violet-200' },
  general: { label: 'General', icon: <MessageSquare className="w-3.5 h-3.5" />, color: 'bg-blue-100 text-blue-700 border-blue-200' },
  praise: { label: 'Praise', icon: <ThumbsUp className="w-3.5 h-3.5" />, color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
};

const STATUS_META: Record<FeedbackStatus, { label: string; icon: React.ReactNode; color: string }> = {
  new: { label: 'New', icon: <AlertCircle className="w-3.5 h-3.5" />, color: 'bg-gray-100 text-gray-600 border-gray-200' },
  acknowledged: { label: 'Acknowledged', icon: <CheckCircle className="w-3.5 h-3.5" />, color: 'bg-blue-100 text-blue-700 border-blue-200' },
  'in-progress': { label: 'In Progress', icon: <Clock className="w-3.5 h-3.5" />, color: 'bg-amber-100 text-amber-700 border-amber-200' },
  resolved: { label: 'Resolved', icon: <CheckCircle className="w-3.5 h-3.5" />, color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  'wont-fix': { label: "Won't Fix", icon: <XCircle className="w-3.5 h-3.5" />, color: 'bg-gray-100 text-gray-400 border-gray-200' },
};

const FEEDBACK_STATUSES: FeedbackStatus[] = ['new', 'acknowledged', 'in-progress', 'resolved', 'wont-fix'];

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <Star key={s} className={`w-3.5 h-3.5 ${s <= rating ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}`} />
      ))}
    </div>
  );
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── DeleteConfirmModal ───────────────────────────────────────────────────────
function DeleteConfirmModal({
  entry, onClose, onDeleted,
}: { entry: FeedbackEntry; onClose: () => void; onDeleted: () => void }) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    await fetch(`/api/feedback?id=${entry.id}`, { method: 'DELETE' });
    setDeleting(false);
    onDeleted();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
            <Trash2 className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h2 className="font-bold text-gray-900">Delete Feedback</h2>
            <p className="text-xs text-gray-400">This action cannot be undone</p>
          </div>
        </div>
        <p className="text-sm text-gray-600 mb-6 line-clamp-3">
          Delete this {TYPE_META[entry.type].label.toLowerCase()} from <span className="font-semibold text-gray-900">{entry.appName || entry.appId}</span>?
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── FeedbackCard ─────────────────────────────────────────────────────────────
function FeedbackCard({
  entry, isAdmin, onStatusChange, onDelete,
}: {
  entry: FeedbackEntry;
  isAdmin: boolean;
  onStatusChange: (id: string, status: FeedbackStatus) => void;
  onDelete: (entry: FeedbackEntry) => void;
}) {
  const tm = TYPE_META[entry.type];
  const sm = STATUS_META[entry.status];

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${tm.color}`}>
            {tm.icon}{tm.label}
          </span>

          {/* Status — admin can change inline */}
          {isAdmin ? (
            <select
              value={entry.status}
              onChange={e => onStatusChange(entry.id, e.target.value as FeedbackStatus)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border cursor-pointer bg-white ${sm.color}`}
            >
              {FEEDBACK_STATUSES.map(s => (
                <option key={s} value={s}>{STATUS_META[s].label}</option>
              ))}
            </select>
          ) : (
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${sm.color}`}>
              {sm.icon}{sm.label}
            </span>
          )}

          <span className="text-xs text-gray-400 bg-gray-50 border border-gray-200 rounded-full px-2.5 py-1">
            {entry.appName || entry.appId}
          </span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <StarRating rating={entry.rating} />
          <span className="text-xs text-gray-400">{timeAgo(entry.submittedAt)}</span>
          {/* Admin delete button */}
          {isAdmin && (
            <button
              onClick={() => onDelete(entry)}
              title="Delete feedback"
              className="w-7 h-7 rounded-lg bg-gray-100 text-gray-400 hover:bg-red-100 hover:text-red-600 flex items-center justify-center transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
      <p className="text-sm text-gray-700 leading-relaxed">{entry.message}</p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function FeedbackDashboard() {
  const [feedback, setFeedback] = useState<FeedbackEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [filterApp, setFilterApp] = useState('all');
  const [deletingEntry, setDeletingEntry] = useState<FeedbackEntry | null>(null);

  const loadFeedback = useCallback(async () => {
    const res = await fetch('/api/feedback');
    const d = await res.json();
    setFeedback(d.feedback ?? []);
    if (d.isAdmin !== undefined) setIsAdmin(d.isAdmin);
    setLoading(false);
  }, []);

  useEffect(() => { loadFeedback(); }, [loadFeedback]);

  const handleAdminChange = useCallback((admin: boolean) => {
    setIsAdmin(admin);
    loadFeedback();
  }, [loadFeedback]);

  async function handleStatusChange(id: string, status: FeedbackStatus) {
    await fetch('/api/feedback', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    loadFeedback();
  }

  const apps = Array.from(new Set(feedback.map(f => f.appId)));
  const filtered = feedback.filter(f =>
    (filterType === 'all' || f.type === filterType) &&
    (filterApp === 'all' || f.appId === filterApp)
  );

  const avgRating = feedback.length
    ? (feedback.reduce((s, f) => s + f.rating, 0) / feedback.length).toFixed(1)
    : '—';

  const byType = (t: string) => feedback.filter(f => f.type === t).length;

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <AppHeader
        title="Feedback Dashboard"
        subtitle="All engineer feedback across every tool in the hub"
        icon={<MessageSquare className="w-5 h-5 text-white" />}
        gradient="bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-600"
      />

      <main className="container mx-auto px-6 py-10">

        {/* Admin bar */}
        <div className="mb-8">
          <AdminBar onAdminChange={handleAdminChange} />
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
          {[
            { label: 'Total Feedback', value: feedback.length, icon: <MessageSquare className="w-5 h-5 text-blue-500" />, bg: 'bg-blue-50' },
            { label: 'Avg Rating', value: `${avgRating} / 5`, icon: <Star className="w-5 h-5 text-amber-500" />, bg: 'bg-amber-50' },
            { label: 'Bug Reports', value: byType('bug'), icon: <Bug className="w-5 h-5 text-red-500" />, bg: 'bg-red-50' },
            { label: 'Feature Requests', value: byType('feature-request'), icon: <Sparkles className="w-5 h-5 text-violet-500" />, bg: 'bg-violet-50' },
          ].map(stat => (
            <div key={stat.label} className={`${stat.bg} rounded-2xl p-5 border border-white`}>
              <div className="flex items-center gap-2 mb-2">{stat.icon}<span className="text-xs font-medium text-gray-500">{stat.label}</span></div>
              <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
            </div>
          ))}
        </div>

        {/* Satisfaction bar */}
        {feedback.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-8">
            <div className="flex items-center gap-2 mb-4">
              <BarChart2 className="w-4 h-4 text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-700">Rating Distribution</h2>
            </div>
            <div className="space-y-2">
              {[5, 4, 3, 2, 1].map(star => {
                const count = feedback.filter(f => f.rating === star).length;
                const pct = feedback.length ? Math.round((count / feedback.length) * 100) : 0;
                return (
                  <div key={star} className="flex items-center gap-3">
                    <div className="flex gap-0.5 w-20 shrink-0">
                      {[1, 2, 3, 4, 5].map(s => (
                        <Star key={s} className={`w-3 h-3 ${s <= star ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}`} />
                      ))}
                    </div>
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div className="bg-amber-400 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-gray-400 w-8 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2">
            <Filter className="w-3.5 h-3.5 text-gray-400" />
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="text-sm text-gray-700 bg-transparent outline-none"
            >
              <option value="all">All Types</option>
              <option value="bug">Bug Reports</option>
              <option value="feature-request">Feature Requests</option>
              <option value="general">General</option>
              <option value="praise">Praise</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
          </div>
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2">
            <select
              value={filterApp}
              onChange={e => setFilterApp(e.target.value)}
              className="text-sm text-gray-700 bg-transparent outline-none"
            >
              <option value="all">All Apps</option>
              {apps.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
          </div>
          <span className="ml-auto text-sm text-gray-400 self-center">{filtered.length} entries</span>
        </div>

        {/* Feedback list */}
        {loading ? (
          <div className="text-center py-20 text-gray-400">Loading feedback…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <MessageSquare className="w-12 h-12 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-400 font-medium">No feedback yet</p>
            <p className="text-sm text-gray-300 mt-1">Use the 💬 Feedback button on any tool page to submit the first one.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map(f => (
              <FeedbackCard
                key={f.id}
                entry={f}
                isAdmin={isAdmin}
                onStatusChange={handleStatusChange}
                onDelete={setDeletingEntry}
              />
            ))}
          </div>
        )}
      </main>

      {deletingEntry && (
        <DeleteConfirmModal
          entry={deletingEntry}
          onClose={() => setDeletingEntry(null)}
          onDeleted={loadFeedback}
        />
      )}
    </div>
  );
}
