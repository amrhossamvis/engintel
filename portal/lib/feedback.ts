import { CAPABILITIES } from "./capabilities";

export const FEEDBACK_TYPES = ["bug", "feature", "general", "praise"] as const;
export type FeedbackType = (typeof FEEDBACK_TYPES)[number];

export const FEEDBACK_STATUSES = ["new", "reviewed", "resolved"] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export const MAX_MESSAGE = 2000;
export const MAX_NAME = 80;

/** General & Praise need a star rating; Bug & Feature don't. */
export function ratingRequired(t: FeedbackType): boolean {
  return t === "general" || t === "praise";
}

export function typeMeta(t: FeedbackType): { label: string; token: string; icon: string } {
  switch (t) {
    case "bug":
      return { label: "Bug", token: "var(--red)", icon: "Bug" };
    case "feature":
      return { label: "Feature", token: "var(--info)", icon: "Sparkles" };
    case "praise":
      return { label: "Praise", token: "var(--live)", icon: "ThumbsUp" };
    default:
      return { label: "General", token: "var(--muted)", icon: "MessageSquare" };
  }
}

export function statusMeta(s: FeedbackStatus): { label: string; token: string } {
  switch (s) {
    case "reviewed":
      return { label: "Reviewed", token: "var(--info)" };
    case "resolved":
      return { label: "Resolved", token: "var(--live)" };
    default:
      return { label: "New", token: "var(--soon)" };
  }
}

/** capability_id → display name; null / unknown fall back to "General". */
export function appLabel(capabilityId: string | null): string {
  if (!capabilityId) return "General";
  return CAPABILITIES.find((c) => c.id === capabilityId)?.name ?? capabilityId;
}

export type FeedbackItem = {
  id: string;
  capabilityId: string | null;
  type: FeedbackType;
  rating: number | null;
  message: string;
  status: FeedbackStatus;
  contactOk: boolean;
  authorName: string | null;
  isAnonymous: boolean;
  createdAt: string;
};

export type FeedbackStats = {
  total: number;
  avgRating: number | null;
  bugReports: number;
  featureRequests: number;
};

/** counts per star, index 0 = 1★ … index 4 = 5★ */
export type RatingDistribution = [number, number, number, number, number];
