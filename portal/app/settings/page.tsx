"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import {
  Check,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  GitFork,
  KeyRound,
  Loader,
  LogIn,
  Moon,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  Users,
} from "lucide-react";
import { useApp } from "@/components/AppProvider";
import type { TokenStatus } from "@/components/AppProvider";

const NAV = [
  { key: "credentials", label: "Credentials", icon: KeyRound, badge: (ready: boolean) => (ready ? "1/1" : "0/1") },
  { key: "appearance", label: "Appearance", icon: SlidersHorizontal },
  { key: "teams", label: "Teams", icon: Users, soon: true },
  { key: "repositories", label: "Repositories", icon: GitFork, soon: true },
  { key: "identity", label: "Jira Sign-in", icon: LogIn, soon: true },
];

export default function SettingsPage() {
  const { ready } = useApp();
  const [section, setSection] = useState("credentials");

  return (
    <main className="relative z-10 mx-auto max-w-5xl px-6 pb-24">
      {/* header band */}
      <div className="pt-10">
        <div className="flex items-center gap-4">
          <div
            className="grid place-items-center h-12 w-12 rounded-2xl"
            style={{ background: "linear-gradient(160deg, var(--red-bright), var(--red))" }}
          >
            <SlidersHorizontal className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="font-display text-3xl font-bold leading-tight">Settings</h1>
            <p className="text-sm text-muted">
              Manage the credentials used across every capability.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-10 grid md:grid-cols-[15rem_1fr] gap-8">
        {/* sidebar */}
        <nav className="space-y-1 md:sticky md:top-[5.5rem] self-start">
          {NAV.map((n) => {
            const active = section === n.key;
            return (
              <button
                key={n.key}
                onClick={() => !n.soon && setSection(n.key)}
                disabled={n.soon}
                className="w-full flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm transition-colors disabled:opacity-45 disabled:cursor-not-allowed"
                style={{
                  background: active ? "rgba(230,0,0,0.10)" : "transparent",
                  color: active ? "var(--ink)" : "var(--muted)",
                  border: `1px solid ${active ? "var(--red)" : "transparent"}`,
                }}
              >
                <span className="flex items-center gap-2.5">
                  <n.icon className="h-4 w-4" />
                  {n.label}
                </span>
                {n.soon ? (
                  <span className="text-[0.6rem] font-mono uppercase text-soon">soon</span>
                ) : n.badge ? (
                  <span className="text-[0.65rem] font-mono text-muted">{n.badge(ready)}</span>
                ) : null}
              </button>
            );
          })}
        </nav>

        {/* content */}
        <div>
          {section === "credentials" && <Credentials />}
          {section === "appearance" && <Appearance />}
        </div>
      </div>
    </main>
  );
}

