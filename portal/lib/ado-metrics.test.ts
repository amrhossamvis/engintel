import { describe, it, expect } from "vitest";
import { computeHealthScore, type IterationMetrics } from "./ado-metrics";

function iter(p: Partial<IterationMetrics>): IterationMetrics {
  return {
    iterationName: "S", iterationPath: "p", startDate: null, endDate: null,
    totalWorkItems: 0, completedWorkItems: 0, completionRate: 0,
    totalStoryPoints: 0, completedStoryPoints: 0, velocity: 0,
    bugCount: 0, activeBugs: 0, resolvedBugs: 0, newBugs: 0, ...p,
  };
}

describe("computeHealthScore", () => {
  it("is green for strong completion + resolved bugs", () => {
    const r = computeHealthScore([
      iter({ completionRate: 90, velocity: 20, bugCount: 4, resolvedBugs: 4 }),
      iter({ completionRate: 88, velocity: 22, bugCount: 2, resolvedBugs: 2 }),
      iter({ completionRate: 92, velocity: 24, bugCount: 1, resolvedBugs: 1 }),
    ]);
    expect(r.status).toBe("green");
    expect(r.score).toBeGreaterThanOrEqual(65);
  });

  it("is red for poor completion and unresolved bugs", () => {
    const r = computeHealthScore([iter({ completionRate: 20, velocity: 2, bugCount: 10, resolvedBugs: 0 })]);
    expect(r.status).toBe("red");
  });
});
