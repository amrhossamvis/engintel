import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CapabilityCard } from "./CapabilityCard";
import { getCapability } from "@/lib/capabilities";

// AppProvider's useApp is only needed for openDetail — stub it.
vi.mock("./AppProvider", () => ({
  useApp: () => ({ openDetail: vi.fn() }),
}));

describe("CapabilityCard badges", () => {
  it("shows where it runs (execution) + what it touches (providers)", () => {
    const cap = getCapability("pr-review")!; // pipeline, providers github + ado
    render(<CapabilityCard cap={cap} index={0} total={8} onLaunchAction={() => {}} />);
    expect(screen.getByText("ADO Pipeline")).toBeInTheDocument();
    expect(screen.getByText("ADO")).toBeInTheDocument();
    expect(screen.getByText("Copilot")).toBeInTheDocument();
  });

  it("shows no run pill for hub-inline capabilities (only providers)", () => {
    const cap = getCapability("exec-dashboard")!; // hub-inline, provider ado
    render(<CapabilityCard cap={cap} index={0} total={8} onLaunchAction={() => {}} />);
    expect(screen.queryByText("Hub")).not.toBeInTheDocument();
    expect(screen.getByText("ADO")).toBeInTheDocument();
  });

  it("never shows migration provenance (from Hub A)", () => {
    const cap = getCapability("exec-dashboard")!; // source: hub-a
    render(<CapabilityCard cap={cap} index={0} total={8} onLaunchAction={() => {}} />);
    expect(screen.queryByText(/from hub a/i)).not.toBeInTheDocument();
  });
});