function Credentials() {
  const {
    githubToken,
    setGithubToken,
    tokenStatus,
    login,
    validateToken,
    adoPat,
    setAdoPat,
    adoPatStatus,
    adoPatIdentity,
    validateAdoPat,
    adoIdentity,
    adoChecking,
    adoLoggingIn,
    adoLoggingOut,
    recheckAdo,
    loginAdo,
    logoutAdo,
  } = useApp();
  const [azMissing, setAzMissing] = useState(false);

  async function handleAdoLogin() {
    const ok = await loginAdo();
    setAzMissing(!ok);
  }

  // debounce validation after the user stops typing
  useEffect(() => {
    const t = setTimeout(() => validateToken(githubToken), 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [githubToken]);

  useEffect(() => {
    const t = setTimeout(() => validateAdoPat(adoPat), 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adoPat]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      <div>
        <h2 className="font-display text-xl font-semibold">Credentials</h2>
        <p className="text-sm text-muted mt-1">
          Your token stays in this browser — only ever sent out to validate it.
        </p>
      </div>

      {/* Azure DevOps access — host Azure CLI (az login) identity */}
      <section className="panel rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck className="h-4 w-4 text-red" />
          <h3 className="font-medium">Azure DevOps access</h3>
          <Dot ok={!!adoIdentity} />
        </div>
        <p className="text-xs text-muted mb-4">
          The hub queues pipelines as your Azure CLI identity — sign in below, no token to
          paste. Azure CLI keeps the session on this machine; sign out clears it.
        </p>

        {adoIdentity ? (
          <div className="rounded-xl border border-[var(--hairline)] p-3.5 flex items-center gap-3">
            <CircleCheck className="h-5 w-5 text-live shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{adoIdentity}</p>
              <p className="text-xs text-muted font-mono">signed in via Azure CLI</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={recheckAdo}
                disabled={adoChecking}
                className="text-xs text-muted hover:text-ink transition-colors disabled:opacity-50"
              >
                {adoChecking ? "Checking…" : "Re-check"}
              </button>
              <button
                onClick={logoutAdo}
                disabled={adoLoggingOut}
                className="text-xs text-red/80 hover:text-red transition-colors disabled:opacity-50"
              >
                {adoLoggingOut ? "Signing out…" : "Sign out"}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <button
              onClick={handleAdoLogin}
              disabled={adoLoggingIn}
              className="inline-flex items-center gap-2.5 rounded-xl border border-[var(--hairline-strong)] px-4 py-3 text-sm font-medium hover:border-red transition-colors disabled:opacity-50"
            >
              {adoLoggingIn ? <Loader className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {adoLoggingIn ? "Opening browser… complete sign-in" : "Sign in with Azure CLI"}
            </button>

            {azMissing && (
              <div className="space-y-2.5 pt-1">
                <div className="flex items-start gap-2.5 rounded-xl border border-[var(--soon)]/30 bg-[var(--soon)]/[0.06] p-3.5">
                  <CircleAlert className="h-4 w-4 text-soon shrink-0 mt-0.5" />
                  <p className="text-xs text-[var(--ink-dim)] leading-relaxed">
                    <span className="text-ink font-medium">Azure CLI not found.</span> Install it,
                    then click sign in again.
                  </p>
                </div>
                <Cmd text="brew install azure-cli" />
                <button
                  onClick={recheckAdo}
                  disabled={adoChecking}
                  className="text-xs text-info hover:underline disabled:opacity-50"
                >
                  {adoChecking ? "Checking…" : "Already installed? Re-check"}
                </button>
              </div>
            )}
          </div>
        )}

        <HowToAz />

        {/* Per-user PAT — for a shared/hosted hub where the server has no az login */}
        <div className="mt-5 pt-5 border-t border-[var(--hairline)]">
          <div className="flex items-center gap-2 mb-1">
            <KeyRound className="h-4 w-4 text-muted" />
            <h4 className="text-sm font-medium">Or use a Personal Access Token</h4>
            <Dot ok={adoPatStatus === "valid"} />
          </div>
          <p className="text-xs text-muted mb-3">
            For a shared or Docker-hosted hub where Azure CLI isn&apos;t available. Each user pastes
            their own PAT so reads run as their identity. Needs <span className="font-mono text-ink">Work Items (Read)</span> and{" "}
            <span className="font-mono text-ink">Code (Read)</span> scopes.
          </p>

          <SecretInput value={adoPat} onChange={setAdoPat} placeholder="Azure DevOps PAT" />

          <AdoPatStatusLine
            status={adoPatStatus}
            identity={adoPatIdentity}
            hasValue={adoPat.trim().length >= 8}
          />

          <a
            href="https://dev.azure.com/vfuk-digital/_usersSettings/tokens"
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-block text-xs text-info hover:underline"
          >
            Create a PAT in Azure DevOps →
          </a>

          <HowToPat />
        </div>
      </section>

      {/* GitHub token */}
      <section className="panel rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-1">
          <GithubMark />
          <h3 className="font-medium">GitHub Copilot token</h3>
          <Dot ok={tokenStatus === "valid"} />
        </div>
        <p className="text-xs text-muted mb-4">
          Required for Copilot AI features. Validated live against the GitHub API.
        </p>

        <SecretInput value={githubToken} onChange={setGithubToken} placeholder="gho_… or ghp_…" />

        <TokenStatusLine status={tokenStatus} login={login} hasValue={githubToken.trim().length >= 8} />

        <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-[var(--soon)]/30 bg-[var(--soon)]/[0.06] p-3.5">
          <CircleAlert className="h-4 w-4 text-soon shrink-0 mt-0.5" />
          <p className="text-xs text-[var(--ink-dim)] leading-relaxed">
            <span className="text-ink font-medium">Saved in this browser.</span> Kept in
            local storage so it survives refresh and restart — sent out only to validate it, never
            to our servers. Clear the field to remove it. Avoid this on a shared machine.
          </p>
        </div>

        <HowTo />
      </section>
    </motion.div>
  );
}

function SecretInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl bg-[var(--canvas)] border border-[var(--hairline)] pl-3.5 pr-11 py-3 text-sm font-mono placeholder:text-faint focus:border-red transition-colors"
      />
      <button
        onClick={() => setShow((s) => !s)}
        className="absolute right-2 top-1/2 -translate-y-1/2 grid place-items-center h-8 w-8 rounded-lg text-muted hover:text-ink hover:bg-white/5 transition-colors"
        aria-label={show ? "Hide" : "Show"}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function HowTo() {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 text-sm text-info hover:underline"
      >
        <ChevronDown
          className="h-4 w-4 transition-transform"
          style={{ transform: open ? "rotate(180deg)" : "none" }}
        />
        How to get your GitHub token
      </button>

      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="overflow-hidden"
        >
          <div className="mt-4 space-y-5">
            <div className="rounded-xl border border-[var(--hairline)] p-4">
              <p className="text-sm font-medium flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-live" />
                Vodafone Enterprise account
                <span className="text-[0.6rem] font-mono uppercase text-live">recommended</span>
              </p>
              <p className="text-xs text-muted mt-1.5">Install the GitHub CLI, then run:</p>
              <div className="mt-3 space-y-2">
                <Cmd text="brew install gh" />
                <Cmd text="gh auth login --hostname github.com --git-protocol https --web" />
                <Cmd text="gh auth token" />
              </div>
              <p className="text-xs text-muted mt-2 font-mono">Token starts with gho_</p>
            </div>

            <div className="rounded-xl border border-[var(--hairline)] p-4">
              <p className="text-sm font-medium flex items-center gap-2">
                <GithubMark /> Personal GitHub account
              </p>
              <p className="text-xs text-muted mt-1.5 leading-relaxed">
                Create a Classic PAT at{" "}
                <a
                  href="https://github.com/settings/tokens"
                  target="_blank"
                  rel="noreferrer"
                  className="text-info hover:underline"
                >
                  github.com/settings/tokens
                </a>{" "}
                with the <span className="font-mono text-ink">copilot</span> scope. Token starts
                with <span className="font-mono text-ink">ghp_</span>.
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function Cmd({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }
  return (
    <div
      className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 font-mono text-[0.72rem]"
      style={{ background: "var(--log-bg)", color: "#cfcfd6" }}
    >
      <code className="truncate">{text}</code>
      <button
        onClick={copy}
        className="shrink-0 text-muted hover:text-white transition-colors"
        aria-label="Copy"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-live" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

function CollapseToggle({
  open,
  onClick,
  label,
}: {
  open: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-sm text-info hover:underline"
    >
      <ChevronDown
        className="h-4 w-4 transition-transform"
        style={{ transform: open ? "rotate(180deg)" : "none" }}
      />
      {label}
    </button>
  );
}

function Numbered({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--hairline-strong)] bg-[var(--panel)] font-mono text-[0.7rem] text-red">
        {n}
      </span>
      <div className="min-w-0 flex-1 pt-0.5">{children}</div>
    </li>
  );
}

function HowToAz() {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-4">
      <CollapseToggle open={open} onClick={() => setOpen((o) => !o)} label="How to install the Azure CLI" />
      {open && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="overflow-hidden">
          <ol className="mt-4 space-y-4">
            <Numbered n={1}>
              <p className="text-sm font-medium">Install Homebrew</p>
              <p className="text-xs text-muted mt-0.5 mb-2">macOS package manager. Skip if <span className="font-mono text-ink">brew --version</span> already works.</p>
              <Cmd text={'/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'} />
            </Numbered>
            <Numbered n={2}>
              <p className="text-sm font-medium">Install the Azure CLI</p>
              <div className="mt-2">
                <Cmd text="brew install azure-cli" />
              </div>
              <p className="text-xs text-muted mt-2">Windows: <span className="font-mono text-ink">winget install -e --id Microsoft.AzureCLI</span></p>
            </Numbered>
            <Numbered n={3}>
              <p className="text-sm font-medium">Sign in</p>
              <p className="text-xs text-muted mt-0.5">Click <span className="text-ink">Sign in with Azure CLI</span> above, or run <span className="font-mono text-ink">az login</span> — a browser opens to authenticate.</p>
            </Numbered>
          </ol>
        </motion.div>
      )}
    </div>
  );
}

function HowToPat() {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-4">
      <CollapseToggle open={open} onClick={() => setOpen((o) => !o)} label="How to create a PAT" />
      {open && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="overflow-hidden">
          <ol className="mt-4 space-y-4">
            <Numbered n={1}>
              <p className="text-sm font-medium">Open Azure DevOps tokens</p>
              <a
                href="https://dev.azure.com/vfuk-digital/_usersSettings/tokens"
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-xs text-info hover:underline"
              >
                dev.azure.com · User settings · Personal access tokens <ExternalLink className="h-3 w-3" />
              </a>
            </Numbered>
            <Numbered n={2}>
              <p className="text-sm font-medium">New Token</p>
              <p className="text-xs text-muted mt-0.5">Name it (e.g. <span className="font-mono text-ink">hub</span>) and set an expiry.</p>
            </Numbered>
            <Numbered n={3}>
              <p className="text-sm font-medium">Set scopes</p>
              <p className="text-xs text-muted mt-0.5"><span className="font-mono text-ink">Work Items (Read)</span> and <span className="font-mono text-ink">Code (Read)</span>. Nothing more.</p>
            </Numbered>
            <Numbered n={4}>
              <p className="text-sm font-medium">Create, copy, paste</p>
              <p className="text-xs text-muted mt-0.5">Copy the token (shown once) and paste it in the field above.</p>
            </Numbered>
          </ol>
        </motion.div>
      )}
    </div>
  );
}

function Appearance() {
  const { theme, setTheme } = useApp();
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <h2 className="font-display text-xl font-semibold">Appearance</h2>
      <p className="text-sm text-muted mt-1 mb-5">Choose how the console looks.</p>
      <div className="grid grid-cols-2 gap-3 max-w-sm">
        <ThemeCard active={theme === "dark"} onClick={() => setTheme("dark")} icon={<Moon className="h-4 w-4" />} label="Dark" />
        <ThemeCard active={theme === "light"} onClick={() => setTheme("light")} icon={<Sun className="h-4 w-4" />} label="Light" />
      </div>
    </motion.div>
  );
}

