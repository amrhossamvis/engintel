"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Bug, MessageSquare, Send, Sparkles, Star, ThumbsUp, X, type LucideIcon } from "lucide-react";
import { FEEDBACK_TYPES, MAX_MESSAGE, ratingRequired, type FeedbackType } from "@/lib/feedback";
import { clientKey } from "./session";
import { useApp } from "./AppProvider";

const TYPE_ICON: Record<FeedbackType, LucideIcon> = {
  bug: Bug,
  feature: Sparkles,
  general: MessageSquare,
  praise: ThumbsUp,
};
const TYPE_LABEL: Record<FeedbackType, string> = {
  bug: "Bug",
  feature: "Feature",
  general: "General",
  praise: "Praise",
};

export function FeedbackButton({
  capabilityId = null,
  capabilityTitle,
  variant = "pill",
}: {
  capabilityId?: string | null;
  capabilityTitle?: string;
  variant?: "pill" | "icon" | "fab";
}) {
  const { detailCap, launchCap } = useApp();
  const [open, setOpen] = useState(false);

  // The global FAB adopts whichever capability is on screen (detail modal or launch form),
  // so feedback sent from it is tagged to that app instead of falling back to General.
  const contextCap = variant === "fab" && !capabilityId ? detailCap ?? launchCap : null;
  const effId = capabilityId ?? contextCap?.id ?? null;
  const effTitle = capabilityTitle ?? contextCap?.name;

  return (
    <>
      {variant === "fab" ? (
        <motion.button
          onClick={() => setOpen(true)}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4, type: "spring", damping: 18, stiffness: 300 }}
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          className="fixed bottom-6 right-6 z-50 grid place-items-center h-14 w-14 rounded-full text-white"
          style={{
            background: "linear-gradient(180deg, var(--red-bright), var(--red))",
            boxShadow: "0 14px 34px -8px var(--red-glow), inset 0 1px 0 rgba(255,255,255,0.25)",
          }}
          aria-label="Share feedback"
        >
          <MessageSquare className="h-6 w-6" strokeWidth={2} />
        </motion.button>
      ) : variant === "icon" ? (
        <button
          onClick={() => setOpen(true)}
          className="grid place-items-center h-10 w-10 rounded-xl border border-[var(--hairline)] hover:bg-white/5 transition-colors"
          aria-label="Share feedback"
        >
          <MessageSquare className="h-[1.05rem] w-[1.05rem]" />
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 h-10 rounded-xl border border-[var(--hairline)] px-3.5 hover:bg-white/5 transition-colors text-sm font-medium"
        >
          <MessageSquare className="h-[1.05rem] w-[1.05rem]" style={{ color: "var(--red)" }} />
          Feedback
        </button>
      )}
      <AnimatePresence>
        {open && (
          <Drawer
            capabilityId={effId}
            capabilityTitle={effTitle}
            onClose={() => setOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function Drawer({
  capabilityId,
  capabilityTitle,
  onClose,
}: {
  capabilityId: string | null;
  capabilityTitle?: string;
  onClose: () => void;
}) {
  const { adoIdentity } = useApp();
  const asideRef = useRef<HTMLElement>(null);

  const [type, setType] = useState<FeedbackType>("general");
  const [rating, setRating] = useState<number>(0);
  const [hover, setHover] = useState<number>(0);
  const [message, setMessage] = useState("");
  const [name, setName] = useState(adoIdentity ?? "");
  const [anon, setAnon] = useState(false);
  const [contactOk, setContactOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const root = asideRef.current;
      if (!root) return;
      const focusable = Array.from(
        root.querySelectorAll<HTMLElement>(
          'button, textarea, input, select, [href], [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute("disabled"));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Lock background scroll and keep focus inside the drawer; restore both on close.
  useEffect(() => {
    const prevFocus = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    asideRef.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      prevFocus?.focus?.();
    };
  }, []);

  const needsRating = ratingRequired(type);
  const canSubmit = message.trim().length > 0 && (!needsRating || rating > 0) && !busy;
  const missing =
    message.trim().length === 0
      ? "Write a message to send."
      : needsRating && rating === 0
        ? "Add a star rating to send."
        : null;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          rating: rating > 0 ? rating : null,
          message: message.trim(),
          capabilityId,
          contactOk,
          authorKey: clientKey(),
          authorName: anon ? null : name.trim() || null,
          isAnonymous: anon,
        }),
      });
      if (res.status === 501) {
        setError("Feedback storage isn't configured on this deployment.");
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === "string" ? data.error : "Something went wrong.");
        return;
      }
      setDone(true);
      setTimeout(onClose, 1200);
    } catch {
      setError("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <motion.div
        className="scrim fixed inset-0 z-[60]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.aside
        ref={asideRef}
        role="dialog"
        aria-modal="true"
        aria-label="Share feedback"
        tabIndex={-1}
        className="panel fixed right-0 top-0 h-full w-full max-w-[400px] z-[61] border-l flex flex-col outline-none"
        style={{ borderColor: "var(--hairline)" }}
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 32, stiffness: 340 }}
      >
        {/* header */}
        <div
          className="px-6 py-5 border-b flex items-start justify-between gap-4 shrink-0"
          style={{ borderColor: "var(--hairline)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="grid place-items-center h-10 w-10 rounded-xl"
              style={{ background: "rgba(230,0,0,0.12)" }}
            >
              <MessageSquare className="h-5 w-5" style={{ color: "var(--red)" }} />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold leading-tight">Share Feedback</h2>
              <p className="kicker mt-0.5">{capabilityTitle ?? "General"}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="grid place-items-center h-9 w-9 rounded-lg hover:bg-white/5 text-muted hover:text-ink transition-colors shrink-0"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {done ? (
          <div className="flex-1 grid place-items-center px-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="grid place-items-center gap-3 text-center"
            >
              <div
                className="grid place-items-center h-14 w-14 rounded-2xl"
                style={{ background: "rgba(60,232,160,0.14)" }}
              >
                <ThumbsUp className="h-7 w-7 text-live" />
              </div>
              <p className="font-display text-lg font-semibold">Thanks — got it.</p>
              <p className="text-sm text-muted">Your signal just landed on Pulse.</p>
            </motion.div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
              <Field label="Type">
                <div className="grid grid-cols-4 gap-2">
                  {FEEDBACK_TYPES.map((t) => {
                    const Icon = TYPE_ICON[t];
                    const on = type === t;
                    return (
                      <button
                        key={t}
                        onClick={() => setType(t)}
                        className="flex flex-col items-center gap-1.5 rounded-xl border py-2.5 transition-all"
                        style={{
                          borderColor: on ? "var(--red)" : "var(--hairline)",
                          background: on ? "rgba(230,0,0,0.1)" : "transparent",
                          color: on ? "var(--ink)" : "var(--muted)",
                        }}
                      >
                        <Icon
                          className="h-4 w-4"
                          style={{ color: on ? "var(--red)" : "var(--muted)" }}
                        />
                        <span className="text-xs font-medium">{TYPE_LABEL[t]}</span>
                      </button>
                    );
                  })}
                </div>
              </Field>

              <Field label="Rating" required={needsRating}>
                <div className="flex items-center gap-1.5" onMouseLeave={() => setHover(0)}>
                  {[1, 2, 3, 4, 5].map((n) => {
                    const active = (hover || rating) >= n;
                    return (
                      <button
                        key={n}
                        onClick={() => setRating(n === rating ? 0 : n)}
                        onMouseEnter={() => setHover(n)}
                        aria-label={`${n} star${n > 1 ? "s" : ""}`}
                        className="p-0.5"
                      >
                        <Star
                          className="h-6 w-6 transition-colors"
                          style={{ color: active ? "var(--soon)" : "var(--hairline-strong)" }}
                          fill={active ? "var(--soon)" : "none"}
                        />
                      </button>
                    );
                  })}
                </div>
              </Field>

              <Field label="Message" required>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={MAX_MESSAGE}
                  rows={5}
                  placeholder="Share your thoughts…"
                  className="w-full rounded-xl border px-3.5 py-2.5 text-sm resize-none outline-none focus:border-[var(--red)] transition-colors"
                  style={{ borderColor: "var(--hairline)", background: "var(--panel-2)" }}
                />
              </Field>

              <Field label="Your name" hint="optional">
                <input
                  value={anon ? "" : name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={anon}
                  placeholder={anon ? "Anonymous" : "Who's this from?"}
                  className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none focus:border-[var(--red)] transition-colors disabled:opacity-50"
                  style={{ borderColor: "var(--hairline)", background: "var(--panel-2)" }}
                />
              </Field>

              <div className="space-y-3 pt-1">
                <label className="flex items-center gap-2.5 text-sm cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={anon}
                    onChange={(e) => setAnon(e.target.checked)}
                    className="h-4 w-4 accent-[var(--red)]"
                  />
                  <span className="text-[var(--ink-dim)]">Submit anonymously</span>
                </label>

                <label
                  className="flex items-center gap-2.5 text-sm select-none"
                  style={{ opacity: anon ? 0.4 : 1, cursor: anon ? "not-allowed" : "pointer" }}
                >
                  <input
                    type="checkbox"
                    checked={contactOk && !anon}
                    disabled={anon}
                    onChange={(e) => setContactOk(e.target.checked)}
                    className="h-4 w-4 accent-[var(--red)]"
                  />
                  <span className="text-[var(--ink-dim)]">
                    I&apos;m happy to be contacted for follow-up
                  </span>
                </label>
              </div>

              {error && <p className="text-sm text-red">{error}</p>}
            </div>

            {/* footer CTA */}
            <div
              className="px-6 py-4 border-t shrink-0"
              style={{ borderColor: "var(--hairline)" }}
            >
              {missing && !busy && (
                <p className="text-xs text-muted mb-2 text-center">{missing}</p>
              )}
              <button
                onClick={submit}
                disabled={!canSubmit}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 font-medium text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: "linear-gradient(180deg, var(--red-bright), var(--red))",
                  boxShadow: canSubmit ? "0 12px 30px -10px var(--red-glow)" : "none",
                }}
              >
                <Send className="h-4 w-4" />
                {busy ? "Sending…" : "Send Feedback"}
              </button>
            </div>
          </>
        )}
      </motion.aside>
    </>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2.5">
      <p className="kicker">
        {label}
        {required && <span className="text-red"> *</span>}
        {hint && <span className="text-muted normal-case tracking-normal"> · {hint}</span>}
      </p>
      {children}
    </div>
  );
}
