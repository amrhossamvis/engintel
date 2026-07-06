import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  dbConfigured: () => false,
  ensureSchema: vi.fn(),
  db: vi.fn(),
}));

import { POST } from "./route";

describe("POST /api/skills/[id]/install", () => {
  it("returns 501 when DB not configured", async () => {
    const res = await POST(new Request("http://x", { method: "POST" }), {
      params: Promise.resolve({ id: "abc" }),
    });
    expect(res.status).toBe(501);
  });
});
