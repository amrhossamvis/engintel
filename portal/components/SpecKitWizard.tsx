"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Copy,
  Download,
  FileText,
  HelpCircle,
  ListChecks,
  Loader2,
  Map,
  Play,
  RotateCcw,
  Shield,
  Sparkles,
  Square,
  Settings,
  Upload,
} from "lucide-react";
import { Markdown } from "./Markdown";
import { useApp } from "./AppProvider";
import type { SpecKitStep } from "@/lib/speckit-templates";

/* ── Step metadata (mirrors lib/speckit-templates.ts but client-safe) ─── */

type StepMeta = {
  id: SpecKitStep;
  label: string;
  shortLabel: string;
  description: string;
  icon: typeof Shield;
  inputLabel: string;
  inputPlaceholder: string;
};

const STEPS: StepMeta[] = [
  {
    id: "constitution",
    label: "Constitution",
    shortLabel: "Principles",
    description:
      "Define the project's governing principles — code quality, testing standards, UX consistency, and performance requirements.",
    icon: Shield,
    inputLabel: "Project principles & guidelines",
    inputPlaceholder:
      "Create principles focused on code quality, testing standards, user experience consistency, and performance requirements…",
  },
  {
    id: "specify",
    label: "Specify",
    shortLabel: "Spec",
    description:
      "Describe what you want to build in plain language. Focus on the what and why — not the tech stack.",
    icon: FileText,
    inputLabel: "Feature description",
    inputPlaceholder:
      "Build an application that helps me organize my photos in separate albums. Albums are grouped by date and can be re-organized by drag and drop…",
  },
  {
    id: "clarify",
    label: "Clarify",
    shortLabel: "Clarify",
    description:
      "Identify underspecified areas and ask targeted clarification questions to strengthen the spec.",
    icon: HelpCircle,
    inputLabel: "Additional context or answers (optional)",
    inputPlaceholder:
      "Leave blank to let the AI identify gaps, or paste answers to previous clarification questions…",
  },
  {
    id: "plan",
    label: "Plan",
    shortLabel: "Plan",
    description:
      "Provide your tech stack and architecture preferences — the AI creates a technical implementation plan.",
    icon: Map,
    inputLabel: "Tech stack & architecture",
    inputPlaceholder:
      "Use Next.js with TypeScript, Tailwind CSS, PostgreSQL via Prisma. Deploy on Vercel. REST API with OpenAPI spec…",
  },
  {
    id: "tasks",
    label: "Tasks",
    shortLabel: "Tasks",
    description:
      "Break the plan into actionable, dependency-ordered tasks ready for implementation.",
    icon: ListChecks,
    inputLabel: "Additional constraints (optional)",
    inputPlaceholder:
      "Leave blank to generate from the plan, or add constraints like 'TDD required', 'max 2-hour tasks'…",
  },
];

type RunState = "idle" | "running" | "done" | "error";

const SESSION_KEY = "speckit:session";

