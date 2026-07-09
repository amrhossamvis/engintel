"use client";

import { useState } from "react";
import { ThumbsUp, ThumbsDown, Send, X } from "lucide-react";

export type RatingValue = 1 | 2 | 3 | 4 | 5;

type Props = {
  /** Fires when the user submits their rating (and optional feedback). */
  onSubmit: (rating: RatingValue, feedback?: string) => void;
  /** If already rated in this session, show the value. */
  submitted?: boolean;
};

/**
 * Inline rating widget shown after an assistant message finishes streaming.
 * Thumbs-down (1-2) or thumbs-up (4-5), with an optional feedback textarea.
 */
export function TemplateRating({ onSubmit, submitted }: Props) {
  const [choice, setChoice] = useState<"up" | "down" | null>(null);
  const [feedback, setFeedback] = useState("");
  const [done, setDone] = useState(submitted ?? false);

  if (done) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-live font-medium select-none">
        ✓ Thanks for your feedback
      </span>
    );
  }

  function submit(rating: RatingValue, text?: string) {
    onSubmit(rating, text?.trim() || undefined);
    setDone(true);
  }

  if (!choice) {
    return (
      <span className="inline-flex items-center gap-3 text-xs text-muted select-none">
        <span>Was this helpful?</span>
        <button
          onClick={() => setChoice("up")}
          className="inline-flex items-center gap-1 hover:text-live transition-colors"
          aria-label="Helpful"
        >
          <ThumbsUp className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => setChoice("down")}
          className="inline-flex items-center gap-1 hover:text-red transition-colors"
          aria-label="Not helpful"
        >
          <ThumbsDown className="h-3.5 w-3.5" />
        </button>
      </span>
    );
  }

  const ratingVal: RatingValue = choice === "up" ? 5 : 2;

  return (
    <div className="mt-2 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted">
          {choice === "up" ? "👍 Great!" : "👎 Sorry about that."}
          {" "}Any details? (optional)
        </span>
        <button
          onClick={() => submit(ratingVal)}
          className="text-xs text-muted hover:text-ink transition-colors"
          aria-label="Skip feedback"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex items-end gap-2">
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder={choice === "up" ? "What did you like?" : "What could be better?"}
          rows={2}
          className="flex-1 rounded-lg bg-[var(--canvas)] border border-[var(--hairline)] px-3 py-2 text-xs resize-none focus:border-red transition-colors placeholder:text-faint"
          maxLength={500}
        />
        <button
          onClick={() => submit(ratingVal, feedback)}
          className="grid place-items-center h-8 w-8 rounded-lg bg-red text-white hover:opacity-90 transition-opacity shrink-0"
          aria-label="Submit feedback"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

