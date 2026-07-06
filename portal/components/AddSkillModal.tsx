"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { buildInstallCmd, slugify } from "@/lib/skills";
import { useApp } from "@/components/AppProvider";
import { Portal } from "@/components/Portal";

const ERRORS: Record<string, string> = {
  missing_fields: "Name and description are required.",
  duplicate_slug: "A skill with this name already exists.",
  not_configured: "Skills storage is not configured.",
  bad_request: "Something went wrong. Check your input.",
};

export function AddSkillModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { adoIdentity } = useApp();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tag, setTag] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [installCmd, setInstallCmd] = useState("");
  const [summary, setSummary] = useState("");
  const [readme, setReadme] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit() {
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/skills", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, description, tag, repoUrl, installCmd, summary, readme, authorName: adoIdentity }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(ERRORS[d.error] ?? "Upload failed.");
        return;
      }
      onDone();
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
        aria-label="Add a skill"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">Add a skill</h2>
          <button onClick={onClose} aria-label="Close" className="text-muted hover:text-red">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3">
          <Field label="Name" required>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="frontend-design" className={inputCls} />
          </Field>
          <Field label="Description" required>
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="One-line summary of what it does" className={inputCls} />
          </Field>
          <Field label="Tag">
            <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Agent workflows" className={inputCls} />
          </Field>
          <Field label="Repository URL" hint="Any host. Public github.com repos auto-pull SKILL.md + stars.">
            <input value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} placeholder="https://github.com/org/repo" className={inputCls} />
          </Field>
          <Field label="Installation command" hint="Leave blank to auto-generate from the repo + name.">
            <input
              value={installCmd}
              onChange={(e) => setInstallCmd(e.target.value)}
              placeholder={buildInstallCmd(repoUrl.trim() || null, slugify(name) || "skill-name")}
              className={`${inputCls} font-mono`}
            />
          </Field>
          <Field label="Summary bullets" hint="One per line. Optional.">
            <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} placeholder={"- Does X\n- Handles Y"} className={inputCls} />
          </Field>
          <Field label="SKILL.md" hint="Paste content, or leave blank to auto-fetch from a public repo.">
            <textarea value={readme} onChange={(e) => setReadme(e.target.value)} rows={4} placeholder="# My Skill\n\n..." className={inputCls} />
          </Field>

          {error && <p className="text-xs text-red">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onClose} className="rounded-full border px-4 py-1.5 text-sm text-muted" style={{ borderColor: "var(--hairline)" }}>
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={busy || !name.trim() || !description.trim()}
              className="rounded-full border px-4 py-1.5 text-sm disabled:opacity-50"
              style={{ borderColor: "var(--red)", color: "var(--red)" }}
            >
              {busy ? "Publishing…" : "Publish"}
            </button>
          </div>
        </div>
      </div>
    </div>
    </Portal>
  );
}

const inputCls = "w-full rounded-lg border px-3 py-2 text-sm";

function Field({ label, hint, required, children }: {
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
      <span className="[&_input]:border-[var(--hairline)] [&_textarea]:border-[var(--hairline)]">{children}</span>
    </label>
  );
}
