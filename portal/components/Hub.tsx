"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Sparkles } from "lucide-react";
import {
  CAPABILITIES,
  commonCapabilities,
  ownCapabilitiesForGuild,
  type Capability,
  type Guild,
} from "@/lib/capabilities";
import { CapabilityCard } from "./CapabilityCard";
import { CapabilityModal } from "./CapabilityModal";
import { RunForm } from "./RunForm";
import { JobMonitor } from "./JobMonitor";
import { CapabilityDisplaySurface } from "./CapabilityDisplaySurface";
import { useApp } from "./AppProvider";

const GUILD_LABEL: Record<Guild, string> = {
  mobile: "Mobile",
  web: "Web",
  java: "Java",
  "full-stack": "Full-Stack",
  product: "Product",
  testing: "Testing",
  "cross-guild": "Cross-Guild",
};

const liveFirst = (list: Capability[]) =>
  [...list].sort((a, b) => Number(b.status === "live") - Number(a.status === "live"));

const LIVE_CAPABILITY_ORDER = [
  "exec-dashboard",
  "feature-breakdown",
  "bug-triage",
  "testcase-ado",
  "workitem-wiki-doc",
  "pr-impact-analyzer",
  "business-intent",
  "ai-productivity",
] as const;

const orderedLiveCapabilities = (): Capability[] => {
  const live = CAPABILITIES.filter((cap) => cap.status === "live");
  const byId = new Map(live.map((cap) => [cap.id, cap] as const));
  const ordered = LIVE_CAPABILITY_ORDER.map((id) => byId.get(id)).filter(
    (cap): cap is Capability => Boolean(cap && cap.status === "live"),
  );
  const pinnedIds = new Set(ordered.map((cap) => cap.id));
  const remaining = live.filter((cap) => !pinnedIds.has(cap.id));
  return [...ordered, ...remaining];
};
// Selectable primary guilds (cross-guild is ambient — always included, not a tab)
const SELECTABLE_GUILDS: Guild[] = ["mobile", "web", "testing", "product", "java", "full-stack"];

export function Hub() {
  const { openLaunch } = useApp();
  const [tab, setTab] = useState<Guild | "common" | "live">("live");

  const liveCount = orderedLiveCapabilities().length;

  const shown = useMemo(() => {
    if (tab === "live") return orderedLiveCapabilities();
    return liveFirst(tab === "common" ? commonCapabilities() : ownCapabilitiesForGuild(tab));
  }, [tab]);

  return (
    <main className="relative z-10 mx-auto max-w-6xl px-6 pb-24">
      {/* hero */}
      <section className="relative pt-14 pb-14">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="kicker flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-red" />
            AI Engineering Console
          </p>
          <h1 className="font-display font-extrabold tracking-tight mt-4 text-[clamp(2.4rem,6vw,4.25rem)] leading-[0.98]">
            Ship faster with
            <br />
            <span className="text-red">your own</span> Copilot token.
          </h1>
          <p className="text-[var(--ink-dim)] text-lg mt-6 max-w-xl leading-relaxed">
            One console for every AI-powered delivery capability. Point a tool at a PR, work item, or
            ticket — it runs under your own token. Azure DevOps today; Jira, GitHub and more next.
            <span className="block mt-3 font-bold text-[var(--ink)]">
              Same power. <span className="text-red">Fraction of the tokens.</span>
            </span>
          </p>

          <div className="flex flex-wrap items-center gap-6 mt-8 text-sm font-mono">
            <Stat value={`${liveCount}`} label="live tools" accent />
            <span className="h-4 w-px bg-[var(--hairline-strong)]" />
            <Stat value={`${CAPABILITIES.length}`} label="capabilities" />
          </div>
        </motion.div>
      </section>

      {/* tab selector — Common holds the shared tools; each guild holds its own */}
      <div className="flex flex-wrap items-center gap-2 mb-8">
        {(["live", "common", ...SELECTABLE_GUILDS] as (Guild | "common" | "live")[]).map((t) => {
          const on = tab === t;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors border"
              style={{
                borderColor: on ? "var(--red)" : "var(--hairline)",
                background: on ? "rgba(230,0,0,0.12)" : "transparent",
                color: on ? "var(--ink)" : "var(--muted)",
              }}
            >
              {t === "live" && <span className="pulse h-1.5 w-1.5 rounded-full bg-live text-live" />}
              {t === "live" ? `Live (${liveCount})` : t === "common" ? "Common" : GUILD_LABEL[t]}
            </button>
          );
        })}
      </div>

      {/* grid */}
      {shown.length === 0 ? (
        <div className="rounded-2xl border border-[var(--hairline)] p-12 text-center">
          {/* only a guild tab can be empty — Common always has tools */}
          <p className="text-sm text-[var(--ink-dim)]">
            No dedicated {GUILD_LABEL[tab as Guild]} tools yet.
          </p>
          <p className="text-xs text-muted mt-1">Your everyday tools live in Common.</p>
          <button
            onClick={() => setTab("common")}
            className="group mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-red hover:opacity-80 transition-opacity"
          >
            Browse Common tools
            <span className="transition-transform group-hover:translate-x-0.5">→</span>
          </button>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((cap, i) => (
            <CapabilityCard
              key={cap.id}
              cap={cap}
              index={i}
              onLaunchAction={openLaunch}
            />
          ))}
        </div>
      )}

      <footer className="mt-16 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-t border-[var(--hairline)] pt-6 text-xs font-mono text-muted">
        <span className="flex items-center gap-2">
          <span className="pulse h-1.5 w-1.5 rounded-full bg-live text-live" />
          Powered by Azure DevOps + GitHub Copilot CLI
        </span>
        <span className="blink">localhost:3000 · prototype build</span>
      </footer>

      <RunForm />
      <CapabilityModal />
      <JobMonitor />
      <CapabilityDisplaySurface />
    </main>
  );
}

function Stat({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-lg" style={{ color: accent ? "var(--red)" : "var(--ink)" }}>
        {value}
      </span>
      <span className="text-muted">{label}</span>
    </span>
  );
}
