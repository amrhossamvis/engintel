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
      <span className="inline-flex items-center gap-2.5 text-xs text-muted select-none">
        <span>Helpful?</span>
        <button
          onClick={() => setChoice("up")}
          className="inline-flex h-6 w-6 items-center justify-center rounded-md hover:bg-[var(--panel)] hover:text-live transition-colors"
          aria-label="Helpful"
        >
          <ThumbsUp className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => setChoice("down")}
          className="inline-flex h-6 w-6 items-center justify-center rounded-md hover:bg-[var(--panel)] hover:text-red transition-colors"
          aria-label="Not helpful"
        >
          <ThumbsDown className="h-3.5 w-3.5" />
        </button>
      </span>
    );
  }

  const ratingVal: RatingValue = choice === "up" ? 5 : 2;

  return (
    <div className="flex max-w-md flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted">
          {choice === "up" ? "👍 Glad it helped." : "👎 Sorry about that."}{" "}
          <span className="text-faint">Any details? (optional)</span>
        </span>
        <button
          onClick={() => submit(ratingVal)}
          className="inline-flex h-5 w-5 items-center justify-center rounded text-faint hover:text-ink transition-colors"
          aria-label="Skip feedback"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex items-center gap-1.5 rounded-xl border border-[var(--hairline)] bg-[var(--canvas)] px-3 py-1.5 transition-colors focus-within:border-red">
        <input
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit(ratingVal, feedback);
          }}
          placeholder={choice === "up" ? "What did you like?" : "What could be better?"}
          className="flex-1 bg-transparent text-xs outline-none placeholder:text-faint"
          maxLength={500}
        />
        <button
          onClick={() => submit(ratingVal, feedback)}
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-muted hover:text-red transition-colors"
          aria-label="Submit feedback"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

