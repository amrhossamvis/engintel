"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import {
  BarChart3,
  Check,
  ChevronDown,
  Copy,
  Download,
  Eye,
  FlaskConical,
  FolderGit2,
  GripVertical,
  Loader2,
  MessageSquarePlus,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Send,
  Settings,
  Sparkles,
  Square,
  Terminal,
  Ticket,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  PG_TEMPLATES,
  blankPersona,
  buildConversationPrompt,
  fillPrompt,
  type CustomPersona,
  type PgMessage,
  type PgTemplate,
  type PgVariable,
  type PgVarType,
} from "@/lib/playground-templates";
import { CapIcon, ICON_KEYS } from "./icons";
import { Markdown } from "./Markdown";
import { useApp } from "./AppProvider";
import { AdoWorkItemModal } from "./AdoWorkItemModal";
import { TemplateRating, type RatingValue } from "./TemplateRating";
import { recordAnalytics } from "@/lib/playground-analytics";

type RunState = "idle" | "running" | "error";
type ChatMsg = { id: number; role: "user" | "assistant"; content: string };
type Thread = {
  id: string;
  templateId: string;
  title: string;
  messages: ChatMsg[];
  contextDir: string;
  updatedAt: number;
};

const THREADS_KEY = "pg:threads";
const PERSONAS_KEY = "pg:personas";
const MAX_THREADS = 30;

function loadThreads(): Thread[] {
  try {
    const raw = localStorage.getItem(THREADS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Thread[]) : [];
  } catch {
    return [];
  }
}

