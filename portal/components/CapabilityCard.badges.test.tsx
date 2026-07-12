import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CapabilityCard } from "./CapabilityCard";
import { getCapability, type Capability } from "@/lib/capabilities";

// AppProvider's useApp is only needed for openDetail — stub it.
vi.mock("./AppProvider", () => ({
  useApp: () => ({ openDetail: vi.fn() }),
}));

// Synthetic fixture rather than a real catalog entry: as capabilities migrate
// off pipeline execution, no live capability may still combine
// execution: "pipeline" with providers ["github", "ado"] — but the badge
// rendering behavior for that combination still needs coverage.
const PIPELINE_CAP: Capability = {
  ...getCapability("pr-review")!,
  execution: "pipeline",
  provider: ["github", "ado"],
};

describe("CapabilityCard badges", () => {
  it("shows where it runs (execution) + what it touches (providers)", () => {
    render(<CapabilityCard cap={PIPELINE_CAP} index={0} onLaunchAction={() => {}} />);
    expect(screen.getByText("ADO Pipeline")).toBeInTheDocument();
    expect(screen.getByText("ADO")).toBeInTheDocument();
    expect(screen.getByText("Copilot")).toBeInTheDocument();
  });

  it("shows no run pill for hub-inline capabilities (only providers)", () => {
    const cap = getCapability("exec-dashboard")!; // hub-inline, provider ado
    render(<CapabilityCard cap={cap} index={0} onLaunchAction={() => {}} />);
    expect(screen.queryByText("Hub")).not.toBeInTheDocument();
    expect(screen.getByText("ADO")).toBeInTheDocument();
  });

  it("never shows migration provenance (from Hub A)", () => {
    const cap = getCapability("exec-dashboard")!; // source: hub-a
    render(<CapabilityCard cap={cap} index={0} onLaunchAction={() => {}} />);
    expect(screen.queryByText(/from hub a/i)).not.toBeInTheDocument();
  });
});