function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id || id.length < 8) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export function SpecKitWizard() {
  const { ready, githubToken } = useApp();

  const [currentStep, setCurrentStep] = useState(0);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [outputs, setOutputs] = useState<Record<string, string>>({});
  const [runState, setRunState] = useState<RunState>("idle");
  const [copiedStep, setCopiedStep] = useState<string | null>(null);
  const [expandedOutput, setExpandedOutput] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sessionId = useRef("");
  const importRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    sessionId.current = getOrCreateSessionId();
    // Hydrate outputs from server session (survives navigation)
    if (sessionId.current) {
      fetch(`/api/speckit?sessionId=${encodeURIComponent(sessionId.current)}`)
        .then((r) => (r.ok ? r.json() : { artifacts: {} }))
        .then((data) => {
          const artifacts: Record<string, string> = data.artifacts ?? {};
          if (Object.keys(artifacts).length === 0) return;
          // Map server filenames back to step IDs
          const fileToStep: Record<string, string> = {
            "constitution.md": "constitution",
            "spec.md": "specify",
            "clarifications.md": "clarify",
            "plan.md": "plan",
            "tasks.md": "tasks",
          };
          const restored: Record<string, string> = {};
          for (const [file, content] of Object.entries(artifacts)) {
            const stepId = fileToStep[file];
            if (stepId && content.trim()) {
              restored[stepId] = content;
            }
          }
          if (Object.keys(restored).length > 0) {
            setOutputs(restored);
          }
        })
        .catch(() => {});
    }
  }, []);

  // Auto-scroll output
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [outputs, runState]);

  const step = STEPS[currentStep];
  const running = runState === "running";
  const hasOutput = !!outputs[step.id]?.trim();

  const canGoNext = currentStep < STEPS.length - 1 && hasOutput && !running;
  const canGoPrev = currentStep > 0 && !running;

  function setInput(val: string) {
    setInputs((prev) => ({ ...prev, [step.id]: val }));
  }

  async function runStep() {
    if (!ready || running) return;

    const ac = new AbortController();
    abortRef.current = ac;
    setRunState("running");
    setOutputs((prev) => ({ ...prev, [step.id]: "" }));

    try {
      const res = await fetch("/api/speckit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: step.id,
          userInput: inputs[step.id] ?? "",
          sessionId: sessionId.current,
          githubToken,
        }),
        signal: ac.signal,
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        setOutputs((prev) => ({
          ...prev,
          [step.id]: `[error] ${data.error ?? res.status}`,
        }));
        setRunState("error");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setOutputs((prev) => ({
          ...prev,
          [step.id]: (prev[step.id] ?? "") + chunk,
        }));
      }
      setRunState("done");
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        setRunState("idle");
        return;
      }
      setOutputs((prev) => ({
        ...prev,
        [step.id]: (prev[step.id] ?? "") + `\n[error] ${(e as Error).message}`,
      }));
      setRunState("error");
    } finally {
      abortRef.current = null;
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  function resetSession() {
    if (running) return;
    setInputs({});
    setOutputs({});
    setCurrentStep(0);
    setRunState("idle");
    sessionId.current = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, sessionId.current);
  }

  async function copyOutput(stepId: string) {
    const text = outputs[stepId];
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedStep(stepId);
      setTimeout(() => setCopiedStep((c) => (c === stepId ? null : c)), 1400);
    } catch {
      // clipboard blocked
    }
  }

  function downloadAll() {
    const parts: string[] = [];
    for (const s of STEPS) {
      if (outputs[s.id]?.trim()) {
        parts.push(`# ${s.label}\n\n${outputs[s.id].trim()}`);
      }
    }
    if (!parts.length) return;
    const blob = new Blob([parts.join("\n\n---\n\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "speckit-output.md";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importArtifact(file: File) {
    const text = await file.text();
    const name = file.name.toLowerCase();

    // Try to match the file to a known step by filename
    const stepMap: Record<string, string> = {
      "constitution": "constitution",
      "spec": "specify",
      "specify": "specify",
      "clarif": "clarify",
      "plan": "plan",
      "task": "tasks",
    };

    let matched = false;
    for (const [keyword, stepId] of Object.entries(stepMap)) {
      if (name.includes(keyword)) {
        setOutputs((prev) => ({ ...prev, [stepId]: text }));
        // Also persist to server session
        persistArtifact(stepId, text);
        matched = true;
        break;
      }
    }

    if (!matched) {
      // If we can't match by filename, import into the current step
      setOutputs((prev) => ({ ...prev, [step.id]: text }));
      persistArtifact(step.id, text);
    }
  }

  function persistArtifact(stepId: string, content: string) {
    const meta = STEPS.find((s) => s.id === stepId);
    if (!meta || !sessionId.current) return;
    // Fire-and-forget persist to server session for cross-step context
    fetch("/api/speckit/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: sessionId.current,
        filename: meta.id === "constitution" ? "constitution.md"
          : meta.id === "specify" ? "spec.md"
          : meta.id === "clarify" ? "clarifications.md"
          : meta.id === "plan" ? "plan.md"
          : "tasks.md",
        content,
      }),
    }).catch(() => {});
  }

  const completedSteps = STEPS.filter((s) => !!outputs[s.id]?.trim()).length;

  return (
    <main className="relative z-10 mx-auto max-w-5xl px-6 pb-20">
      {/* Hero */}
      <section className="relative pt-10 pb-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="flex items-center gap-3 mb-4">
            <Link
              href="/playground"
              className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Personas
            </Link>
            <span className="text-faint">·</span>
            <span className="inline-flex items-center gap-2 text-[0.7rem] font-mono uppercase tracking-wider text-soon">
              <Sparkles className="h-3.5 w-3.5" /> Spec-Driven Development
            </span>
          </div>
          <h1 className="font-display font-extrabold tracking-tight text-[clamp(1.8rem,4vw,2.8rem)] leading-[0.98]">
            Spec Kit <span className="text-red">Wizard</span>
          </h1>
          <p className="text-[var(--ink-dim)] text-lg mt-4 max-w-2xl leading-relaxed">
            A guided, multi-step workflow powered by{" "}
            <a
              href="https://github.com/github/spec-kit"
              target="_blank"
              rel="noopener noreferrer"
              className="text-red hover:underline"
            >
              GitHub Spec Kit
            </a>
            . Define principles, write a spec, clarify gaps, plan the architecture, and break it into tasks — each step
            feeds the next automatically.
          </p>
        </motion.div>
      </section>

      {/* Token gate */}
      {!ready && (
        <Link
          href="/settings"
          className="mb-6 block rounded-2xl border border-dashed p-4 hover:border-red transition-colors"
          style={{ borderColor: "var(--hairline-strong)" }}
        >
          <div className="flex items-center gap-3">
            <Settings className="h-5 w-5 text-red shrink-0" />
            <div>
              <p className="text-sm font-medium">Connect your Copilot token to run steps</p>
              <p className="text-xs text-muted">Add it once in Settings — every run uses your own token.</p>
            </div>
          </div>
        </Link>
      )}

      {/* Progress stepper */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-muted">
            Step {currentStep + 1} of {STEPS.length}
            {completedSteps > 0 && (
              <span className="ml-2 text-xs text-live">({completedSteps} completed)</span>
            )}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => importRef.current?.click()}
              disabled={running}
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs text-muted hover:text-ink transition-colors disabled:opacity-40"
              style={{ borderColor: "var(--hairline)" }}
            >
              <Upload className="h-3.5 w-3.5" /> Import
            </button>
            {completedSteps > 0 && (
              <button
                onClick={downloadAll}
                className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs text-muted hover:text-ink transition-colors"
                style={{ borderColor: "var(--hairline)" }}
              >
                <Download className="h-3.5 w-3.5" /> Download all
              </button>
            )}
            <button
              onClick={resetSession}
              disabled={running}
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs text-muted hover:text-ink transition-colors disabled:opacity-40"
              style={{ borderColor: "var(--hairline)" }}
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </button>
          </div>
        </div>

        {/* Hidden file input for import */}
        <input
          ref={importRef}
          type="file"
          accept=".md,.txt,text/markdown,text/plain"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) importArtifact(file);
            e.target.value = "";
          }}
        />

        {/* Step pills */}
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {STEPS.map((s, i) => {
            const done = !!outputs[s.id]?.trim();
            const active = i === currentStep;
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                onClick={() => !running && setCurrentStep(i)}
                disabled={running}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium whitespace-nowrap border transition-all disabled:cursor-not-allowed ${
                  active
                    ? "border-red/40 bg-red/10 text-red"
                    : done
                      ? "border-[var(--hairline)] bg-[var(--panel-2)] text-live"
                      : "border-[var(--hairline)] text-muted hover:text-ink hover:bg-white/5"
                }`}
              >
                {done && !active ? (
                  <Check className="h-4 w-4 text-live" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">{s.label}</span>
                <span className="sm:hidden">{s.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main card */}
      <AnimatePresence mode="wait">
        <motion.section
          key={step.id}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="card rounded-2xl overflow-hidden"
        >
          {/* Header */}
          <div
            className="flex items-center gap-3 px-5 py-4 border-b"
            style={{ borderColor: "var(--hairline)" }}
          >
            <span
              className="grid place-items-center h-10 w-10 rounded-2xl border shrink-0"
              style={{ borderColor: "var(--hairline)", background: "var(--panel-2)" }}
            >
              <step.icon className="h-5 w-5" style={{ color: "var(--red)" }} />
            </span>
            <div className="min-w-0">
              <p className="kicker">Step {currentStep + 1}</p>
              <h2 className="font-display font-semibold text-lg leading-tight">{step.label}</h2>
            </div>
          </div>

          {/* Description */}
          <div className="px-5 py-4 border-b" style={{ borderColor: "var(--hairline)" }}>
            <p className="text-sm text-muted leading-relaxed">{step.description}</p>
          </div>

          {/* Input area */}
          <div className="px-5 py-4 border-b" style={{ borderColor: "var(--hairline)" }}>
            <label className="block text-sm font-medium mb-2">{step.inputLabel}</label>
            <textarea
              value={inputs[step.id] ?? ""}
              onChange={(e) => setInput(e.target.value)}
              placeholder={step.inputPlaceholder}
              rows={4}
              disabled={running || !ready}
              spellCheck={false}
              className="w-full rounded-xl bg-[var(--canvas)] border border-[var(--hairline)] px-3.5 py-3 text-sm placeholder:text-faint focus:border-red transition-colors resize-y disabled:opacity-50"
            />
            <div className="flex items-center justify-between mt-3">
              <p className="text-xs text-muted">
                {step.id === "clarify"
                  ? "Leave blank to auto-detect gaps in your spec."
                  : "Describe your intent — the AI handles the structure."}
              </p>
              <div className="flex items-center gap-2">
                {running ? (
                  <button
                    onClick={stop}
                    className="inline-flex items-center gap-2 rounded-xl py-2.5 px-4 text-sm font-medium text-white transition-all"
                    style={{ background: "var(--faint)" }}
                  >
                    <Square className="h-4 w-4 fill-current" /> Stop
                  </button>
                ) : (
                  <button
                    onClick={runStep}
                    disabled={!ready || (step.id !== "clarify" && !(inputs[step.id] ?? "").trim())}
                    className="inline-flex items-center gap-2 rounded-xl py-2.5 px-5 text-sm font-medium text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: "linear-gradient(180deg, var(--red-bright), var(--red))" }}
                  >
                    <Play className="h-4 w-4 fill-current" />
                    {hasOutput ? "Re-run" : "Run"}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Output area */}
          <div ref={scrollRef} className="px-5 py-4 min-h-[12rem] max-h-[36rem] overflow-auto">
            {running && !outputs[step.id]?.trim() ? (
              <div className="flex items-center gap-2 text-sm text-live font-mono">
                <Loader2 className="h-4 w-4 animate-spin" /> Generating {step.label.toLowerCase()}…
              </div>
            ) : outputs[step.id]?.trim() ? (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="kicker flex items-center gap-1.5">
                    {running ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-live" />
                    ) : (
                      <Check className="h-3.5 w-3.5 text-live" />
                    )}
                    Output
                  </p>
                  <button
                    onClick={() => copyOutput(step.id)}
                    className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-ink transition-colors"
                  >
                    {copiedStep === step.id ? (
                      <Check className="h-3.5 w-3.5 text-live" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    {copiedStep === step.id ? "Copied" : "Copy"}
                  </button>
                </div>
                {running ? (
                  <pre className="text-[0.82rem] font-mono leading-relaxed whitespace-pre-wrap break-words text-ink">
                    {outputs[step.id]}
                    <span className="cursor-blink">▋</span>
                  </pre>
                ) : (
                  <div className="text-sm text-ink break-words">
                    <Markdown source={outputs[step.id]} />
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <step.icon className="h-8 w-8 text-faint mb-3" />
                <p className="text-sm text-muted">
                  Fill in the input above and click <strong>Run</strong> to generate the{" "}
                  {step.label.toLowerCase()}.
                </p>
                {step.id !== "constitution" && !outputs[STEPS[currentStep - 1]?.id] && (
                  <p className="text-xs text-soon mt-2">
                    💡 Tip: Complete the previous step first for best results.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Navigation footer */}
          <div
            className="flex items-center justify-between px-5 py-3 border-t"
            style={{ borderColor: "var(--hairline)" }}
          >
            <button
              onClick={() => setCurrentStep((s) => s - 1)}
              disabled={!canGoPrev}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted hover:text-ink transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ArrowLeft className="h-4 w-4" /> Previous
            </button>
            {currentStep === STEPS.length - 1 ? (
              <button
                onClick={downloadAll}
                disabled={completedSteps === 0 || running}
                className="inline-flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-medium text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ background: completedSteps > 0 && !running ? "linear-gradient(180deg, var(--red-bright), var(--red))" : "var(--faint)" }}
              >
                <Download className="h-4 w-4" /> Finish & Save All
              </button>
            ) : (
              <button
                onClick={() => setCurrentStep((s) => s + 1)}
                disabled={!canGoNext}
                className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ background: canGoNext ? "linear-gradient(180deg, var(--red-bright), var(--red))" : "var(--faint)" }}
              >
                Next <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </motion.section>
      </AnimatePresence>

      {/* Completed artifacts summary */}
      {completedSteps > 1 && (
        <section className="mt-6">
          <button
            onClick={() => setExpandedOutput(expandedOutput ? null : "all")}
            className="w-full flex items-center justify-between px-5 py-3 rounded-xl border text-left hover:bg-white/5 transition-colors"
            style={{ borderColor: "var(--hairline)" }}
          >
            <span className="kicker flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-red" /> All artifacts ({completedSteps})
            </span>
            <ChevronDown
              className={`h-4 w-4 text-muted transition-transform ${expandedOutput === "all" ? "rotate-180" : ""}`}
            />
          </button>
          {expandedOutput === "all" && (
            <div className="mt-2 space-y-3">
              {STEPS.filter((s) => outputs[s.id]?.trim()).map((s) => (
                <div
                  key={s.id}
                  className="rounded-xl border p-4"
                  style={{ borderColor: "var(--hairline)", background: "var(--panel-2)" }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium flex items-center gap-2">
                      <s.icon className="h-4 w-4 text-red" /> {s.label}
                    </p>
                    <button
                      onClick={() => copyOutput(s.id)}
                      className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink transition-colors"
                    >
                      {copiedStep === s.id ? (
                        <Check className="h-3 w-3 text-live" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                      {copiedStep === s.id ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <div className="text-sm text-ink break-words max-h-48 overflow-auto">
                    <Markdown source={outputs[s.id]} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}

