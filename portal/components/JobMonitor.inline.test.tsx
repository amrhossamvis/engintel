import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import { JobMonitor } from "./JobMonitor";
import type { Job } from "./AppProvider";

// jsdom doesn't implement Element.scrollTo; JobMonitor calls it on log updates.
beforeAll(() => {
  Element.prototype.scrollTo = vi.fn();
});

const INLINE_JOB: Job = {
  id: 1,
  runId: 482913,
  capId: "exec-dashboard",
  capName: "Exec Dashboard",
  icon: "BarChart",
  status: "done",
  stage: 0,
  steps: [],
  currentStep: null,
  log: [],
  values: {},
  live: false,
  locus: "hub-inline",
  output: {
    teams: [
      {
        team: { organization: "o", project: "p", team: "Alpha" },
        iterations: [],
        healthScore: 78,
        healthStatus: "green" as const,
        currentIteration: null,
        avgCompletionRate: 80,
        avgVelocity: 16,
      },
    ],
    summary: { totalTeams: 1, avgHealthScore: 78, orgHealthStatus: "green" as const },
  },
};

// A capability that's still ADO-pipeline-executed (not "hub-inline"/"local")
// after the direct-REST capability migration — used here purely as a
// pipeline-chrome regression fixture, unrelated to what it actually does.
const PIPELINE_JOB: Job = {
  id: 2,
  runId: 555,
  capId: "workitem-wiki-doc",
  capName: "Wiki Weaver",
  icon: "BookOpen",
  status: "done",
  stage: 0,
  steps: [],
  currentStep: null,
  log: [],
  values: {},
  live: true,
};

const useAppMock = vi.fn();

vi.mock("./AppProvider", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./AppProvider")>()),
  useApp: () => useAppMock(),
}));

describe("JobMonitor — hub-inline capabilities", () => {
  it("does not render pipeline chrome for a hub-inline job", () => {
    useAppMock.mockReturnValue({ monitorJobId: 1, jobs: [INLINE_JOB], closeMonitor: () => {} });
    render(<JobMonitor />);
    expect(screen.queryByText("Pipeline progress")).toBeNull();
    expect(screen.queryByText(/ADO Run #/)).toBeNull();
    expect(screen.queryByText(/results posted to Azure DevOps/i)).toBeNull();
  });

  it("still renders the real result and an inline-appropriate success message", () => {
    useAppMock.mockReturnValue({ monitorJobId: 1, jobs: [INLINE_JOB], closeMonitor: () => {} });
    render(<JobMonitor />);
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Analysis complete.")).toBeInTheDocument();
  });
});

describe("JobMonitor — pipeline job regression", () => {
  it("still shows pipeline chrome for non-inline jobs", () => {
    useAppMock.mockReturnValue({ monitorJobId: 2, jobs: [PIPELINE_JOB], closeMonitor: () => {} });
    render(<JobMonitor />);
    expect(screen.getByText("Pipeline progress")).toBeInTheDocument();
    expect(screen.getByText("ADO Run #555")).toBeInTheDocument();
  });
});
