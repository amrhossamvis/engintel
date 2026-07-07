import { Factory, Laptop, type LucideIcon } from "lucide-react";
import type { Provider, Execution } from "@/lib/capabilities";

const PROVIDER_LABEL: Record<Provider, string> = {
  ado: "ADO",
  github: "Copilot",
  jira: "Jira",
  datadog: "DataDog",
  internal: "Internal",
};

// hub-inline is intentionally omitted — "runs in-app" is not something the user
// needs badged; only pipeline / local carry a where-it-runs pill.
const EXECUTION_META: Partial<Record<Execution, { label: string; icon: LucideIcon }>> = {
  pipeline: { label: "ADO Pipeline", icon: Factory },
  local: { label: "Local", icon: Laptop },
};

// Two axes, one glance: where it runs (accent pill) + what it touches (muted pills).
// Migration provenance (source) is deliberately not shown — it means nothing to the user.
export function CapabilityBadges({
  provider,
  execution,
}: {
  provider: Provider[];
  execution: Execution;
}) {
  const exec = EXECUTION_META[execution];
  const ExecIcon = exec?.icon;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {exec && ExecIcon && (
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.62rem] font-mono uppercase tracking-wide"
          style={{ background: "rgba(230,0,0,0.10)", color: "var(--red)" }}
        >
          <ExecIcon className="h-3 w-3" strokeWidth={1.8} />
          {exec.label}
        </span>
      )}
      {provider.map((p) => (
        <span
          key={p}
          className="rounded-full border px-2 py-0.5 text-[0.62rem] font-mono uppercase tracking-wide text-muted"
          style={{ borderColor: "var(--hairline)" }}
        >
          {PROVIDER_LABEL[p]}
        </span>
      ))}
    </div>
  );
}
