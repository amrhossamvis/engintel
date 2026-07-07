"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

export function DeleteSkillButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function del() {
    setBusy(true);
    const res = await fetch(`/api/skills/${id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/skills");
      router.refresh();
      return;
    }
    setBusy(false);
    setConfirming(false);
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-red"
      >
        <Trash2 size={13} /> Delete
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 text-xs">
      <span className="text-muted">Delete “{name}”?</span>
      <button onClick={del} disabled={busy} className="font-medium text-red disabled:opacity-50">
        {busy ? "Deleting…" : "Yes"}
      </button>
      <button onClick={() => setConfirming(false)} className="text-muted">Cancel</button>
    </span>
  );
}
