import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Hub } from "./Hub";

// Hub also renders JobsTray/JobMonitor/RunForm/CapabilityModal, which read
// additional useApp fields — stub the full shape so those children don't crash.
vi.mock("./AppProvider", () => ({
  useApp: () => ({
    theme: "dark",
    setTheme: vi.fn(),
    adoIdentity: null,
    openLaunch: vi.fn(),
    openDetail: vi.fn(),
    jobs: [],
    activeJobs: [],
    openMonitor: vi.fn(),
    monitorJobId: null,
    closeMonitor: vi.fn(),
    detailCap: null,
    closeDetail: vi.fn(),
    launchCap: null,
    closeLaunch: vi.fn(),
    ready: false,
    login: null,
    queueJob: vi.fn(),
  }),
}));

describe("Hub guild view", () => {
  it("shows the Common tab plus guild selector buttons", () => {
    render(<Hub />);
    expect(screen.getByRole("button", { name: "Common" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mobile" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Product" })).toBeInTheDocument();
  });

  it("shows an empty state pointing to Common when a guild has no dedicated tools", async () => {
    render(<Hub />);
    await userEvent.click(screen.getByRole("button", { name: "Web" }));
    expect(screen.getByText(/no dedicated web tools yet/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /browse common tools/i })).toBeInTheDocument();
  });
});
