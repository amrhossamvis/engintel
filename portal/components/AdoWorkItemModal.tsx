"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, ChevronDown, ExternalLink, Loader2, Search, X } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { Portal } from "@/components/Portal";
import { splitStories, type ParsedStory } from "@/lib/message-format";

const WORK_ITEM_TYPES = ["User Story", "Product Backlog Item", "Task", "Bug", "Feature"];

type Node = { name: string; path: string };
type Parent = { id: number; title: string; type: string };
type RowStatus = "idle" | "busy" | "done" | "error";
type Row = ParsedStory & {
  include: boolean;
  open: boolean;
  status: RowStatus;
  result?: { id: number; url: string };
  error?: string;
};

const ERRORS: Record<string, string> = {
  ado_not_configured: "Connect your Azure DevOps PAT in Settings first.",
  invalid_type: "Pick a valid work item type.",
  missing_title: "Title is required.",
};

export function AdoWorkItemModal({ message, onClose }: { message: string; onClose: () => void }) {
  const { adoPat } = useApp();
  const authHeaders = useMemo<Record<string, string>>(() => {
    const h: Record<string, string> = {};
    if (adoPat) h["x-ado-pat"] = adoPat;
    return h;
  }, [adoPat]);

  const [rows, setRows] = useState<Row[]>(() =>
    splitStories(message).map((s) => ({ ...s, include: true, open: false, status: "idle" as const })),
  );
  const bulk = rows.length > 1;

  const [type, setType] = useState("User Story");
  const [areaPath, setAreaPath] = useState("");
  const [iterationPath, setIterationPath] = useState("");

  const [parent, setParent] = useState<Parent | null>(null);
  const [pquery, setPquery] = useState("");
  const [presults, setPresults] = useState<Parent[]>([]);
  const [psearching, setPsearching] = useState(false);

  const [areas, setAreas] = useState<Node[]>([]);
  const [iterations, setIterations] = useState<Node[]>([]);
  const [warn, setWarn] = useState(false);
  const [busy, setBusy] = useState(false);

  const patchRow = (i: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Area + iteration dropdowns.
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

  // Best-effort write-permission warning.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/ado/workitem/can-create?type=${encodeURIComponent(type)}`, { headers: authHeaders })
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
  }, [type, authHeaders]);

  // Debounced parent title search.
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

  const pending = rows.filter((r) => r.include && r.status !== "done").length;
  const anyDone = rows.some((r) => r.status === "done");
  const canSubmit =
    !busy && pending > 0 && rows.some((r) => r.include && r.status !== "done" && r.title.trim());

  async function submitAll() {
    setBusy(true);
    try {
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        if (!r.include || r.status === "done" || !r.title.trim()) continue;
        patchRow(i, { status: "busy", error: undefined });
        try {
          const res = await fetch("/api/ado/workitem", {
            method: "POST",
            headers: { "content-type": "application/json", ...authHeaders },
            body: JSON.stringify({
              type,
              title: r.title,
              description: r.description,
              areaPath,
              iterationPath,
              parentId: parent?.id,
            }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            patchRow(i, { status: "error", error: ERRORS[data.error] ?? data.error ?? "Create failed." });
          } else {
            patchRow(i, { status: "done", result: data as { id: number; url: string } });
          }
        } catch {
          patchRow(i, { status: "error", error: "Network error." });
        }
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-[8vh]"
        onClick={onClose}
      >
        <div
          className="card w-full max-w-lg rounded-2xl p-6"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label="Create Azure DevOps work item"
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold">
              {bulk ? `Create ${rows.length} ADO work items` : "Create ADO work item"}
            </h2>
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
              Your PAT may not have Work Items <b>write</b> scope — creation could fail. Update it in
              Settings if so.
            </div>
          )}

          <div className="space-y-3">
            <Field label="Type" required>
              <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
                {WORK_ITEM_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Area path" hint="Type to filter, or leave blank for the project default.">
              <input
                list="ado-areas"
                value={areaPath}
                onChange={(e) => setAreaPath(e.target.value)}
                placeholder="Digital\\Team\\Squad"
                className={inputCls}
              />
              <datalist id="ado-areas">
                {areas.map((n) => (
                  <option key={n.path} value={n.path} />
                ))}
              </datalist>
            </Field>

            <Field label="Iteration path" hint="Type to filter, or leave blank.">
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

            <Field label="Parent" hint="Search by title to link these under a Feature / Epic. Optional.">
              {parent ? (
                <div
                  className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                  style={{ borderColor: "var(--hairline)" }}
                >
                  <span className="truncate">
                    <span className="font-mono text-xs text-muted">#{parent.id}</span> {parent.title}
                  </span>
                  <button onClick={() => setParent(null)} className="text-muted hover:text-red">
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
                              setParent(p);
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
              )}
            </Field>

            <div className="pt-1">
              <p className="mb-1 text-xs font-medium">
                {bulk ? `${rows.filter((r) => r.include).length} of ${rows.length} selected` : "Item"}
              </p>
              <div className="space-y-2">
                {rows.map((r, i) => (
                  <StoryRow
                    key={i}
                    row={r}
                    bulk={bulk}
                    onToggle={() => patchRow(i, { include: !r.include })}
                    onOpen={() => patchRow(i, { open: !r.open })}
                    onTitle={(v) => patchRow(i, { title: v })}
                    onDesc={(v) => patchRow(i, { description: v })}
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
                {busy ? "Creating…" : bulk ? `Create ${pending} item${pending === 1 ? "" : "s"}` : "Create"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}

function StoryRow({
  row,
  bulk,
  onToggle,
  onOpen,
  onTitle,
  onDesc,
}: {
  row: Row;
  bulk: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onTitle: (v: string) => void;
  onDesc: (v: string) => void;
}) {
  const locked = row.status === "busy" || row.status === "done";
  return (
    <div className="rounded-lg border" style={{ borderColor: "var(--hairline)" }}>
      <div className="flex items-center gap-2 px-2.5 py-2">
        {bulk && (
          <input
            type="checkbox"
            checked={row.include}
            onChange={onToggle}
            disabled={locked}
            className="h-4 w-4 accent-[var(--red)]"
          />
        )}
        <input
          value={row.title}
          onChange={(e) => onTitle(e.target.value)}
          disabled={locked}
          placeholder="Title"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none disabled:opacity-60"
        />
        <StatusBadge row={row} />
        {(!bulk || row.description) && (
          <button onClick={onOpen} className="text-muted hover:text-ink" aria-label="Toggle description">
            <ChevronDown
              className={`h-4 w-4 transition-transform ${row.open ? "rotate-180" : ""}`}
            />
          </button>
        )}
      </div>
      {(row.open || !bulk) && (
        <div className="border-t px-2.5 py-2" style={{ borderColor: "var(--hairline)" }}>
          <textarea
            value={row.description}
            onChange={(e) => onDesc(e.target.value)}
            disabled={locked}
            rows={bulk ? 3 : 5}
            placeholder="Description"
            className={`${inputCls} disabled:opacity-60`}
          />
          {row.error && <p className="mt-1 text-xs text-red">{row.error}</p>}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ row }: { row: Row }) {
  if (row.status === "busy") return <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-faint" />;
  if (row.status === "error") return <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red" />;
  if (row.status === "done" && row.result)
    return (
      <a
        href={row.result.url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex shrink-0 items-center gap-1 text-xs text-live"
      >
        <Check className="h-3.5 w-3.5" />#{row.result.id}
        <ExternalLink className="h-3 w-3" />
      </a>
    );
  return null;
}

const inputCls =
  "w-full rounded-lg border border-[var(--hairline)] bg-[var(--canvas)] px-3 py-2 text-sm focus:border-red transition-colors";

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-baseline gap-1.5 text-xs font-medium">
        {label}
        {required && <span className="text-red">*</span>}
        {hint && <span className="font-normal text-faint">— {hint}</span>}
      </span>
      {children}
    </label>
  );
}
