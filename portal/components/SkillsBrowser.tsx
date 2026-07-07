"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FlaskConical, Plus, Search } from "lucide-react";
import type { SkillListItem, SkillSort } from "@/lib/skills";
import { AddSkillModal } from "@/components/AddSkillModal";
import { Sparkline } from "@/components/Sparkline";

const TRY_CMD = "npx skills update";

export function SkillsBrowser() {
  const [skills, setSkills] = useState<SkillListItem[]>([]);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SkillSort>("popular");
  const [reloadNonce, setReloadNonce] = useState(0);
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    let live = true;
    fetch(`/api/skills?q=${encodeURIComponent(q)}&sort=${sort}`)
      .then((r) => r.json())
      .then((data: { skills?: SkillListItem[] }) => live && setSkills(data.skills ?? []))
      .catch(() => live && setSkills([]));
    return () => {
      live = false;
    };
  }, [q, sort, reloadNonce]);

  return (
    <div className="space-y-12">
      <div className="flex items-center justify-end">
        <span className="inline-flex items-center gap-2 text-[0.7rem] font-mono uppercase tracking-wider text-soon">
          <FlaskConical className="h-3.5 w-3.5" /> Experimental
        </span>
      </div>

      <Hero onTry={() => navigator.clipboard?.writeText(TRY_CMD).catch(() => {})} />

      <section>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-mono text-xs uppercase tracking-wider text-faint">Skills Leaderboard</h2>
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-medium"
            style={{ borderColor: "var(--red)", color: "var(--red)" }}
          >
            <Plus size={15} /> Add skill
          </button>
        </div>

        <div className="relative mb-4">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search skills…"
            className="w-full rounded-xl border py-2.5 pl-10 pr-3 text-sm"
            style={{ borderColor: "var(--hairline)", background: "var(--panel-2)" }}
          />
        </div>

        <div className="mb-2 flex gap-5 border-b text-sm" style={{ borderColor: "var(--hairline)" }}>
          <Tab active={sort === "popular"} onClick={() => setSort("popular")}>All Time</Tab>
          <Tab active={sort === "trending"} onClick={() => setSort("trending")}>Trending</Tab>
          <Tab active={sort === "hot"} onClick={() => setSort("hot")}>Hot</Tab>
          <Tab active={sort === "new"} onClick={() => setSort("new")}>Newest</Tab>
        </div>

        <ol>
          {skills.map((s, i) => (
            <Row key={s.id} rank={i + 1} skill={s} />
          ))}
          {skills.length === 0 && (
            <li className="py-10 text-center text-sm text-faint">
              No skills yet. Publish the first one.
            </li>
          )}
        </ol>
      </section>

      {addOpen && (
        <AddSkillModal
          onClose={() => setAddOpen(false)}
          onDone={() => {
            setAddOpen(false);
            setReloadNonce((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}

function Hero({ onTry }: { onTry: () => void }) {
  return (
    <section className="grid gap-8 lg:grid-cols-[1fr_1fr] lg:items-start">
      <div>
        <h1 className="font-display text-5xl font-extrabold tracking-tight">SKILLS</h1>
        <p className="mt-1 font-mono text-xs uppercase tracking-widest text-faint">
          Vodafone agent skills ecosystem
        </p>
        <p className="mt-6 max-w-md text-lg text-muted">
          Reusable capabilities for AI agents. Install with a single command to extend
          Claude, Copilot and Cursor with Vodafone-tuned knowledge and workflows.
        </p>
      </div>
      <div className="space-y-6">
        <div>
          <h3 className="mb-2 font-mono text-xs uppercase tracking-wider text-faint">Try it now</h3>
          <button
            onClick={onTry}
            className="w-full rounded-xl border px-4 py-3 text-left font-mono text-sm"
            style={{ borderColor: "var(--hairline)", background: "var(--panel-2)" }}
          >
            <span className="text-faint">$ </span>{TRY_CMD}
          </button>
        </div>
        <div>
          <h3 className="mb-2 font-mono text-xs uppercase tracking-wider text-faint">Available for these agents</h3>
          <div className="flex flex-wrap gap-2 text-xs text-muted">
            {["Claude", "Copilot", "Cursor", "Gemini", "Windsurf", "Codex"].map((a) => (
              <span key={a} className="rounded-lg border px-2.5 py-1" style={{ borderColor: "var(--hairline)" }}>
                {a}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="-mb-px border-b-2 pb-2 text-sm"
      style={{
        borderColor: active ? "var(--red)" : "transparent",
        color: active ? "var(--fg)" : "var(--muted)",
      }}
    >
      {children}
    </button>
  );
}

function Row({ rank, skill }: { rank: number; skill: SkillListItem }) {
  return (
    <li className="border-b" style={{ borderColor: "var(--hairline)" }}>
      <Link
        href={`/skills/${skill.slug}`}
        className="flex items-center gap-4 py-4 transition-colors hover:bg-[var(--panel-2)]"
      >
        <span className="w-6 shrink-0 font-mono text-sm text-faint">{rank}</span>
        <span className="min-w-0 flex-1">
          <span className="font-semibold">{skill.name}</span>
          {skill.repoUrl && (
            <span className="ml-2 font-mono text-xs text-faint">{repoLabel(skill.repoUrl)}</span>
          )}
          <span className="block truncate text-sm text-muted">{skill.description}</span>
        </span>
        {skill.installCount > 0 && (
          <span className="hidden shrink-0 sm:block" aria-hidden="true">
            <Sparkline data={skill.activity} />
          </span>
        )}
        <span className="w-24 shrink-0 text-right font-mono text-sm text-muted">
          {skill.installCount > 0 && (
            <>
              {compact(skill.installCount)}
              <span className="ml-1 text-faint">installs</span>
            </>
          )}
        </span>
      </Link>
    </li>
  );
}

function repoLabel(repoUrl: string): string {
  const m = repoUrl.match(/github\.com\/([^/\s]+\/[^/\s#?]+)/i);
  return m ? m[1].replace(/\.git$/, "") : "";
}

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
