"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, ExternalLink, Loader2, Plus, Search, Trash2, X } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { Portal } from "@/components/Portal";
import { splitMessage } from "@/lib/message-format";

const STORY_TYPES = ["User Story", "Task", "Bug"];

type Node = { name: string; path: string };
type Parent = { id: number; title: string; type: string };
type ItemStatus = "idle" | "busy" | "done" | "error";
type Result = { id: number; url: string };

type Story = {
  uid: string;
  type: string;
  title: string;
  description: string;
  status: ItemStatus;
  result?: Result;
  error?: string;
};

type FeatureMode = "none" | "new" | "link";

const ERRORS: Record<string, string> = {
  ado_not_configured: "Connect your Azure DevOps PAT in Settings first.",
  invalid_type: "Pick a valid work item type.",
  missing_title: "Title is required.",
};

function newStory(seed?: { title: string; description: string }): Story {
  return {
    uid: crypto.randomUUID(),
    type: "User Story",
    title: seed?.title ?? "",
    description: seed?.description ?? "",
    status: "idle",
  };
}

export function AdoWorkItemModal({ message, onClose }: { message: string; onClose: () => void }) {
  const { adoPat } = useApp();
  const authHeaders = useMemo<Record<string, string>>(() => {
    const h: Record<string, string> = {};
    if (adoPat) h["x-ado-pat"] = adoPat;
    return h;
  }, [adoPat]);

  const [stories, setStories] = useState<Story[]>(() => [newStory(splitMessage(message))]);

  const [featureMode, setFeatureMode] = useState<FeatureMode>("none");
  const [featureTitle, setFeatureTitle] = useState("");
  const [featureDescription, setFeatureDescription] = useState("");
  const [featureStatus, setFeatureStatus] = useState<ItemStatus>("idle");
  const [featureResult, setFeatureResult] = useState<Result | null>(null);
  const [featureError, setFeatureError] = useState("");

  const [linkParent, setLinkParent] = useState<Parent | null>(null);
  const [pquery, setPquery] = useState("");
  const [presults, setPresults] = useState<Parent[]>([]);
  const [psearching, setPsearching] = useState(false);

  const [areaPath, setAreaPath] = useState("");
  const [iterationPath, setIterationPath] = useState("");
  const [areas, setAreas] = useState<Node[]>([]);
  const [iterations, setIterations] = useState<Node[]>([]);

  const [warn, setWarn] = useState(false);
  const [busy, setBusy] = useState(false);

  const patchStory = (uid: string, patch: Partial<Story>) =>
    setStories((ss) => ss.map((s) => (s.uid === uid ? { ...s, ...patch } : s)));

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    async function load(kind: "areas" | "iterations", set: (n: Node[]) => void) {
      try {
        const res = await fetch(`/api/ado/classification?kind=${kind}`, { headers: authHeaders });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { nodes?: Node[] };
        if (!cancelled) set(data.nodes ?? []);
      } catch {
        // dropdowns stay empty — fields remain free-text
      }
    }
    load("areas", setAreas);
    load("iterations", setIterations);
    return () => {
      cancelled = true;
    };
  }, [authHeaders]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/ado/workitem/can-create?type=User%20Story`, { headers: authHeaders })
      .then((r) => r.json())
      .then((d: { canCreate?: boolean }) => {
        if (!cancelled) setWarn(d.canCreate === false);
      })
      .catch(() => {
        if (!cancelled) setWarn(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authHeaders]);

  useEffect(() => {
    const q = pquery.trim();
    const h = setTimeout(async () => {
      if (q.length < 2) {
        setPresults([]);
        return;
      }
      setPsearching(true);
      try {
        const res = await fetch(`/api/ado/workitem/search?q=${encodeURIComponent(q)}`, {
          headers: authHeaders,
        });
        const data = (await res.json()) as { items?: Parent[] };
        setPresults(res.ok ? data.items ?? [] : []);
      } catch {
        setPresults([]);
      } finally {
        setPsearching(false);
      }
    }, 300);
    return () => clearTimeout(h);
  }, [pquery, authHeaders]);

  async function createOne(body: Record<string, unknown>): Promise<{ ok: true; result: Result } | { ok: false; error: string }> {
    try {
      const res = await fetch("/api/ado/workitem", {
        method: "POST",
        headers: { "content-type": "application/json", ...authHeaders },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: ERRORS[data.error] ?? data.error ?? "Create failed." };
      return { ok: true, result: data as Result };
    } catch {
      return { ok: false, error: "Network error." };
    }
  }

  const pendingStories = stories.filter((s) => s.status !== "done" && s.title.trim());
  const anyDone = featureStatus === "done" || stories.some((s) => s.status === "done");
  const canSubmit =
    !busy &&
    pendingStories.length > 0 &&
    (featureMode !== "new" || featureResult !== null || featureTitle.trim().length > 0) &&
    (featureMode !== "link" || linkParent !== null);

  async function submitAll() {
    setBusy(true);
    try {
      let parentId: number | undefined;

      if (featureMode === "link") parentId = linkParent?.id;

      if (featureMode === "new") {
        if (featureResult) {
          parentId = featureResult.id;
        } else {
          if (!featureTitle.trim()) {
            setFeatureError("Feature title is required.");
            return;
          }
          setFeatureStatus("busy");
          setFeatureError("");
          const res = await createOne({
            type: "Feature",
            title: featureTitle,
            description: featureDescription,
            areaPath,
            iterationPath,
          });
          if (!res.ok) {
            setFeatureStatus("error");
            setFeatureError(res.error);
            return; // don't orphan stories under a failed feature
          }
          setFeatureStatus("done");
          setFeatureResult(res.result);
          parentId = res.result.id;
        }
      }

      for (const s of stories) {
        if (s.status === "done" || !s.title.trim()) continue;
        patchStory(s.uid, { status: "busy", error: undefined });
        const res = await createOne({
          type: s.type,
          title: s.title,
          description: s.description,
          areaPath,
          iterationPath,
          parentId,
        });
        if (res.ok) patchStory(s.uid, { status: "done", result: res.result });
        else patchStory(s.uid, { status: "error", error: res.error });
      }
    } finally {
      setBusy(false);
    }
  }

  const modeBtn = (m: FeatureMode, label: string) => (
    <button
      onClick={() => setFeatureMode(m)}
      className="rounded-full border px-3 py-1 text-xs transition-colors"
      style={
        featureMode === m
          ? { borderColor: "var(--red)", color: "var(--red)" }
          : { borderColor: "var(--hairline)", color: "var(--muted)" }
      }
    >
      {label}
    </button>
  );

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-[6vh]"
        onClick={onClose}
      >
        <div
          className="card w-full max-w-lg rounded-2xl p-6"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label="Create Azure DevOps work items"
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold">Create ADO work items</h2>
            <button onClick={onClose} aria-label="Close" className="text-muted hover:text-red">
              <X size={18} />
            </button>
          </div>

          {warn && (
            <div
              className="mb-4 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs"
              style={{ borderColor: "var(--hairline)", color: "var(--muted)" }}
            >
              <AlertTriangle className="h-4 w-4 shrink-0" style={{ color: "var(--red)" }} />
              Your PAT may not have Work Items <b>write</b> scope — creation could fail.
            </div>
          )}

          <div className="space-y-4">
            {/* Feature / parent */}
            <div>
              <div className="mb-1.5 flex items-center gap-2">
                <span className="text-xs font-medium">Feature / parent</span>
                <div className="flex gap-1.5">
                  {modeBtn("none", "None")}
                  {modeBtn("new", "New")}
                  {modeBtn("link", "Link existing")}
                </div>
              </div>

              {featureMode === "new" && (
                <div className="rounded-lg border p-2.5 space-y-2" style={{ borderColor: "var(--hairline)" }}>
                  <div className="flex items-center gap-2">
                    <input
                      value={featureTitle}
                      onChange={(e) => setFeatureTitle(e.target.value)}
                      disabled={featureStatus === "done" || featureStatus === "busy"}
                      placeholder="Feature title"
                      className="min-w-0 flex-1 bg-transparent text-sm outline-none disabled:opacity-60"
                    />
                    <ItemBadge status={featureStatus} result={featureResult ?? undefined} />
                  </div>
                  <textarea
                    value={featureDescription}
                    onChange={(e) => setFeatureDescription(e.target.value)}
                    disabled={featureStatus === "done" || featureStatus === "busy"}
                    rows={2}
                    placeholder="Feature description (optional)"
                    className={`${inputCls} disabled:opacity-60`}
                  />
                  {featureError && <p className="text-xs text-red">{featureError}</p>}
                </div>
              )}

              {featureMode === "link" &&
                (linkParent ? (
                  <div
                    className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                    style={{ borderColor: "var(--hairline)" }}
                  >
                    <span className="truncate">
                      <span className="font-mono text-xs text-muted">#{linkParent.id}</span>{" "}
                      {linkParent.title}
                    </span>
                    <button onClick={() => setLinkParent(null)} className="text-muted hover:text-red">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="flex items-center gap-2">
                      <Search className="h-3.5 w-3.5 text-faint" />
                      <input
                        value={pquery}
                        onChange={(e) => setPquery(e.target.value)}
                        placeholder="Search parent by title…"
                        className={inputCls}
                      />
                      {psearching && <Loader2 className="h-3.5 w-3.5 animate-spin text-faint" />}
                    </div>
                    {presults.length > 0 && (
                      <ul
                        className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border bg-[var(--panel-2)] py-1 shadow-lg"
                        style={{ borderColor: "var(--hairline)" }}
                      >
                        {presults.map((p) => (
                          <li key={p.id}>
                            <button
                              onClick={() => {
                                setLinkParent(p);
                                setPquery("");
                                setPresults([]);
                              }}
                              className="block w-full px-3 py-1.5 text-left text-sm hover:bg-white/5"
                            >
                              <span className="font-mono text-xs text-muted">#{p.id}</span> {p.title}
                              <span className="ml-1 text-xs text-faint">· {p.type}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
            </div>

            {/* Shared paths */}
            <div className="grid grid-cols-2 gap-2">
              <Field label="Area path">
                <input
                  list="ado-areas"
                  value={areaPath}
                  onChange={(e) => setAreaPath(e.target.value)}
                  placeholder="Digital\\Squad"
                  className={inputCls}
                />
                <datalist id="ado-areas">
                  {areas.map((n) => (
                    <option key={n.path} value={n.path} />
                  ))}
                </datalist>
              </Field>
              <Field label="Iteration path">
                <input
                  list="ado-iterations"
                  value={iterationPath}
                  onChange={(e) => setIterationPath(e.target.value)}
                  placeholder="Digital\\Sprint 42"
                  className={inputCls}
                />
                <datalist id="ado-iterations">
                  {iterations.map((n) => (
                    <option key={n.path} value={n.path} />
                  ))}
                </datalist>
              </Field>
            </div>

            {/* Stories */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-xs font-medium">
                  {featureMode === "none" ? "Items" : "Child stories"}
                </span>
                <button
                  onClick={() => setStories((ss) => [...ss, newStory()])}
                  className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink"
                >
                  <Plus className="h-3.5 w-3.5" /> Add story
                </button>
              </div>
              <div className="space-y-2">
                {stories.map((s) => (
                  <StoryBox
                    key={s.uid}
                    story={s}
                    removable={stories.length > 1}
                    onType={(v) => patchStory(s.uid, { type: v })}
                    onTitle={(v) => patchStory(s.uid, { title: v })}
                    onDesc={(v) => patchStory(s.uid, { description: v })}
                    onRemove={() => setStories((ss) => ss.filter((x) => x.uid !== s.uid))}
                  />
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={onClose}
                className="rounded-full border px-4 py-1.5 text-sm text-muted"
                style={{ borderColor: "var(--hairline)" }}
              >
                {anyDone ? "Close" : "Cancel"}
              </button>
              <button
                onClick={submitAll}
                disabled={!canSubmit}
                className="inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm disabled:opacity-50"
                style={{ borderColor: "var(--red)", color: "var(--red)" }}
              >
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {busy ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}

function StoryBox({
  story,
  removable,
  onType,
  onTitle,
  onDesc,
  onRemove,
}: {
  story: Story;
  removable: boolean;
  onType: (v: string) => void;
  onTitle: (v: string) => void;
  onDesc: (v: string) => void;
  onRemove: () => void;
}) {
  const locked = story.status === "busy" || story.status === "done";
  return (
    <div className="rounded-lg border p-2.5 space-y-2" style={{ borderColor: "var(--hairline)" }}>
      <div className="flex items-center gap-2">
        <select
          value={story.type}
          onChange={(e) => onType(e.target.value)}
          disabled={locked}
          className="shrink-0 rounded-md border border-[var(--hairline)] bg-[var(--canvas)] px-2 py-1 text-xs"
        >
          {STORY_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <input
          value={story.title}
          onChange={(e) => onTitle(e.target.value)}
          disabled={locked}
          placeholder="Title"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none disabled:opacity-60"
        />
        <ItemBadge status={story.status} result={story.result} />
        {removable && !locked && (
          <button onClick={onRemove} className="text-muted hover:text-red" aria-label="Remove story">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <textarea
        value={story.description}
        onChange={(e) => onDesc(e.target.value)}
        disabled={locked}
        rows={3}
        placeholder="Description"
        className={`${inputCls} disabled:opacity-60`}
      />
      {story.error && <p className="text-xs text-red">{story.error}</p>}
    </div>
  );
}

function ItemBadge({ status, result }: { status: ItemStatus; result?: Result }) {
  if (status === "busy") return <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-faint" />;
  if (status === "error") return <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red" />;
  if (status === "done" && result)
    return (
      <a
        href={result.url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex shrink-0 items-center gap-1 text-xs text-live"
      >
        <Check className="h-3.5 w-3.5" />#{result.id}
        <ExternalLink className="h-3 w-3" />
      </a>
    );
  return null;
}

const inputCls =
  "w-full rounded-lg border border-[var(--hairline)] bg-[var(--canvas)] px-3 py-2 text-sm focus:border-red transition-colors";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium">{label}</span>
      {children}
    </label>
  );
}
