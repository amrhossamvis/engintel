import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { AppProvider, useApp } from "./AppProvider";
import { getCapability } from "@/lib/capabilities";

function Harness() {
  const { queueJob, jobs } = useApp();
  return (
    <div>
      <button
        onClick={() => queueJob(getCapability("exec-dashboard")!, {})}
        data-testid="run"
      >
        run
      </button>
      <span data-testid="status">{jobs[0]?.status ?? "none"}</span>
      <span data-testid="hasout">{jobs[0]?.output ? "yes" : "no"}</span>
    </div>
  );
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (String(url).includes("/api/inline/"))
        return { ok: true, json: async () => ({ output: { summary: { totalTeams: 1 } } }) };
      return { ok: false, status: 501, json: async () => ({ error: "x" }) };
    }) as unknown as typeof fetch,
  );
});

describe("queueJob hub-inline branch", () => {
  it("runs an inline capability to done with output, no polling", async () => {
    render(
      <AppProvider>
        <Harness />
      </AppProvider>,
    );
    screen.getByTestId("run").click();
    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("done"));
    expect(screen.getByTestId("hasout").textContent).toBe("yes");
  });
});
