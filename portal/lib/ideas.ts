export const DOMAINS = [
  "Mobile Guild",
  "Web Guild",
  "Backend Guild",
  "Platform & Infrastructure",
  "Quality & Testing",
  "Delivery Excellence",
  "Engineering Productivity",
  "AI Value & Knowledge",
  "Design",
  "Data & Analytics",
  "Security",
  "Other",
] as const;
export type Domain = (typeof DOMAINS)[number];

export const STATUSES = [
  "new",
  "under_review",
  "planned",
  "in_progress",
  "shipped",
  "declined",
] as const;
export type IdeaStatus = (typeof STATUSES)[number];

export const IMPACTS = ["low", "medium", "high"] as const;
export type IdeaImpact = (typeof IMPACTS)[number];

export type SortKey = "votes" | "new";

/** A card sports the Trending badge once it clears this many votes. */
export const TRENDING_VOTES = 10;

export const MAX_TAGS = 6;
const MAX_TAG_LEN = 24;

/** Trim, dedupe, cap. Used by both create and admin-edit so the rules live once. */
export function normalizeTags(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  for (const raw of input) {
    if (typeof raw !== "string") continue;
    const t = raw.trim().slice(0, MAX_TAG_LEN);
    if (t && !out.includes(t)) out.push(t);
    if (out.length >= MAX_TAGS) break;
  }
  return out;
}

export type IdeaListItem = {
  id: string;
  title: string;
  body: string;
  domain: string;
  status: IdeaStatus;
  impact: IdeaImpact | null;
  tags: string[];
  authorName: string | null;
  isAnonymous: boolean;
  pinned: boolean;
  voteCount: number;
  commentCount: number;
  hasVoted: boolean;
  createdAt: string;
};

export type IdeaStats = {
  total: number;
  votes: number;
  inPipeline: number;
  shipped: number;
};

export type Comment = {
  id: string;
  authorName: string | null;
  isAnonymous: boolean;
  body: string;
  createdAt: string;
};

export type IdeaDetail = IdeaListItem & {
  proposedSolution: string | null;
  comments: Comment[];
  isAdmin: boolean;
};

export function statusMeta(s: IdeaStatus): { label: string; token: string } {
  switch (s) {
    case "under_review":
      return { label: "Under Review", token: "var(--soon)" };
    case "planned":
      return { label: "Planned", token: "var(--info)" };
    case "in_progress":
      return { label: "In Progress", token: "var(--red)" };
    case "shipped":
      return { label: "Shipped", token: "var(--live)" };
    case "declined":
      return { label: "Declined", token: "var(--muted)" };
    default:
      return { label: "New", token: "var(--muted)" };
  }
}

export function impactMeta(i: IdeaImpact): { label: string; token: string } {
  switch (i) {
    case "high":
      return { label: "High Impact", token: "var(--live)" };
    case "medium":
      return { label: "Medium Impact", token: "var(--soon)" };
    default:
      return { label: "Low Impact", token: "var(--muted)" };
  }
}

export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const secs = Math.max(1, Math.floor((Date.now() - then) / 1000));
  const units: [number, string][] = [
    [60, "s"],
    [60, "m"],
    [24, "h"],
    [7, "d"],
    [4.35, "w"],
    [12, "mo"],
    [Number.POSITIVE_INFINITY, "y"],
  ];
  let val = secs;
  let unit = "s";
  for (const [step, label] of units) {
    if (val < step) {
      unit = label;
      break;
    }
    val = Math.floor(val / step);
    unit = label;
  }
  return `${val}${unit} ago`;
}
