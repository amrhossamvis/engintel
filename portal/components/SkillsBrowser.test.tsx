import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { SkillsBrowser } from "./SkillsBrowser";

const SAMPLE = {
  skills: [
    {
      id: "1",
      name: "PR Summarizer",
      slug: "pr-summarizer",
      description: "Summarizes PRs",
      guild: "web",
      tag: "Agent workflows",
      installCmd: "npx skills add pr-summarizer",
      repoUrl: null,
      authorName: "Sam",
      stars: null,
      installCount: 3,
      activity: [0, 0, 1, 0, 2, 1, 0, 3],
      createdAt: new Date(0).toISOString(),
    },
  ],
};

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => SAMPLE })) as unknown as typeof fetch,
  );
});

describe("SkillsBrowser", () => {
  it("renders skills fetched from the API as leaderboard rows", async () => {
    render(<SkillsBrowser />);
    await waitFor(() => expect(screen.getByText("PR Summarizer")).toBeInTheDocument());
    expect(screen.getByText("Summarizes PRs")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /PR Summarizer/ })).toHaveAttribute(
      "href",
      "/skills/pr-summarizer",
    );
  });

  it("escapes user description as text (no HTML injection)", async () => {
    render(<SkillsBrowser />);
    await waitFor(() => screen.getByText("Summarizes PRs"));
    expect(document.querySelector("script")).toBeNull();
  });
});
