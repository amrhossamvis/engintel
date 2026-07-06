import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  dbConfigured: () => false, // exercise the no-DB guard without a real Postgres
  ensureSchema: vi.fn(),
  db: vi.fn(),
}));

import { GET, POST } from "./route";

describe("/api/skills", () => {
  it("GET returns an empty list when DB not configured", async () => {
    const res = await GET(new Request("http://x/api/skills"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ skills: [] });
  });

  it("POST returns 501 when DB not configured", async () => {
    const res = await POST(
      new Request("http://x/api/skills", {
        method: "POST",
        body: JSON.stringify({ name: "S", description: "d", installCmd: "npx s" }),
      }),
    );
    expect(res.status).toBe(501);
  });
});