function loadPersonas(): CustomPersona[] {
  try {
    const raw = localStorage.getItem(PERSONAS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CustomPersona[]) : [];
  } catch {
    return [];
  }
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function threadTitle(messages: ChatMsg[], fallback: string): string {
  const first = messages.find((m) => m.role === "user")?.content.trim();
  if (!first) return fallback;
  return first.length > 60 ? `${first.slice(0, 60)}…` : first;
}

const ERROR_MESSAGES: Record<string, string> = {
  too_many_runs: "Too many prompts running at once — wait for one to finish.",
  prompt_too_long: "Conversation is too long (20k char limit). Start a new chat.",
  missing_token: "Connect your Copilot token in Settings first.",
  empty_prompt: "Prompt is empty.",
  context_not_absolute: "Context folder must be an absolute path.",
  context_not_found: "Context folder not found on this machine.",
  context_not_dir: "Context path is not a folder.",
  context_outside_root: "Context folder is outside the allowed root.",
  context_root_missing: "Server allow-root is misconfigured.",
};

export function Playground() {
  const { ready, githubToken, login, adoIdentity } = useApp();

  const [customPersonas, setCustomPersonas] = useState<CustomPersona[]>([]);
  const [editorInit, setEditorInit] = useState<CustomPersona | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [adoItemFor, setAdoItemFor] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement | null>(null);

  const allPersonas = useMemo<PgTemplate[]>(
    () => [...customPersonas, ...PG_TEMPLATES],
    [customPersonas],
  );

  const [selectedId, setSelectedId] = useState<string>(PG_TEMPLATES[0].id);
  const template = useMemo(
    () => allPersonas.find((t) => t.id === selectedId) ?? PG_TEMPLATES[0],
    [selectedId, allPersonas],
  );

  const [values, setValues] = useState<Record<string, string>>({});
  const [prompt, setPrompt] = useState<string>(template.prompt);
  const [contextDir, setContextDir] = useState<string>("");
  const [specKitEnabled, setSpecKitEnabled] = useState(false);
  const [specKitArtifacts, setSpecKitArtifacts] = useState<Record<string, string>>({});

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [followup, setFollowup] = useState<string>("");
  const [runState, setRunState] = useState<RunState>("idle");
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [setupOpen, setSetupOpen] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const idRef = useRef(0);
  const sessionStartRef = useRef<number>(Date.now());
  const [ratedMsgIds, setRatedMsgIds] = useState<Set<number>>(new Set());

  const running = runState === "running";
  const chatting = messages.length > 0;

  // Fetch Spec Kit artifacts when the toggle is enabled.
  useEffect(() => {
    if (!specKitEnabled) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSpecKitArtifacts({});
      return;
    }
    const sid = typeof window !== "undefined" ? sessionStorage.getItem("speckit:session") : null;
    if (!sid) {
      setSpecKitArtifacts({});
      return;
    }
    fetch(`/api/speckit?sessionId=${encodeURIComponent(sid)}`)
      .then((r) => (r.ok ? r.json() : { artifacts: {} }))
      .then((data) => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSpecKitArtifacts(data.artifacts ?? {});
      })
      .catch(() => setSpecKitArtifacts({}));
  }, [specKitEnabled]);

  // Autoscroll the transcript as replies stream in.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    // Hydrate history from client-only localStorage after mount to avoid an SSR mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThreads(loadThreads());
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(THREADS_KEY, JSON.stringify(threads));
    } catch {
      // storage full or blocked — history just won't persist
    }
  }, [threads]);

  const personasHydrated = useRef(false);
  useEffect(() => {
    // Hydrate custom personas from client-only localStorage after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCustomPersonas(loadPersonas());
    personasHydrated.current = true;
  }, []);

  useEffect(() => {
    // Skip the pre-hydration render so we never overwrite saved personas with [].
    if (!personasHydrated.current) return;
    try {
      localStorage.setItem(PERSONAS_KEY, JSON.stringify(customPersonas));
    } catch {
      // storage full or blocked — personas just won't persist
    }
  }, [customPersonas]);

  // Persist the live chat into a thread record as it grows. The id is minted
  // in send() so this effect only mirrors state into the thread store.
  useEffect(() => {
    if (messages.length === 0 || !currentThreadId) return;
    const id = currentThreadId;
    const rec: Thread = {
      id,
      templateId: selectedId,
      title: threadTitle(messages, template.name),
      messages,
      contextDir,
      updatedAt: Date.now(),
    };
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThreads((prev) => [rec, ...prev.filter((t) => t.id !== id)].slice(0, MAX_THREADS));
  }, [messages, contextDir, currentThreadId, selectedId, template.name]);

  function selectTemplate(t: PgTemplate) {
    if (running) return;
    setSelectedId(t.id);
    setValues({});
    setPrompt(t.prompt);
    setMessages([]);
    setFollowup("");
    setRunState("idle");
    setCurrentThreadId(null);
    setRatedMsgIds(new Set());
    sessionStartRef.current = Date.now();
  }

  function resetPrompt() {
    setPrompt(template.prompt);
  }

  function newChat() {
    if (running) return;
    setMessages([]);
    setFollowup("");
    setRunState("idle");
    setCurrentThreadId(null);
    setRatedMsgIds(new Set());
    sessionStartRef.current = Date.now();
  }

  function openThread(t: Thread) {
    if (running) return;
    const tpl = allPersonas.find((x) => x.id === t.templateId) ?? template;
    setSelectedId(tpl.id);
    setValues({});
    setPrompt(tpl.prompt);
    setContextDir(t.contextDir);
    setMessages(t.messages);
    setFollowup("");
    setRunState("idle");
    setCurrentThreadId(t.id);
  }

  function deleteThread(id: string) {
    setThreads((prev) => prev.filter((t) => t.id !== id));
    if (id === currentThreadId) newChat();
  }

  function newPersona() {
    if (running) return;
    setEditorInit({ ...blankPersona(), id: `custom-${crypto.randomUUID()}` });
  }

  function editPersona(p: CustomPersona) {
    if (running) return;
    setEditorInit(p);
  }

  function duplicatePersona(t: PgTemplate) {
    if (running) return;
    setEditorInit({
      ...t,
      id: `custom-${crypto.randomUUID()}`,
      name: `${t.name} (copy)`,
      category: "My Personas",
      variables: t.variables.map((v) => ({ ...v })),
      custom: true,
      createdAt: 0,
    });
  }

  function savePersona(p: CustomPersona) {
    setCustomPersonas((prev) =>
      prev.some((x) => x.id === p.id)
        ? prev.map((x) => (x.id === p.id ? p : x))
        : [p, ...prev],
    );
    setEditorInit(null);
    selectTemplate(p);
  }

  function deletePersona(id: string) {
    setCustomPersonas((prev) => prev.filter((x) => x.id !== id));
    setPendingDelete(null);
    if (selectedId === id) selectTemplate(PG_TEMPLATES[0]);
  }

  function exportPersonas() {
    const blob = new Blob([JSON.stringify(customPersonas, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "playground-personas.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importPersonas(file: File) {
    try {
      const parsed = JSON.parse(await file.text());
      if (!Array.isArray(parsed)) return;
      const seen = new Set(customPersonas.map((p) => p.id));
      const incoming: CustomPersona[] = [];
      for (const raw of parsed) {
        if (!raw || typeof raw.name !== "string" || typeof raw.prompt !== "string") continue;
        const id = !raw.id || seen.has(raw.id) ? `custom-${crypto.randomUUID()}` : raw.id;
        seen.add(id);
        incoming.push({
          id,
          name: raw.name,
          category: typeof raw.category === "string" ? raw.category : "My Personas",
          icon: typeof raw.icon === "string" ? raw.icon : "Sparkles",
          description: typeof raw.description === "string" ? raw.description : raw.name,
          persona: typeof raw.persona === "string" ? raw.persona : "a helpful, expert AI assistant",
          variables: Array.isArray(raw.variables) ? raw.variables : [],
          prompt: raw.prompt,
          custom: true,
          createdAt: typeof raw.createdAt === "number" ? raw.createdAt : Date.now(),
        });
      }
      if (incoming.length) setCustomPersonas((prev) => [...incoming, ...prev]);
    } catch {
      // invalid file — ignore
    }
  }

  function appendToAssistant(id: number, chunk: string) {
    setMessages((ms) => ms.map((m) => (m.id === id ? { ...m, content: m.content + chunk } : m)));
  }

  async function send(text: string) {
    if (!ready || running) return;
    const clean = text.trim();
    if (!clean) return;

    if (messages.length === 0 && !currentThreadId) setCurrentThreadId(crypto.randomUUID());
    const userMsg: ChatMsg = { id: (idRef.current += 1), role: "user", content: clean };
    const history: PgMessage[] = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }));
    const asstId = (idRef.current += 1);
    setMessages((ms) => [...ms, userMsg, { id: asstId, role: "assistant", content: "" }]);
    setRunState("running");

    const ac = new AbortController();
    abortRef.current = ac;

    try {
      // Build the prompt, optionally prepending Spec Kit artifacts as project context.
      let conversationPrompt = buildConversationPrompt(template.persona, history);
      if (specKitEnabled && Object.keys(specKitArtifacts).length > 0) {
        const artifactBlock = Object.entries(specKitArtifacts)
          .filter(([, v]) => v.trim())
          .map(([k, v]) => `--- ${k} ---\n${v.trim()}\n--- end ${k} ---`)
          .join("\n\n");
        if (artifactBlock) {
          conversationPrompt =
            `## Project Context (from Spec Kit)\n\n${artifactBlock}\n\n` +
            conversationPrompt;
        }
      }

      const res = await fetch("/api/playground", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: conversationPrompt,
          githubToken,
          contextDir: contextDir.trim(),
        }),
        signal: ac.signal,
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        appendToAssistant(asstId, `[error] ${ERROR_MESSAGES[data.error] ?? data.error ?? res.status}`);
        setRunState("error");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        appendToAssistant(asstId, decoder.decode(value, { stream: true }));
      }
      setRunState("idle");
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        setRunState("idle");
        return;
      }
      appendToAssistant(asstId, `\n[error] ${(e as Error).message}`);
      setRunState("error");
    } finally {
      abortRef.current = null;
    }
  }

  function startChat() {
    send(fillPrompt(prompt, values));
  }

  function sendFollowup() {
    const text = followup;
    setFollowup("");
    send(text);
  }

  function stop() {
    abortRef.current?.abort();
  }

  function submitRating(msgId: number, rating: RatingValue, feedback?: string) {
    setRatedMsgIds((prev) => new Set(prev).add(msgId));
    const userKey = adoIdentity || login || "anonymous";
    const turns = messages.filter((m) => m.role === "assistant").length;
    const durationMs = Date.now() - sessionStartRef.current;
    recordAnalytics({
      templateId: selectedId,
      userKey,
      threadId: currentThreadId,
      turns,
      rating,
      feedbackText: feedback || null,
      durationMs,
    });
  }

  async function copyMsg(id: number, content: string) {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(id);
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1400);
    } catch {
      // clipboard blocked — ignore
    }
  }

  // The main paste field becomes the single composer input; everything else
  // (extra fields, code context) lives in the collapsible Setup.
  const primaryVar = template.variables.find((v) => v.type === "textarea") ?? null;
  const secondaryVars = template.variables.filter((v) => v !== primaryVar);
  const freePrompt = template.variables.length === 0;

  const composerDraft = freePrompt ? prompt : primaryVar ? values[primaryVar.key] ?? "" : prompt;
  function setComposerDraft(val: string) {
    if (freePrompt || !primaryVar) setPrompt(val);
    else setValues((s) => ({ ...s, [primaryVar.key]: val }));
  }
  const firstReady = composerDraft.trim().length > 0;

  // Exact text sent to Copilot for the first turn — shown read-only so users
  // can see what a persona actually does under the hood.
  const sentPreview = buildConversationPrompt(template.persona, [
    { role: "user", content: fillPrompt(prompt, values).trim() || "…" },
  ]);

  return (
    <main className="relative z-10 mx-auto max-w-6xl px-6 pb-20">
      {/* contextual badge */}
      <div className="flex items-center justify-end gap-4 pt-6 pb-1">
        <Link
          href="/playground/insights"
          className="inline-flex items-center gap-1.5 text-[0.7rem] font-mono uppercase tracking-wider text-muted hover:text-ink transition-colors"
        >
          <BarChart3 className="h-3.5 w-3.5" /> Insights
        </Link>
        <span className="inline-flex items-center gap-2 text-[0.7rem] font-mono uppercase tracking-wider text-soon">
          <FlaskConical className="h-3.5 w-3.5" /> Experimental
        </span>
      </div>

      {/* hero */}
      <section className="relative pt-6 pb-9">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="kicker flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-red" />
            Personas
          </p>
          <h1 className="font-display font-extrabold tracking-tight mt-4 text-[clamp(2rem,5vw,3.4rem)] leading-[0.98]">
            Pick a persona. <span className="text-red">Chat.</span>
          </h1>
          <p className="text-[var(--ink-dim)] text-lg mt-5 max-w-2xl leading-relaxed">
            A no-setup sandbox over the same Copilot engine the hub runs. Choose a persona, fill the
            blanks, then chat back and forth — follow up, refine, iterate. No PR, no work item, no
            pipeline.
          </p>

          <div className="flex flex-wrap items-center gap-5 mt-7 text-sm font-mono">
            <Stat value={`${allPersonas.length}`} label="personas" accent />
            <span className="h-4 w-px bg-[var(--hairline-strong)]" />
            <Stat value="Chat" label="multi-turn" />
            <span className="h-4 w-px bg-[var(--hairline-strong)]" />
            <Stat value="Your" label="token" />
          </div>
        </motion.div>
      </section>

      {/* Spec Kit wizard banner */}
      <Link
        href="/playground/speckit"
        className="mb-6 block rounded-2xl border p-5 hover:border-red transition-all group"
        style={{ borderColor: "var(--hairline-strong)", background: "var(--panel-2)" }}
      >
        <div className="flex items-center gap-4">
          <span
            className="grid place-items-center h-12 w-12 rounded-2xl border shrink-0 group-hover:border-red/40 transition-colors"
            style={{ borderColor: "var(--hairline)", background: "var(--canvas)" }}
          >
            <FolderGit2 className="h-6 w-6 text-red" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold flex items-center gap-2">
              Spec Kit Wizard
              <span className="text-[0.65rem] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-red/10 text-red">
                New
              </span>
            </p>
            <p className="text-xs text-muted mt-0.5 leading-relaxed">
              Guided spec-driven development — define principles, write a spec, plan architecture, and generate tasks in a multi-step flow.
            </p>
          </div>
          <span className="text-muted group-hover:text-red transition-colors shrink-0">→</span>
        </div>
      </Link>

      {/* token gate */}
      {!ready && (
        <Link
          href="/settings"
          className="mb-6 block rounded-2xl border border-dashed p-4 hover:border-red transition-colors"
          style={{ borderColor: "var(--hairline-strong)" }}
        >
          <div className="flex items-center gap-3">
            <Settings className="h-5 w-5 text-red shrink-0" />
            <div>
              <p className="text-sm font-medium">Connect your Copilot token to run prompts</p>
              <p className="text-xs text-muted">Add it once in Settings — every run uses your own token.</p>
            </div>
          </div>
        </Link>
      )}

      <div
        className={`grid gap-5 ${sidebarOpen ? "lg:grid-cols-[19rem_minmax(0,1fr)]" : "lg:grid-cols-1"}`}
      >
        {/* library */}
        <AnimatePresence initial={false} mode="popLayout">
          {sidebarOpen && (
            <motion.section
              key="rail"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="panel rounded-2xl p-4 h-fit lg:sticky lg:top-5"
            >
          <div className="flex items-center justify-between px-1.5 mb-3">
            <p className="kicker">Personas</p>
            <div className="flex items-center gap-0.5 -mr-1">
              <button
                onClick={() => importRef.current?.click()}
                disabled={running}
                aria-label="Import personas"
                title="Import personas from JSON"
                className="grid place-items-center h-7 w-7 rounded-lg text-muted hover:text-ink hover:bg-white/5 disabled:opacity-40 transition-colors"
              >
                <Upload className="h-4 w-4" />
              </button>
              {customPersonas.length > 0 && (
                <button
                  onClick={exportPersonas}
                  disabled={running}
                  aria-label="Export personas"
                  title="Export personas to JSON"
                  className="grid place-items-center h-7 w-7 rounded-lg text-muted hover:text-ink hover:bg-white/5 disabled:opacity-40 transition-colors"
                >
                  <Download className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={() => setSidebarOpen(false)}
                aria-label="Collapse sidebar"
                title="Collapse sidebar"
                className="grid place-items-center h-7 w-7 rounded-lg text-muted hover:text-ink hover:bg-white/5 transition-colors"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-4">
            <button
              onClick={newChat}
              disabled={running || !chatting}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium text-muted hover:text-ink hover:bg-white/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ borderColor: "var(--hairline)" }}
            >
              <MessageSquarePlus className="h-3.5 w-3.5" /> New chat
            </button>
            <button
              onClick={newPersona}
              disabled={running}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium text-muted hover:text-red hover:bg-white/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ borderColor: "var(--hairline)" }}
            >
              <Plus className="h-3.5 w-3.5" /> New persona
            </button>
          </div>

          <input
            ref={importRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) importPersonas(file);
              e.target.value = "";
            }}
          />

          <div className="space-y-1 max-h-[44rem] overflow-y-auto pr-1 -mr-1">
            {customPersonas.length > 0 && (
              <>
                <p className="kicker px-1.5 mb-1">My Personas</p>
                <p className="text-[0.7rem] text-faint px-1.5 mb-2 leading-snug">
                  Saved in this browser only — clearing site data removes them.
                </p>
                {customPersonas.map((t) => {
                  const active = t.id === selectedId;
                  return (
                    <div key={t.id} className="group relative">
                      <PersonaButton t={t} active={active} disabled={running} onClick={() => selectTemplate(t)} />
                      {pendingDelete === t.id ? (
                        <div
                          className="absolute right-1.5 top-1.5 flex items-center gap-1 rounded-lg px-1.5 py-1"
                          style={{ background: "var(--panel-2)" }}
                        >
                          <span className="text-[0.7rem] text-muted">Delete?</span>
                          <button
                            onClick={() => deletePersona(t.id)}
                            aria-label={`Confirm delete ${t.name}`}
                            title="Confirm delete"
                            className="grid place-items-center h-6 w-6 rounded text-red hover:bg-white/10 transition-colors"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setPendingDelete(null)}
                            aria-label="Cancel delete"
                            title="Cancel"
                            className="grid place-items-center h-6 w-6 rounded text-muted hover:text-ink hover:bg-white/10 transition-colors"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="absolute right-1.5 top-1.5 flex gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                          <button
                            onClick={() => editPersona(t)}
                            disabled={running}
                            aria-label={`Edit ${t.name}`}
                            title="Edit persona"
                            className="grid place-items-center h-7 w-7 rounded-lg text-faint hover:text-ink hover:bg-white/10 disabled:opacity-40 transition-colors"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setPendingDelete(t.id)}
                            disabled={running}
                            aria-label={`Delete ${t.name}`}
                            title="Delete persona"
                            className="grid place-items-center h-7 w-7 rounded-lg text-faint hover:text-red hover:bg-white/10 disabled:opacity-40 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
                <p className="kicker px-1.5 mb-1 mt-3">Built-in</p>
              </>
            )}
            {PG_TEMPLATES.map((t) => {
              const active = t.id === selectedId;
              return (
                <div key={t.id} className="group relative">
                  <PersonaButton t={t} active={active} disabled={running} onClick={() => selectTemplate(t)} />
                  <button
                    onClick={() => duplicatePersona(t)}
                    disabled={running}
                    aria-label={`Duplicate ${t.name} as my persona`}
                    title="Duplicate as my persona"
                    className="absolute right-1.5 top-1.5 grid place-items-center h-7 w-7 rounded-lg text-faint hover:text-red hover:bg-white/10 disabled:opacity-40 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>

          {threads.length > 0 && (
            <div className="mt-4 pt-4 border-t" style={{ borderColor: "var(--hairline)" }}>
              <p className="kicker px-1.5 mb-2">Recent chats</p>
              <div className="space-y-0.5 max-h-[16rem] overflow-y-auto pr-1 -mr-1">
                {threads.map((t) => {
                  const active = t.id === currentThreadId;
                  const tpl = allPersonas.find((x) => x.id === t.templateId);
                  return (
                    <div
                      key={t.id}
                      className="group flex items-center gap-1 rounded-lg"
                      style={{ background: active ? "rgba(230,0,0,0.08)" : "transparent" }}
                    >
                      <button
                        onClick={() => openThread(t)}
                        disabled={running}
                        className="flex-1 min-w-0 flex items-center gap-2 px-2 py-1.5 text-left disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {tpl && (
                          <CapIcon
                            name={tpl.icon}
                            className="h-3.5 w-3.5 shrink-0"
                            style={{ color: active ? "var(--red)" : "var(--muted)" }}
                          />
                        )}
                        <span className="truncate text-xs text-ink">{t.title}</span>
                      </button>
                      <button
                        onClick={() => deleteThread(t.id)}
                        aria-label="Delete chat"
                        title="Delete chat"
                        className="shrink-0 grid place-items-center h-6 w-6 rounded text-faint hover:text-red opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
            </motion.section>
          )}
        </AnimatePresence>

        {/* chat panel — or the persona editor in its place */}
        {editorInit ? (
          <PersonaEditor
            init={editorInit}
            existing={customPersonas.some((p) => p.id === editorInit.id)}
            onSave={savePersona}
            onCancel={() => setEditorInit(null)}
          />
        ) : (
        <section className="card rounded-2xl flex flex-col overflow-hidden min-h-[46rem]">
          {/* header */}
          <div
            className="flex items-center justify-between px-5 py-4 border-b"
            style={{ borderColor: "var(--hairline)" }}
          >
            <div className="flex items-center gap-3 min-w-0">
              {!sidebarOpen && (
                <button
                  onClick={() => setSidebarOpen(true)}
                  aria-label="Open sidebar"
                  title="Open persona library"
                  className="grid place-items-center h-9 w-9 shrink-0 rounded-lg border text-muted hover:text-ink hover:bg-white/5 transition-colors"
                  style={{ borderColor: "var(--hairline)" }}
                >
                  <PanelLeftOpen className="h-4 w-4" />
                </button>
              )}
              <span
                className="grid place-items-center h-10 w-10 rounded-2xl border shrink-0"
                style={{ borderColor: "var(--hairline)", background: "var(--panel-2)" }}
              >
                <CapIcon name={template.icon} className="h-5 w-5" style={{ color: "var(--red)" }} />
              </span>
              <div className="min-w-0">
                <p className="kicker">{template.category}</p>
                <h2 className="font-display font-semibold text-lg leading-tight truncate">
                  {template.name}
                </h2>
              </div>
            </div>
            {chatting ? (
              <button
                onClick={newChat}
                disabled={running}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium border text-muted hover:text-ink transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ borderColor: "var(--hairline)" }}
              >
                <MessageSquarePlus className="h-3.5 w-3.5" /> New chat
              </button>
            ) : (
              <button
                onClick={resetPrompt}
                className="grid place-items-center h-9 w-9 rounded-lg hover:bg-white/5 text-muted hover:text-ink transition-colors shrink-0"
                aria-label="Reset prompt to template default"
                title="Reset prompt"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* transcript — always visible */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-auto p-5 space-y-4"
            style={{ maxHeight: "54rem" }}
          >
            {chatting ? (
              messages.map((m, i) => {
                const isLast = i === messages.length - 1;
                const streaming = running && isLast && m.role === "assistant";
                return (
                  <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                    <div
                      className="max-w-[85%] rounded-2xl px-4 py-3 border"
                      style={
                        m.role === "user"
                          ? { background: "var(--red)", borderColor: "var(--red)" }
                          : { background: "var(--panel-2)", borderColor: "var(--hairline)" }
                      }
                    >
                      {m.role === "user" ? (
                        <p className="text-sm whitespace-pre-wrap break-words text-white">{m.content}</p>
                      ) : m.content ? (
                        streaming ? (
                          <p className="text-[0.82rem] font-mono leading-relaxed whitespace-pre-wrap break-words text-ink">
                            {m.content}
                            <span className="cursor-blink">▋</span>
                          </p>
                        ) : (
                          <div className="text-sm text-ink break-words">
                            <Markdown source={m.content} />
                            <div className="mt-2 flex flex-col gap-2">
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={() => copyMsg(m.id, m.content)}
                                  className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-ink transition-colors"
                                >
                                  {copiedId === m.id ? (
                                    <Check className="h-3.5 w-3.5 text-live" />
                                  ) : (
                                    <Copy className="h-3.5 w-3.5" />
                                  )}
                                  {copiedId === m.id ? "Copied" : "Copy"}
                                </button>
                                <span className="h-3 w-px bg-[var(--hairline)]" />
                                <button
                                  onClick={() => setAdoItemFor(m.content)}
                                  className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-ink transition-colors"
                                >
                                  <Ticket className="h-3.5 w-3.5" />
                                  Create ADO item
                                </button>
                              </div>
                              <TemplateRating
                                submitted={ratedMsgIds.has(m.id)}
                                onSubmit={(rating, feedback) => submitRating(m.id, rating, feedback)}
                              />
                            </div>
                          </div>
                        )
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs text-live font-mono">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> thinking…
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex items-start gap-3 rounded-xl border border-dashed px-4 py-3" style={{ borderColor: "var(--hairline)" }}>
                <CapIcon name={template.icon} className="h-5 w-5 shrink-0 mt-0.5" style={{ color: "var(--red)" }} />
                <p className="text-sm text-muted leading-relaxed">
                  <span className="text-ink font-medium">{template.name}.</span> {template.description}
                </p>
              </div>
            )}
          </div>

          {/* setup — collapsible, before chat starts */}
          {!chatting && (
            <div className="border-t" style={{ borderColor: "var(--hairline)" }}>
              <button
                onClick={() => setSetupOpen((o) => !o)}
                className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-white/5 transition-colors"
              >
                <span className="kicker flex items-center gap-1.5">
                  <Settings className="h-3.5 w-3.5 text-red" /> Setup
                  <span className="normal-case tracking-normal text-muted font-sans">
                    {secondaryVars.length > 0 ? "— code context & fields" : "— code context"}
                  </span>
                </span>
                <ChevronDown
                  className={`h-4 w-4 text-muted transition-transform ${setupOpen ? "rotate-180" : ""}`}
                />
              </button>
              {setupOpen && (
                <div className="px-5 pb-5 space-y-5">
                  <div>
                    <p className="kicker mb-2 flex items-center gap-1.5">
                      <FolderGit2 className="h-3.5 w-3.5 text-red" /> Code context
                      <span className="normal-case tracking-normal text-muted font-sans">— optional</span>
                    </p>
                    <input
                      type="text"
                      value={contextDir}
                      onChange={(e) => setContextDir(e.target.value)}
                      placeholder="/Users/you/repo/src  —  absolute path on this machine"
                      spellCheck={false}
                      className="w-full rounded-xl bg-[var(--canvas)] border border-[var(--hairline)] px-3.5 py-3 text-sm font-mono placeholder:text-faint focus:border-red transition-colors"
                    />
                    <p className="text-xs text-muted mt-1.5">
                      Copilot reads this folder (read-only) as context for the whole chat. Leave blank
                      to chat on the prompt alone.
                    </p>
                  </div>

                  {/* Spec Kit context toggle */}
                  <div>
                    <div className="flex items-center justify-between">
                      <p className="kicker flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-red" /> Spec Kit context
                        <span className="normal-case tracking-normal text-muted font-sans">— optional</span>
                      </p>
                      <button
                        onClick={() => setSpecKitEnabled((v) => !v)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          specKitEnabled ? "bg-red" : "bg-[var(--hairline-strong)]"
                        }`}
                        role="switch"
                        aria-checked={specKitEnabled}
                        aria-label="Use Spec Kit context"
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            specKitEnabled ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </div>
                    {specKitEnabled && (
                      <div className="mt-2 rounded-xl border px-3.5 py-2.5" style={{ borderColor: "var(--hairline)", background: "var(--canvas)" }}>
                        {Object.keys(specKitArtifacts).length > 0 ? (
                          <div className="space-y-1">
                            <p className="text-xs text-live font-medium">✓ Artifacts loaded</p>
                            <div className="flex flex-wrap gap-1.5">
                              {Object.keys(specKitArtifacts).map((f) => (
                                <span
                                  key={f}
                                  className="inline-flex items-center rounded-md px-2 py-0.5 text-[0.7rem] font-mono bg-[var(--panel-2)] text-muted border"
                                  style={{ borderColor: "var(--hairline)" }}
                                >
                                  {f}
                                </span>
                              ))}
                            </div>
                            <p className="text-[0.7rem] text-muted mt-1">
                              These artifacts will be prepended as project context to every message.
                            </p>
                          </div>
                        ) : (
                          <p className="text-xs text-muted">
                            No Spec Kit session found. Run the{" "}
                            <Link href="/playground/speckit" className="text-red hover:underline">
                              Spec Kit Wizard
                            </Link>{" "}
                            first to generate artifacts.
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {secondaryVars.length > 0 && (
                    <div>
                      <p className="kicker mb-2">Fields</p>
                      <div className="space-y-4">
                        {secondaryVars.map((v) => (
                          <VarRow
                            key={v.key}
                            variable={v}
                            value={values[v.key] ?? ""}
                            onChange={(val) => setValues((s) => ({ ...s, [v.key]: val }))}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* under the hood — the exact prompt sent to Copilot */}
          {!chatting && (
            <div className="border-t" style={{ borderColor: "var(--hairline)" }}>
              <button
                onClick={() => setPromptOpen((o) => !o)}
                className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-white/5 transition-colors"
              >
                <span className="kicker flex items-center gap-1.5">
                  <Eye className="h-3.5 w-3.5 text-red" /> Under the hood
                  <span className="normal-case tracking-normal text-muted font-sans">
                    — the exact prompt sent
                  </span>
                </span>
                <ChevronDown
                  className={`h-4 w-4 text-muted transition-transform ${promptOpen ? "rotate-180" : ""}`}
                />
              </button>
              {promptOpen && (
                <div className="px-5 pb-5">
                  <div className="relative rounded-xl border border-[var(--hairline)] bg-[var(--canvas)]">
                    <button
                      onClick={() => copyMsg(-1, sentPreview)}
                      className="absolute right-2 top-2 inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[0.7rem] text-muted hover:text-ink transition-colors bg-[var(--panel-2)]"
                      style={{ borderColor: "var(--hairline)" }}
                    >
                      {copiedId === -1 ? (
                        <Check className="h-3 w-3 text-live" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                      {copiedId === -1 ? "Copied" : "Copy"}
                    </button>
                    <pre className="overflow-x-auto p-3.5 pr-16 text-[0.72rem] font-mono leading-relaxed text-ink whitespace-pre-wrap break-words max-h-72">
                      {sentPreview}
                    </pre>
                  </div>
                  <p className="text-xs text-muted mt-1.5">
                    This persona is just a system instruction plus your message. Fill the input above
                    to see it update live.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* composer — always visible */}
          <div className="border-t p-4" style={{ borderColor: "var(--hairline)" }}>
            <div className="flex items-end gap-2.5">
              <textarea
                value={chatting ? followup : composerDraft}
                onChange={(e) => (chatting ? setFollowup(e.target.value) : setComposerDraft(e.target.value))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (running || !ready) return;
                    if (chatting) sendFollowup();
                    else if (firstReady) startChat();
                  }
                }}
                rows={chatting ? 2 : 3}
                disabled={!ready}
                placeholder={
                  chatting
                    ? `Reply to ${template.persona}…  (Enter to send, Shift+Enter for newline)`
                    : freePrompt
                      ? "Ask anything…  (Enter to send)"
                      : `${primaryVar?.placeholder ?? primaryVar?.label ?? "Type your input"}  (Enter to send)`
                }
                spellCheck={false}
                className="flex-1 rounded-xl bg-[var(--canvas)] border border-[var(--hairline)] px-3.5 py-2.5 text-sm placeholder:text-faint focus:border-red transition-colors resize-none disabled:opacity-50"
              />
              {running ? (
                <button
                  onClick={stop}
                  className="inline-flex items-center justify-center gap-2 rounded-xl py-3 px-4 font-medium text-white transition-all shrink-0"
                  style={{ background: "var(--faint)" }}
                >
                  <Square className="h-4 w-4 fill-current" /> Stop
                </button>
              ) : chatting ? (
                <button
                  onClick={sendFollowup}
                  disabled={!ready || !followup.trim()}
                  className="inline-flex items-center justify-center gap-2 rounded-xl py-3 px-5 font-medium text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                  style={{ background: "linear-gradient(180deg, var(--red-bright), var(--red))" }}
                >
                  <Send className="h-4 w-4" /> Send
                </button>
              ) : (
                <button
                  onClick={startChat}
                  disabled={!ready || !firstReady}
                  className="inline-flex items-center justify-center gap-2 rounded-xl py-3 px-5 font-medium text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                  style={{ background: "linear-gradient(180deg, var(--red-bright), var(--red))" }}
                >
                  <Play className="h-4 w-4 fill-current" /> Start
                </button>
              )}
            </div>
            <p className="mt-2 inline-flex items-center gap-1.5 text-[0.7rem] font-mono text-muted">
              <Terminal className="h-3 w-3" /> copilot · {template.persona}
              {!chatting && contextDir.trim() && (
                <span className="text-faint">· context on</span>
              )}
              {specKitEnabled && Object.keys(specKitArtifacts).length > 0 && (
                <span className="text-live">· spec kit on</span>
              )}
            </p>
          </div>
        </section>
        )}
      </div>

      {adoItemFor !== null && (
        <AdoWorkItemModal message={adoItemFor} onClose={() => setAdoItemFor(null)} />
      )}
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

function PersonaButton({
  t,
  active,
  disabled,
  onClick,
}: {
  t: PgTemplate;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full text-left rounded-xl p-3 border transition-all flex gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
      style={{
        borderColor: active ? "rgba(230,0,0,0.35)" : "transparent",
        background: active ? "rgba(230,0,0,0.08)" : "transparent",
      }}
    >
      <span
        className="grid place-items-center h-8 w-8 rounded-lg border shrink-0 transition-colors"
        style={{ borderColor: "var(--hairline)", background: "var(--panel-2)" }}
      >
        <CapIcon
          name={t.icon}
          className="h-4 w-4"
          style={{ color: active ? "var(--red)" : "var(--muted)" }}
        />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium leading-snug text-ink">{t.name}</span>
        <span className="block text-xs text-muted leading-snug mt-0.5 line-clamp-2">
          {t.description}
        </span>
      </span>
    </button>
  );
}

type EditVar = PgVariable & { _uid: string };

function PersonaEditor({
  init,
  existing,
  onSave,
  onCancel,
}: {
  init: CustomPersona;
  existing: boolean;
  onSave: (p: CustomPersona) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(init.name);
  const [persona, setPersona] = useState(init.persona);
  const [category, setCategory] = useState(init.category);
  const [description, setDescription] = useState(init.description);
  const [icon, setIcon] = useState(init.icon);
  const [prompt, setPrompt] = useState(init.prompt);
  const [vars, setVars] = useState<EditVar[]>(
    init.variables.map((v, i) => ({ ...v, _uid: `s${i}` })),
  );
  const [showErrors, setShowErrors] = useState(false);
  const [dragUid, setDragUid] = useState<string | null>(null);
  const uidRef = useRef(0);

  function reorderVars(fromUid: string, toUid: string) {
    if (fromUid === toUid) return;
    setVars((vs) => {
      const from = vs.findIndex((v) => v._uid === fromUid);
      const to = vs.findIndex((v) => v._uid === toUid);
      if (from < 0 || to < 0) return vs;
      const next = [...vs];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  function addVar() {
    setVars((vs) => [
      ...vs,
      { key: "", label: "", type: "text", _uid: `n${(uidRef.current += 1)}` },
    ]);
  }
  function patchVar(uid: string, patch: Partial<EditVar>) {
    setVars((vs) => vs.map((v) => (v._uid === uid ? { ...v, ...patch } : v)));
  }
  function removeVar(uid: string) {
    setVars((vs) => vs.filter((v) => v._uid !== uid));
  }
  function insertToken(key: string) {
    if (!key) return;
    setPrompt((p) => (p.endsWith("\n") || p === "" ? p : `${p}\n`) + `{{${key}}}`);
  }

  const tokens = Array.from(prompt.matchAll(/\{\{(\w+)\}\}/g), (m) => m[1]);
  const keys = vars.map((v) => v.key).filter(Boolean);

  const errors: string[] = [];
  if (!name.trim()) errors.push("Name is required.");
  if (!prompt.trim()) errors.push("Prompt is required.");
  vars.forEach((v, i) => {
    if (!v.key.trim()) errors.push(`Field ${i + 1}: key is required.`);
    else if (!/^\w+$/.test(v.key))
      errors.push(`Field ${i + 1}: key "${v.key}" must be letters, numbers, or underscores only.`);
  });
  const dups = [...new Set(keys.filter((k, i) => keys.indexOf(k) !== i))];
  if (dups.length) errors.push(`Duplicate field keys: ${dups.join(", ")}.`);

  const warnings: string[] = [];
  [...new Set(tokens)].forEach((t) => {
    if (!keys.includes(t)) warnings.push(`Prompt uses {{${t}}} but no field defines it.`);
  });
  keys.forEach((k) => {
    if (!tokens.includes(k)) warnings.push(`Field "${k}" is never used in the prompt.`);
  });

  function handleSave() {
    if (errors.length) {
      setShowErrors(true);
      return;
    }
    onSave({
      id: init.id,
      name: name.trim(),
      category: category.trim() || "My Personas",
      icon,
      description: description.trim() || name.trim(),
      persona: persona.trim() || "a helpful, expert AI assistant",
      variables: vars.map((v) => {
        const base: PgVariable = { key: v.key.trim(), label: v.label.trim() || v.key.trim(), type: v.type };
        if (v.placeholder?.trim()) base.placeholder = v.placeholder.trim();
        if (v.type === "select") base.options = (v.options ?? []).filter(Boolean);
        return base;
      }),
      prompt,
      custom: true,
      createdAt: init.createdAt || Date.now(),
    });
  }

  const inputCls =
    "w-full rounded-xl bg-[var(--canvas)] border border-[var(--hairline)] px-3.5 py-2.5 text-sm placeholder:text-faint focus:border-red transition-colors";

  return (
    <section className="card rounded-2xl flex flex-col overflow-hidden min-h-[46rem]">
      <div
        className="flex items-center justify-between px-5 py-4 border-b"
        style={{ borderColor: "var(--hairline)" }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="grid place-items-center h-10 w-10 rounded-2xl border shrink-0"
            style={{ borderColor: "var(--hairline)", background: "var(--panel-2)" }}
          >
            <CapIcon name={icon} className="h-5 w-5" style={{ color: "var(--red)" }} />
          </span>
          <div className="min-w-0">
            <p className="kicker">Persona editor</p>
            <h2 className="font-display font-semibold text-lg leading-tight truncate">
              {existing ? "Edit persona" : "New persona"}
            </h2>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium border text-muted hover:text-ink transition-colors"
            style={{ borderColor: "var(--hairline)" }}
          >
            <X className="h-3.5 w-3.5" /> Cancel
          </button>
          <button
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium text-white transition-all"
            style={{ background: "linear-gradient(180deg, var(--red-bright), var(--red))" }}
          >
            <Check className="h-3.5 w-3.5" /> Save persona
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-5 space-y-6" style={{ maxHeight: "48rem" }}>
        {showErrors && errors.length > 0 && (
          <div
            className="rounded-xl border px-4 py-3 text-sm"
            style={{ borderColor: "rgba(230,0,0,0.35)", background: "rgba(230,0,0,0.06)" }}
          >
            <p className="font-medium text-red mb-1">Fix before saving:</p>
            <ul className="list-disc pl-5 space-y-0.5 text-ink">
              {errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Release Notes Writer"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Category</label>
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="My Personas"
              className={inputCls}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Role <span className="text-muted font-normal">— the model plays this for the whole chat</span>
          </label>
          <input
            value={persona}
            onChange={(e) => setPersona(e.target.value)}
            placeholder="an expert technical writer"
            className={inputCls}
          />
          <p className="text-xs text-muted mt-1.5 font-mono">
            copilot · {persona.trim() || "a helpful, expert AI assistant"}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Description <span className="text-muted font-normal">— shown in the sidebar</span>
          </label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="One line on what this persona does."
            className={inputCls}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Icon</label>
          <div className="flex flex-wrap gap-1.5">
            {ICON_KEYS.map((k) => {
              const on = k === icon;
              return (
                <button
                  key={k}
                  onClick={() => setIcon(k)}
                  aria-label={k}
                  title={k}
                  className="grid place-items-center h-9 w-9 rounded-lg border transition-colors"
                  style={{
                    borderColor: on ? "rgba(230,0,0,0.5)" : "var(--hairline)",
                    background: on ? "rgba(230,0,0,0.08)" : "var(--panel-2)",
                  }}
                >
                  <CapIcon name={k} className="h-4 w-4" style={{ color: on ? "var(--red)" : "var(--muted)" }} />
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium">
              Fields <span className="text-muted font-normal">— fill-in-the-blank inputs</span>
            </label>
            <button
              onClick={addVar}
              className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs text-muted hover:text-ink transition-colors"
              style={{ borderColor: "var(--hairline)" }}
            >
              <Plus className="h-3.5 w-3.5" /> Add field
            </button>
          </div>
          {vars.length === 0 ? (
            <p className="text-xs text-muted">
              No fields — the whole prompt is sent as-is. Add a field to expose a{" "}
              <code className="font-mono text-ink">{"{{placeholder}}"}</code> users fill in.
            </p>
          ) : (
            <div className="space-y-3">
              {vars.map((v) => (
                <div
                  key={v._uid}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragUid) reorderVars(dragUid, v._uid);
                    setDragUid(null);
                  }}
                  className={`rounded-xl border p-3 space-y-2.5 transition-opacity ${dragUid === v._uid ? "opacity-40" : ""}`}
                  style={{ borderColor: "var(--hairline)", background: "var(--panel-2)" }}
                >
                  <div className="flex items-center gap-2 -mb-0.5">
                    <span
                      draggable
                      onDragStart={() => setDragUid(v._uid)}
                      onDragEnd={() => setDragUid(null)}
                      title="Drag to reorder"
                      className="grid place-items-center h-6 w-5 -ml-1 cursor-grab active:cursor-grabbing text-faint hover:text-muted transition-colors"
                    >
                      <GripVertical className="h-4 w-4" />
                    </span>
                    <span className="text-[0.7rem] uppercase tracking-wider text-faint">Field</span>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-2.5">
                    <input
                      value={v.label}
                      onChange={(e) => {
                        const label = e.target.value;
                        patchVar(v._uid, {
                          label,
                          ...(v.key ? {} : { key: slugify(label) }),
                        });
                      }}
                      placeholder="Label — e.g. Feature idea"
                      className={inputCls}
                    />
                    <div className="flex gap-2">
                      <input
                        value={v.key}
                        onChange={(e) => patchVar(v._uid, { key: e.target.value })}
                        placeholder="key"
                        spellCheck={false}
                        className={`${inputCls} font-mono`}
                      />
                      <button
                        onClick={() => insertToken(v.key)}
                        disabled={!v.key}
                        title="Insert {{key}} into the prompt"
                        className="shrink-0 inline-flex items-center rounded-lg border px-2.5 text-xs text-muted hover:text-ink disabled:opacity-40 transition-colors"
                        style={{ borderColor: "var(--hairline)" }}
                      >
                        Insert
                      </button>
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-2.5">
                    <select
                      value={v.type}
                      onChange={(e) => patchVar(v._uid, { type: e.target.value as PgVarType })}
                      className={inputCls}
                    >
                      <option value="text">Text (single line)</option>
                      <option value="textarea">Textarea (multi-line)</option>
                      <option value="select">Select (dropdown)</option>
                    </select>
                    <input
                      value={v.placeholder ?? ""}
                      onChange={(e) => patchVar(v._uid, { placeholder: e.target.value })}
                      placeholder="Placeholder (optional)"
                      className={inputCls}
                    />
                  </div>
                  {v.type === "select" && (
                    <input
                      value={(v.options ?? []).join(", ")}
                      onChange={(e) =>
                        patchVar(v._uid, {
                          options: e.target.value.split(",").map((o) => o.trim()),
                        })
                      }
                      placeholder="Options, comma-separated — e.g. Low, Medium, High"
                      className={inputCls}
                    />
                  )}
                  <div className="flex justify-end">
                    <button
                      onClick={() => removeVar(v._uid)}
                      className="inline-flex items-center gap-1.5 text-xs text-faint hover:text-red transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Remove field
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Prompt <span className="text-muted font-normal">— use {"{{key}}"} for field values</span>
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={8}
            placeholder="Write the opening instruction. Reference fields as {{key}}."
            spellCheck={false}
            className={`${inputCls} font-mono resize-y`}
          />
          {warnings.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-xs text-soon">
              {warnings.map((w, i) => (
                <li key={i}>⚠ {w}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

function VarRow({
  variable,
  value,
  onChange,
}: {
  variable: PgVariable;
  value: string;
  onChange: (v: string) => void;
}) {
  const base =
    "w-full rounded-xl bg-[var(--canvas)] border border-[var(--hairline)] px-3.5 py-3 text-sm focus:border-red transition-colors";
  return (
    <div>
      <label className="block text-sm font-medium mb-2">{variable.label}</label>
      {variable.type === "select" ? (
        <select value={value} onChange={(e) => onChange(e.target.value)} className={base}>
          {variable.options?.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : variable.type === "textarea" ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={variable.placeholder}
          rows={5}
          className={`${base} placeholder:text-faint resize-y`}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={variable.placeholder}
          className={`${base} placeholder:text-faint`}
        />
      )}
    </div>
  );
}
