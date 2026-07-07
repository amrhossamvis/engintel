import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ExecDashboardResult } from "./ExecDashboardResult";

const OUT = {
  teams: [
    {
      team: { organization: "o", project: "p", team: "Alpha" },
      iterations: [
        { iterationName: "S1", iterationPath: "p", startDate: null, endDate: null,
          totalWorkItems: 10, completedWorkItems: 8, completionRate: 80,
          totalStoryPoints: 20, completedStoryPoints: 16, velocity: 16,
          bugCount: 2, activeBugs: 0, resolvedBugs: 2, newBugs: 2 },
      ],
      healthScore: 78, healthStatus: "green" as const,
      currentIteration: null, avgCompletionRate: 80, avgVelocity: 16,
    },
  ],
  summary: {
    totalTeams: 1,
    healthyTeams: 1,
    atRiskTeams: 0,
    criticalTeams: 0,
    avgHealthScore: 78,
    orgHealthStatus: "green" as const,
  },
};

describe("ExecDashboardResult", () => {
  it("renders the health score and team name", () => {
    render(<ExecDashboardResult output={OUT} />);
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("78 · green")).toBeInTheDocument();
  });
});
