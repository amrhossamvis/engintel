"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Check,
  Cloud,
  Copy,
  ExternalLink,
  GitBranch,
  Info,
  Mail,
  ScrollText,
  ShieldCheck,
} from "lucide-react";

// Real URLs from the VOIS guide. Items set to null are Confluence/OneRC/MyIT
// process pages whose canonical URLs live on the intranet — swap in when known.
const LINKS = {
  ghCloud: "https://github.com/enterprises/vodafone-group/",
  standalone: "https://github.com/enterprises/vodafone-copilot/",
  standaloneSSO: "https://github.com/enterprises/vodafone-copilot/sso",
  copilot: "https://github.com/copilot",
  oneRcOnboarding: null as string | null, // "2.2 Onboarding Using OneRC Portal" (Confluence)
  copilotAccessRequest: null as string | null, // "GitHub Copilot Access Request"
  newRequirement: null as string | null, // MyIT "New Requirement"
  serviceRequest: null as string | null, // oneitsm-dwp SR link
} as const;

function CopyChip({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="group inline-flex items-center gap-2 rounded-lg border border-[var(--hairline)] bg-[var(--canvas)] px-3 py-1.5 font-mono text-xs text-ink-dim hover:border-[var(--hairline-strong)] transition-colors"
      title="Copy security group"
    >
      <span className="truncate">{value}</span>
      {copied ? (
        <Check className="h-3.5 w-3.5 text-live shrink-0" />
      ) : (
        <Copy className="h-3.5 w-3.5 text-faint group-hover:text-ink shrink-0" />
      )}
    </button>
  );
}

