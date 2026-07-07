import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RunForm } from "./RunForm";
import { getCapability } from "@/lib/capabilities";

// RunForm reads the capability to launch from useApp().launchCap (it takes no
// props itself — it renders an internal `Inner` for whichever cap is launched).
let launchCap: ReturnType<typeof getCapability>;

vi.mock("./AppProvider", () => ({
  useApp: () => ({
    launchCap,
    closeLaunch: vi.fn(),
    ready: false, // no Copilot token configured
    login: null,
    adoIdentity: null,
    queueJob: vi.fn(),
    openMonitor: vi.fn(),
  }),
}));

describe("RunForm gate honors credGate", () => {
  it("enables Run for a credGate:'none' capability with no Copilot token", () => {
    launchCap = getCapability("exec-dashboard")!; // credGate: "none", no required fields
    render(<RunForm />);
    const runBtn = screen.getByRole("button", { name: /queue run/i });
    expect(runBtn).not.toBeDisabled();
  });

  it("still disables Run for a credGate:'copilot' capability with no Copilot token", async () => {
    launchCap = getCapability("pr-review")!; // credGate: "copilot"
    render(<RunForm />);
    // Fill the only required field so the gate failure is isolated to `ready`,
    // not the missing-required-fields check.
    await userEvent.type(
      screen.getByPlaceholderText(/dev\.azure\.com/i),
      "https://dev.azure.com/org/proj/_git/repo/pullrequest/1",
    );
    const runBtn = screen.getByRole("button", { name: /queue run/i });
    expect(runBtn).toBeDisabled();
  });
});
