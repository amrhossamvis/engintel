"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function InstallBox({ id, cmd }: { id: string; cmd: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    fetch(`/api/skills/${id}/install`, { method: "POST" }).catch(() => {});
    try {
      await navigator.clipboard.writeText(cmd);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked — command stays visible in the box
    }
  }

  return (
    <button
      onClick={copy}
      className="group flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left font-mono text-sm"
      style={{ borderColor: "var(--hairline)", background: "var(--panel-2)" }}
    >
      <span className="truncate">
        <span className="text-faint">$ </span>
        {cmd}
      </span>
      {copied ? (
        <Check size={16} className="shrink-0 text-red" />
      ) : (
        <Copy size={16} className="shrink-0 text-muted group-hover:text-red" />
      )}
    </button>
  );
}