function Ref({ href, children }: { href: string | null; children: React.ReactNode }) {
  if (!href) {
    return (
      <span className="inline-flex items-center gap-1 text-ink-dim underline decoration-dotted decoration-[var(--faint)] underline-offset-2">
        {children}
        <span className="text-[0.6rem] font-mono uppercase tracking-wider text-faint">Confluence</span>
      </span>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-red hover:text-[var(--red-bright)] underline decoration-[var(--hairline-strong)] underline-offset-2 transition-colors"
    >
      {children}
      <ExternalLink className="h-3 w-3 shrink-0" />
    </a>
  );
}

export function CopilotAccessDoc() {
  return (
    <main className="relative z-10 mx-auto max-w-3xl px-6 pb-24">
      {/* hero */}
      <section className="pt-10 pb-8">
        <p className="kicker flex items-center gap-2">
          <ScrollText className="h-3.5 w-3.5 text-red" />
          Docs · Access
        </p>
        <h1 className="font-display font-extrabold tracking-tight mt-4 text-[clamp(2rem,4.5vw,3.2rem)] leading-[1.02]">
          Get GitHub Copilot
          <br />
          at <span className="text-red">VOIS</span>.
        </h1>
        <p className="text-[var(--ink-dim)] text-lg mt-5 leading-relaxed">
          Onboarding for GitHub Copilot at Vodafone — pick your access type, raise the request,
          start coding with AI. ~5 min read.
        </p>
        <p className="mt-4 font-mono text-xs text-faint">Last verified Apr 2026 · owner: product team</p>
      </section>

      {/* Step: which path */}
      <h2 className="font-display font-bold text-xl tracking-tight mb-1">1 · Which path are you?</h2>
      <p className="text-sm text-muted mb-5">Your source-code platform decides your access type.</p>
      <div className="grid sm:grid-cols-2 gap-4 mb-10">
        <div className="card rounded-2xl p-5" data-live="false">
          <div className="flex items-center gap-2.5 mb-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[color-mix(in_srgb,transparent_86%,var(--info))] text-[var(--info)]">
              <Cloud className="h-4 w-4" />
            </span>
            <div>
              <h3 className="font-display font-semibold text-[0.95rem]">GitHub user</h3>
              <p className="text-xs text-muted">Code lives in GitHub</p>
            </div>
          </div>
          <p className="text-sm text-ink-dim leading-relaxed mb-3">
            Join GitHub Enterprise Cloud{" "}
            <a href={LINKS.ghCloud} target="_blank" rel="noopener noreferrer" className="text-red hover:underline">
              Vodafone-Group
            </a>{" "}
            — source code, Advanced Security and Copilot.
          </p>
          <p className="kicker mb-1.5">Security group</p>
          <CopyChip value="APP-VFGroup-VOIS-GHEC-User-PROD" />
        </div>

        <div className="card rounded-2xl p-5" data-live="false">
          <div className="flex items-center gap-2.5 mb-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[color-mix(in_srgb,transparent_86%,var(--soon))] text-[var(--soon)]">
              <GitBranch className="h-4 w-4" />
            </span>
            <div>
              <h3 className="font-display font-semibold text-[0.95rem]">Non-GitHub user</h3>
              <p className="text-xs text-muted">GitLab / Bitbucket / other</p>
            </div>
          </div>
          <p className="text-sm text-ink-dim leading-relaxed mb-3">
            Join the Standalone enterprise{" "}
            <a href={LINKS.standalone} target="_blank" rel="noopener noreferrer" className="text-red hover:underline">
              Vodafone-Copilot
            </a>{" "}
            — a Copilot licence only, no GitHub seat. Keep your existing repos.
          </p>
          <p className="kicker mb-1.5">Security group</p>
          <CopyChip value="APP-VFGroup-VOIS-GHEC-COPILOT-User-PROD" />
        </div>
      </div>

      <div className="rounded-xl border border-[var(--hairline)] bg-[var(--canvas-2)] p-4 mb-12 flex gap-3">
        <Info className="h-4 w-4 text-[var(--info)] shrink-0 mt-0.5" />
        <p className="text-sm text-ink-dim leading-relaxed">
          <span className="text-ink font-medium">What “Standalone” means:</span> Copilot in your IDE
          with no GitHub.com repos, organisations or Actions. Features tied to GitHub as your source
          control aren’t available — see the comparison below.
        </p>
      </div>

      {/* Step: 3-step flow */}
      <h2 className="font-display font-bold text-xl tracking-tight mb-5">2 · Raise the request</h2>
      <ol className="space-y-4 mb-6">
        {[
          {
            t: "Raise a UAM request",
            b: (
              <>
                Get added to your security group via the{" "}
                <Ref href={LINKS.oneRcOnboarding}>OneRC Portal onboarding</Ref>. Use the group for
                your path (above).
              </>
            ),
          },
          {
            t: "Check GitHub access",
            b: (
              <>
                Verify at{" "}
                <a href={LINKS.ghCloud} target="_blank" rel="noopener noreferrer" className="text-red hover:underline">
                  Cloud
                </a>{" "}
                or{" "}
                <a href={LINKS.standalone} target="_blank" rel="noopener noreferrer" className="text-red hover:underline">
                  Standalone
                </a>
                . No access? Raise the UAM request (step 1). Access exists? Continue.
              </>
            ),
          },
          {
            t: "Raise the Copilot Access Request",
            b: (
              <>
                Open the <Ref href={LINKS.copilotAccessRequest}>GitHub Copilot Access Request</Ref> and
                pick your action — Add, Remove or Replace users (below).
              </>
            ),
          },
        ].map((s, i) => (
          <li key={i} className="flex gap-4">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--hairline-strong)] bg-[var(--panel)] font-mono text-xs text-red shrink-0">
              {i + 1}
            </span>
            <div className="pt-1">
              <p className="font-display font-semibold text-[0.95rem]">{s.t}</p>
              <p className="text-sm text-muted mt-1 leading-relaxed">{s.b}</p>
            </div>
          </li>
        ))}
      </ol>

      {/* Request types */}
      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <div className="rounded-xl border border-[var(--hairline)] p-4">
          <p className="kicker mb-2">Add · existing team</p>
          <p className="text-sm text-ink-dim leading-relaxed">
            Give the team name (or <code className="font-mono text-red text-xs">USE_REF_USER</code> +
            a colleague who already has access) and get line-manager approval. Auto-raised to CI/CD
            ops — <span className="text-ink">SLA 3 days</span>.
          </p>
        </div>
        <div className="rounded-xl border border-[var(--hairline)] p-4">
          <p className="kicker mb-2">Add · new team</p>
          <p className="text-sm text-ink-dim leading-relaxed">
            Raise a <Ref href={LINKS.newRequirement}>New Requirement</Ref> in MyIT with: cost
            confirmation (<span className="text-ink">€21.70 / user / month</span>), team name{" "}
            <span className="font-mono text-xs">[Market]-Dept-Team</span>, cost centre, SPOC and user
            list.
          </p>
        </div>
      </div>

      {/* Replace tip — billing */}
      <div className="rounded-xl border border-[color-mix(in_srgb,transparent_70%,var(--soon))] bg-[color-mix(in_srgb,transparent_92%,var(--soon))] p-4 mb-12 flex gap-3">
        <AlertTriangle className="h-4 w-4 text-[var(--soon)] shrink-0 mt-0.5" />
        <div>
          <p className="font-display font-semibold text-[0.95rem] text-ink">Replacing a user? Time it right.</p>
          <p className="text-sm text-ink-dim mt-1 leading-relaxed">
            Licences bill for the full month regardless of when access is revoked. To avoid wasting a
            seat: <span className="text-ink">remove the outgoing user ~15 days before month-end</span>,
            then <span className="text-ink">add the replacement at the start of the new month</span>.
          </p>
        </div>
      </div>

      {/* Feature comparison */}
      <h2 className="font-display font-bold text-xl tracking-tight mb-1">Cloud vs Standalone</h2>
      <p className="text-sm text-muted mb-5">Both give the full in-IDE experience. Cloud adds GitHub-native features.</p>
      <div className="overflow-x-auto rounded-2xl border border-[var(--hairline)] mb-12">
        <table className="w-full text-sm min-w-[34rem]">
          <thead>
            <tr className="border-b border-[var(--hairline)] bg-[var(--canvas-2)]">
              <th className="text-left font-medium text-muted px-4 py-3">Feature</th>
              <th className="text-center font-medium text-ink px-4 py-3 w-28">Cloud</th>
              <th className="text-center font-medium text-ink px-4 py-3 w-28">Standalone</th>
            </tr>
          </thead>
          <tbody className="[&_tr:not(:last-child)]:border-b [&_tr]:border-[var(--hairline)]">
            {[
              ["IDE: inline suggestions, Chat, modes", true, true],
              ["Copilot code review (in IDE)", true, true],
              ["AI commit messages (IDE)", true, true],
              ["Repository custom instructions", true, true],
              ["Copilot Chat on GitHub.com", "Full repo access", "Chat only"],
              ["Copilot code review in Pull Requests", true, false],
              ["PR summaries", true, false],
              ["Organisation custom instructions", true, false],
              ["GitHub Actions & repos", true, false],
            ].map(([label, cloud, standalone], i) => (
              <tr key={i}>
                <td className="px-4 py-3 text-ink-dim">{label as string}</td>
                <td className="px-4 py-3 text-center">
                  <Cell v={cloud} />
                </td>
                <td className="px-4 py-3 text-center">
                  <Cell v={standalone} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Approved LLMs anchor */}
      <div id="approved-llms" className="rounded-xl border border-[var(--hairline)] bg-[var(--canvas-2)] p-4 mb-12 flex gap-3 scroll-mt-24">
        <ShieldCheck className="h-4 w-4 text-live shrink-0 mt-0.5" />
        <p className="text-sm text-ink-dim leading-relaxed">
          <span className="text-ink font-medium">Approved LLMs:</span> Copilot lets you choose the
          model. Use only <Ref href={null}>Vodafone-approved LLMs</Ref> for compliance.
        </p>
      </div>

      {/* Contacts + links */}
      <h2 className="font-display font-bold text-xl tracking-tight mb-4">Help & links</h2>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-[var(--hairline)] p-4">
          <p className="kicker mb-3">Contacts</p>
          <div className="space-y-2">
            <a href="mailto:heba.elsayed2@vodafone.com" className="flex items-center gap-2 text-sm text-ink-dim hover:text-ink">
              <Mail className="h-3.5 w-3.5 text-red shrink-0" /> heba.elsayed2@vodafone.com
            </a>
            <a href="mailto:stefanos.manoleas@vodafone.com" className="flex items-center gap-2 text-sm text-ink-dim hover:text-ink">
              <Mail className="h-3.5 w-3.5 text-red shrink-0" /> stefanos.manoleas@vodafone.com
            </a>
            <p className="flex items-center gap-2 text-sm text-muted">
              <Info className="h-3.5 w-3.5 text-faint shrink-0" /> Technical issue?{" "}
              <Ref href={LINKS.serviceRequest}>Raise an SR</Ref>
            </p>
          </div>
        </div>
        <div className="rounded-xl border border-[var(--hairline)] p-4">
          <p className="kicker mb-3">Quick links</p>
          <div className="space-y-2">
            <a href={LINKS.ghCloud} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-ink-dim hover:text-ink">
              <ExternalLink className="h-3.5 w-3.5 text-red shrink-0" /> GitHub Cloud enterprise
            </a>
            <a href={LINKS.standaloneSSO} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-ink-dim hover:text-ink">
              <ExternalLink className="h-3.5 w-3.5 text-red shrink-0" /> Standalone SSO login
            </a>
            <a href={LINKS.copilot} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-ink-dim hover:text-ink">
              <ExternalLink className="h-3.5 w-3.5 text-red shrink-0" /> github.com/copilot
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}

function Cell({ v }: { v: boolean | string }) {
  if (v === true) return <Check className="h-4 w-4 text-live inline" strokeWidth={2.5} />;
  if (v === false) return <span className="text-faint">—</span>;
  return <span className="text-[0.7rem] font-mono text-[var(--soon)]">{v}</span>;
}
