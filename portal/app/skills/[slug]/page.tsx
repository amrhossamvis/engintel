import Link from "next/link";
import { ArrowLeft, FlaskConical } from "lucide-react";
import { notFound } from "next/navigation";
import { getSkillBySlug } from "@/lib/skills-server";
import { parseGithubRepo } from "@/lib/skills";
import { Markdown } from "@/components/Markdown";
import { InstallBox } from "@/components/InstallBox";
import { Sparkline } from "@/components/Sparkline";
import { DeleteSkillButton } from "@/components/DeleteSkillButton";

export default async function SkillDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const skill = await getSkillBySlug(slug);
  if (!skill) notFound();

  const gh = parseGithubRepo(skill.repoUrl);
  const summaryItems = (skill.summary ?? "")
    .split("\n")
    .map((l) => l.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);
  const firstSeen = new Date(skill.createdAt).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <main className="relative z-10 mx-auto max-w-6xl px-6 pb-24 pt-10">
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/skills"
          className="inline-flex items-center gap-2 text-sm text-muted hover:text-ink transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Skills
        </Link>
        <span className="inline-flex items-center gap-2 text-[0.7rem] font-mono uppercase tracking-wider text-soon">
          <FlaskConical className="h-3.5 w-3.5" /> Experimental
        </span>
      </div>

      <nav className="mb-6 flex items-center gap-2 text-xs text-faint">
        <Link href="/skills" className="hover:text-muted">skills</Link>
        {gh && <><span>/</span><span>{gh.owner}</span><span>/</span><span>{gh.repo}</span></>}
        <span>/</span>
        <span className="text-muted">{skill.slug}</span>
      </nav>

      <div className="grid gap-12 lg:grid-cols-[1fr_260px]">
        <div className="min-w-0">
          <h1 className="font-display text-4xl font-bold">{skill.name}</h1>
          {skill.tag && (
            <span className="mt-3 inline-block rounded-full border px-3 py-1 text-xs text-muted"
              style={{ borderColor: "var(--hairline)" }}>
              {skill.tag}
            </span>
          )}

          <section className="mt-8">
            <h2 className="mb-3 font-mono text-xs uppercase tracking-wider text-faint">Installation</h2>
            <InstallBox id={skill.id} cmd={skill.installCmd} />
          </section>

          {summaryItems.length > 0 && (
            <section className="mt-8">
              <h2 className="mb-3 font-mono text-xs uppercase tracking-wider text-faint">Summary</h2>
              <div className="card rounded-2xl p-5">
                <p className="text-sm font-semibold">{skill.description}</p>
                <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-muted">
                  {summaryItems.map((it, idx) => <li key={idx}>{it}</li>)}
                </ul>
              </div>
            </section>
          )}

          {skill.readme && (
            <section className="mt-10">
              <h2 className="mb-4 font-mono text-xs uppercase tracking-wider text-faint">SKILL.md</h2>
              <Markdown source={skill.readme} />
            </section>
          )}
        </div>

        <aside className="space-y-8 text-sm lg:sticky lg:top-10 lg:self-start">
          {skill.installCount > 0 && (
            <div>
              <Stat label="Installs" value={compact(skill.installCount)} big />
              <div className="mt-2"><Sparkline data={skill.activity} width={240} height={40} /></div>
            </div>
          )}
          {skill.repoUrl && (
            <Field label="Repository">
              <a href={skill.repoUrl} target="_blank" rel="noopener noreferrer"
                className="font-mono text-xs text-red underline break-all">
                {gh ? `${gh.owner}/${gh.repo}` : skill.repoUrl}
              </a>
            </Field>
          )}
          {skill.stars != null && (
            <Field label="GitHub stars"><span className="font-mono">★ {compact(skill.stars)}</span></Field>
          )}
          <Field label="First seen"><span className="font-mono text-xs">{firstSeen}</span></Field>
          {skill.authorName && (
            <Field label="Author"><span className="text-xs">{skill.authorName}</span></Field>
          )}
          <Field label="Security audits">
            <span className="rounded border px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted"
              style={{ borderColor: "var(--hairline)" }}>
              Pending
            </span>
          </Field>
          <div className="border-t pt-4" style={{ borderColor: "var(--hairline)" }}>
            <DeleteSkillButton id={skill.id} name={skill.name} />
          </div>
        </aside>
      </div>
    </main>
  );
}

function Stat({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div>
      <div className="font-mono text-xs uppercase tracking-wider text-faint">{label}</div>
      <div className={big ? "mt-1 font-display text-3xl font-bold" : "mt-1 font-semibold"}>{value}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 font-mono text-xs uppercase tracking-wider text-faint">{label}</div>
      {children}
    </div>
  );
}

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
