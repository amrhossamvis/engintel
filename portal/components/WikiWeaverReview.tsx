"use client";

import { useState } from "react";
import { CircleAlert, CircleCheck, ExternalLink, FileDown, Loader, Send } from "lucide-react";
import { useApp, type WikiDraft } from "./AppProvider";
import { Markdown } from "./Markdown";
import { markdownToDocxBlob, downloadBlob } from "@/lib/markdown-to-docx";

function safeFilename(value: string): string {
  const cleaned = value.replace(/[\\/:*?"<>|]+/g, "-").trim();
  return (cleaned.length > 150 ? cleaned.slice(0, 150) : cleaned) || "wiki-page";
}

/**
 * Renders a Wiki Weaver draft for review and offers two explicit follow-up
 * actions instead of auto-publishing: post it to the target ADO wiki page, or
 * export it as a Word document. Neither action is taken until the user picks
 * one — this is the human-in-the-loop step between generation and publish.
 */
export function WikiWeaverReview({ draft }: { draft: WikiDraft }) {
  const { adoPat } = useApp();
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState<{ url: string } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePublish() {
    setPublishing(true);
    setError(null);
    try {
      const res = await fetch("/api/wiki-weaver/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: draft.content,
          rootType: draft.rootType,
          rootId: draft.rootId,
          rootTitle: draft.rootTitle,
          wikiParentUrl: draft.wikiParentUrl,
          postSummaryComment: draft.postSummaryComment,
          adoPat,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "Publish failed");
      setPublished({ url: data.webUrl });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Publish failed");
    } finally {
      setPublishing(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    setError(null);
    try {
      const blob = await markdownToDocxBlob(draft.content);
      downloadBlob(blob, `${safeFilename(`${draft.rootType} ${draft.rootId} - ${draft.rootTitle}`)}.docx`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="mt-5">
      <p className="kicker mb-2">Generated wiki page — review before publishing</p>

      <div
        className="rounded-xl border p-4 max-h-96 overflow-y-auto"
        style={{ borderColor: "var(--hairline)" }}
      >
        <Markdown source={draft.content} />
      </div>

      {error && (
        <p className="mt-2 flex items-center gap-1.5 text-xs" style={{ color: "var(--red)" }}>
          <CircleAlert className="h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}

      {published ? (
        <div className="mt-3 flex items-center gap-2 text-sm" style={{ color: "var(--live)" }}>
          <CircleCheck className="h-4 w-4 shrink-0" />
          <span>Published.</span>
          <a href={published.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline">
            Open wiki page <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2.5">
          <button
            onClick={handlePublish}
            disabled={publishing || exporting}
            className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium text-white disabled:opacity-60 transition-colors"
            style={{ background: "var(--red)" }}
          >
            {publishing ? <Loader className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            {publishing ? "Publishing…" : "Post to wiki page"}
          </button>
          <button
            onClick={handleExport}
            disabled={publishing || exporting}
            className="inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-sm font-medium disabled:opacity-60 transition-colors hover:bg-white/5"
            style={{ borderColor: "var(--hairline-strong)" }}
          >
            {exporting ? <Loader className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
            {exporting ? "Exporting…" : "Export as Word doc"}
          </button>
        </div>
      )}
    </div>
  );
}