function ThemeCard({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center justify-center gap-2 rounded-xl border py-4 text-sm font-medium transition-colors"
      style={{
        borderColor: active ? "var(--red)" : "var(--hairline)",
        background: active ? "rgba(230,0,0,0.10)" : "transparent",
        color: active ? "var(--ink)" : "var(--muted)",
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function TokenStatusLine({
  status,
  login,
  hasValue,
}: {
  status: TokenStatus;
  login: string | null;
  hasValue: boolean;
}) {
  if (!hasValue || status === "idle") return null;
  if (status === "checking")
    return (
      <p className="mt-2.5 flex items-center gap-2 text-xs font-mono text-muted">
        <Loader className="h-3.5 w-3.5 animate-spin" /> validating with GitHub…
      </p>
    );
  if (status === "valid")
    return (
      <p className="mt-2.5 flex items-center gap-2 text-xs font-mono text-live">
        <CircleCheck className="h-3.5 w-3.5" /> Valid{login ? ` · ${login}` : ""}
      </p>
    );
  return (
    <p className="mt-2.5 flex items-center gap-2 text-xs font-mono text-red">
      <CircleAlert className="h-3.5 w-3.5" /> Invalid or expired token
    </p>
  );
}

function AdoPatStatusLine({
  status,
  identity,
  hasValue,
}: {
  status: TokenStatus;
  identity: string | null;
  hasValue: boolean;
}) {
  if (!hasValue || status === "idle") return null;
  if (status === "checking")
    return (
      <p className="mt-2.5 flex items-center gap-2 text-xs font-mono text-muted">
        <Loader className="h-3.5 w-3.5 animate-spin" /> validating with Azure DevOps…
      </p>
    );
  if (status === "valid")
    return (
      <p className="mt-2.5 flex items-center gap-2 text-xs font-mono text-live">
        <CircleCheck className="h-3.5 w-3.5" /> Valid{identity ? ` · ${identity}` : ""}
      </p>
    );
  return (
    <p className="mt-2.5 flex items-center gap-2 text-xs font-mono text-red">
      <CircleAlert className="h-3.5 w-3.5" /> Invalid or expired PAT
    </p>
  );
}

function Dot({ ok }: { ok: boolean }) {
  return (
    <span
      className="ml-auto h-2 w-2 rounded-full"
      style={{ background: ok ? "var(--live)" : "var(--faint)" }}
    />
  );
}

function GithubMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}
