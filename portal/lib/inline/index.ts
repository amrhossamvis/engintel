import { runExecDashboard } from "./exec-dashboard";
import { runProductivity } from "@/lib/productivity";
import { runSprintHealth } from "@/lib/sprint-health";

export type InlineHandler = (
  inputs: Record<string, string | boolean>,
  opts?: { adoPat?: string },
) => Promise<unknown>;

export const INLINE_HANDLERS: Record<string, InlineHandler> = {
  "exec-dashboard": (inputs, opts) => runExecDashboard(inputs, opts?.adoPat),
  "ai-productivity": (inputs, opts) => runProductivity(inputs, opts?.adoPat),
  "sprint-health": (inputs, opts) => runSprintHealth(inputs, opts?.adoPat),
};
