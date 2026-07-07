import { describe, it, expect } from "vitest";
import type { Job } from "./AppProvider";

describe("Job type carries locus + output", () => {
  it("accepts a hub-inline job with output and no pipeline id", () => {
    const job: Job = {
      id: 1,
      runId: 0,
      capId: "exec-dashboard",
      capName: "Executive Dashboard",
      icon: "LayoutDashboard",
      status: "done",
      stage: 0,
      steps: [],
      currentStep: null,
      log: [],
      values: {},
      live: false,
      locus: "hub-inline",
      output: { ok: true },
    };
    expect(job.locus).toBe("hub-inline");
    expect(job.output).toEqual({ ok: true });
  });
});
