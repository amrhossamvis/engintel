'use client';

import { useState } from 'react';
import { MessageSquare, X, Star, Bug, Sparkles, ThumbsUp, Send, CheckCircle2 } from 'lucide-react';

type FeedbackType = 'bug' | 'feature-request' | 'general' | 'praise';

const TYPES: { value: FeedbackType; label: string; icon: React.ReactNode; color: string; activeColor: string }[] = [
  { value: 'bug',              label: 'Bug',     icon: <Bug className="w-3.5 h-3.5" />,       color: 'border-gray-200 text-gray-500',         activeColor: 'border-red-400 bg-red-50 text-red-600' },
  { value: 'feature-request', label: 'Feature', icon: <Sparkles className="w-3.5 h-3.5" />,  color: 'border-gray-200 text-gray-500',         activeColor: 'border-violet-400 bg-violet-50 text-violet-600' },
  { value: 'general',         label: 'General', icon: <MessageSquare className="w-3.5 h-3.5" />, color: 'border-gray-200 text-gray-500',     activeColor: 'border-blue-400 bg-blue-50 text-blue-600' },
  { value: 'praise',          label: 'Praise',  icon: <ThumbsUp className="w-3.5 h-3.5" />,  color: 'border-gray-200 text-gray-500',         activeColor: 'border-emerald-400 bg-emerald-50 text-emerald-600' },
];

type Props = {
  appId: string;
  appName: string;
};

export function FeedbackWidget({ appId, appName }: Props) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>('general');
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [message, setMessage] = useState('');
  const [contactConsent, setContactConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim() || rating === 0) return;
    setSubmitting(true);
    await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appId,
        appName,
        type,
        rating,
        message,
        contactConsent,
        sessionContext: { page: typeof window !== 'undefined' ? window.location.pathname : '' },
      }),
    });
    setSubmitting(false);
    setSubmitted(true);
    setTimeout(() => {
      setOpen(false);
      setSubmitted(false);
      setMessage('');
      setRating(0);
      setType('general');
      setContactConsent(false);
    }, 2500);
  }

  const displayRating = hoverRating || rating;

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-white border border-gray-200 shadow-lg text-sm font-medium text-gray-600 hover:shadow-xl hover:border-gray-300 hover:-translate-y-0.5 transition-all duration-200"
      >
        <MessageSquare className="w-4 h-4 text-blue-500" />
        Feedback
      </button>

      {/* Slide-over panel */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
          />

          {/* Panel */}
          <div className="fixed bottom-0 right-0 z-50 w-full sm:w-[400px] sm:bottom-6 sm:right-6 bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-gray-200 overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center">
                  <MessageSquare className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">Share Feedback</p>
                  <p className="text-xs text-gray-400">{appName}</p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            {submitted ? (
              /* Success state */
              <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                </div>
                <h3 className="font-bold text-gray-900 mb-1">Thanks for your feedback!</h3>
                <p className="text-sm text-gray-400">Your input helps us improve the Engineering Intelligence Hub.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="p-5 space-y-4">

                {/* Type selector */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Type</label>
                  <div className="grid grid-cols-4 gap-2">
                    {TYPES.map(t => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setType(t.value)}
                        className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl border text-xs font-medium transition-all ${type === t.value ? t.activeColor : t.color + ' hover:bg-gray-50'}`}
                      >
                        {t.icon}
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Star rating */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Rating <span className="text-red-400">*</span>
                  </label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setRating(s)}
                        onMouseEnter={() => setHoverRating(s)}
                        onMouseLeave={() => setHoverRating(0)}
                        className="p-1 transition-transform hover:scale-110"
                      >
                        <Star
                          className={`w-7 h-7 transition-colors ${
                            s <= displayRating
                              ? 'text-amber-400 fill-amber-400'
                              : 'text-gray-200 hover:text-amber-300'
                          }`}
                        />
                      </button>
                    ))}
                    {displayRating > 0 && (
                      <span className="ml-2 text-sm text-gray-400 self-center">
                        {['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'][displayRating]}
                      </span>
                    )}
                  </div>
                </div>

                {/* Message */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Message <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder={
                      type === 'bug' ? 'Describe what went wrong…' :
                      type === 'feature-request' ? 'What would you like to see?' :
                      type === 'praise' ? 'What did you love about this tool?' :
                      'Share your thoughts…'
                    }
                    rows={4}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                    required
                  />
                </div>

                {/* Contact consent */}
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={contactConsent}
                    onChange={e => setContactConsent(e.target.checked)}
                    className="mt-0.5 accent-blue-500"
                  />
                  <span className="text-xs text-gray-500 leading-relaxed">
                    I&apos;m happy to be contacted for follow-up on this feedback
                  </span>
                </label>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={submitting || !message.trim() || rating === 0}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {submitting ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  {submitting ? 'Sending…' : 'Send Feedback'}
                </button>
              </form>
            )}
          </div>
        </>
      )}
    </>
  );
}
