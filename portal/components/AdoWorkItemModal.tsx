"use client";

import { useEffect, useState } from "react";
import { Check, ExternalLink, Loader2, X } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { Portal } from "@/components/Portal";

const WORK_ITEM_TYPES = ["User Story", "Product Backlog Item", "Task", "Bug", "Feature"];

type Node = { name: string; path: string };

/** First meaningful line becomes the title (stripped of markdown lead), the rest the description. */
function splitMessage(msg: string): { title: string; description: string } {
  const lines = msg.split(/\r?\n/);
  const firstIdx = lines.findIndex((l) => l.trim().length > 0);
  if (firstIdx < 0) return { title: "", description: "" };
  const title = lines[firstIdx].replace(/^\s*(#{1,6}|[-*]|\d+\.)\s*/, "").trim().slice(0, 255);
  const description = lines.slice(firstIdx + 1).join("\n").trim();
  return { title, description };
}

const ERRORS: Record<string, string> = {
  ado_not_configured: "Connect your Azure DevOps PAT in Settings first.",
  invalid_type: "Pick a valid work item type.",
  missing_title: "Title is required.",
  fetch_failed: "Couldn't load area/iteration paths.",
};

export function AdoWorkItemModal({ message, onClose }: { message: string; onClose: () => void }) {
  const { adoPat } = useApp();
  const seed = splitMessage(message);

  const [type, setType] = useState("User Story");
  const [title, setTitle] = useState(seed.title);
  const [description, setDescription] = useState(seed.description);
  const [areaPath, setAreaPath] = useState("");
  const [iterationPath, setIterationPath] = useState("");
  const [parentId, setParentId] = useState("");

  const [areas, setAreas] = useState<Node[]>([]);
  const [iterations, setIterations] = useState<Node[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ id: number; url: string } | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const headers: HeadersInit = adoPat ? { "x-ado-pat": adoPat } : {};
    let cancelled = false;
    async function load(kind: "areas" | "iterations", set: (n: Node[]) => void) {
      try {
        const res = await fetch(`/api/ado/classification?kind=${kind}`, { headers });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { nodes?: Node[] };
        if (!cancelled) set(data.nodes ?? []);
      } catch {
        // dropdowns just stay empty — fields are still free-text
      }
    }
    load("areas", setAreas);
    load("iterations", setIterations);
    return () => {
      cancelled = true;
    };
  }, [adoPat]);

  async function submit() {
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/ado/workitem", {
        method: "POST",
        headers: { "content-type": "application/json", ...(adoPat ? { "x-ado-pat": adoPat } : {}) },
        body: JSON.stringify({ type, title, description, areaPath, iterationPath, parentId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(ERRORS[data.error] ?? data.error ?? "Create failed.");
        return;
      }
      setCreated(data as { id: number; url: string });
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
            <h2 className="font-display text-xl font-semibold">Create ADO work item</h2>
            <button onClick={onClose} aria-label="Close" className="text-muted hover:text-red">
              <X size={18} />
            </button>
          </div>

          {created ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-live" />
                Created work item <span className="font-mono">#{created.id}</span>.
              </div>
              <div className="flex justify-end gap-2">
                <a
                  href={created.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm"
                  style={{ borderColor: "var(--red)", color: "var(--red)" }}
                >
                  Open in ADO <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <button
                  onClick={onClose}
                  className="rounded-full border px-4 py-1.5 text-sm text-muted"
                  style={{ borderColor: "var(--hairline)" }}
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
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
              <Field label="Title" required>
                <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Description">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={5}
                  className={inputCls}
                />
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
              <Field label="Parent feature ID" hint="Optional — links this item under an existing work item.">
                <input
                  value={parentId}
                  onChange={(e) => setParentId(e.target.value.replace(/[^\d]/g, ""))}
                  inputMode="numeric"
                  placeholder="4184017"
                  className={`${inputCls} font-mono`}
                />
              </Field>

              {error && <p className="text-xs text-red">{error}</p>}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={onClose}
                  className="rounded-full border px-4 py-1.5 text-sm text-muted"
                  style={{ borderColor: "var(--hairline)" }}
                >
                  Cancel
                </button>
                <button
                  onClick={submit}
                  disabled={busy || !title.trim()}
                  className="inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm disabled:opacity-50"
                  style={{ borderColor: "var(--red)", color: "var(--red)" }}
                >
                  {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {busy ? "Creating…" : "Create"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Portal>
  );
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
