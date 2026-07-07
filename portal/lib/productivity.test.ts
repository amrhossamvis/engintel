import { describe, it, expect } from "vitest";
import { computeAIProductivityIndex, computeOrgStats, type SprintADOMetrics } from "./productivity";

function sprint(over: Partial<SprintADOMetrics>): SprintADOMetrics {
  return {
    sprintName: "S",
    startDate: null,
    endDate: null,
    totalWorkItems: 0,
    completedWorkItems: 0,
    completionRate: 0,
    velocity: 0,
    bugCount: 0,
    newBugs: 0,
    resolvedBugs: 0,
    bugEscapeRate: 0,
    prCount: 0,
    avgPRCycleTimeDays: 0,
    medianPRCycleTimeDays: 0,
    ...over,
  };
}

// Two completed sprints (the trailing one is the in-progress current sprint and
// is excluded from scoring): completion 80, bugEscape 6, velocity flat, cycle 1.5d.
const completed = [
  sprint({ completionRate: 80, bugEscapeRate: 6, velocity: 10, avgPRCycleTimeDays: 1.5 }),
  sprint({ completionRate: 80, bugEscapeRate: 6, velocity: 10, avgPRCycleTimeDays: 1.5 }),
];
const current = sprint({ completionRate: 40, bugEscapeRate: 40, velocity: 3, avgPRCycleTimeDays: 12 });

describe("computeAIProductivityIndex", () => {
  it("weights components with copilot present (ported formula)", () => {
    const r = computeAIProductivityIndex([...completed, current], {
      source: "manual",
      acceptanceRate: 60,
      activeUsers: 0,
      totalSuggestions: 0,
      acceptedSuggestions: 0,
      linesAccepted: 0,
      weekLabel: "",
    });
    // delivery=80, quality=round(100-(6/30)*100)=80, velocity(10/10=1.0)=80, prEff(1.5d)=85, copilot=60
    // score = 0.25*80 + 0.20*80 + 0.20*80 + 0.15*85 + 0.20*60 = 76.75 → 77
    expect(r.components.deliveryScore).toBe(80);
    expect(r.components.qualityScore).toBe(80);
    expect(r.components.velocityScore).toBe(80);
    expect(r.components.prEfficiencyScore).toBe(85);
    expect(r.components.copilotAdoptionScore).toBe(60);
    expect(r.score).toBe(77);
  });

  it("reweights when copilot is absent", () => {
    const r = computeAIProductivityIndex([...completed, current], null);
    // score = 0.30*80 + 0.25*80 + 0.25*80 + 0.20*85 = 81
    expect(r.score).toBe(81);
    expect(r.components.copilotAdoptionScore).toBe(0);
  });

  it("returns a zeroed index for no sprints", () => {
    const r = computeAIProductivityIndex([], null);
    expect(r.score).toBe(0);
    expect(r.insights).toContain("No sprint data available");
  });
});

describe("computeOrgStats", () => {
  it("aggregates completed sprints, excluding the in-progress one", () => {
    const stats = computeOrgStats([...completed, current]);
    expect(stats).not.toBeNull();
    expect(stats!.sprintCount).toBe(2);
    expect(stats!.avgCompletion).toBe(80);
    expect(stats!.avgCycleTime).toBe("1.5");
    expect(stats!.avgBugEscape).toBe(6);
  });
});
