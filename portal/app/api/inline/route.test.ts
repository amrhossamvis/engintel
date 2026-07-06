import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/ado", () => ({
  adoReadable: async () => false,
  adoReadAuthHeader: async () => "",
}));
vi.mock("@/lib/ado-metrics", () => ({ fetchTeamDashboard: vi.fn() }));

import { POST } from "./[capabilityId]/route";

function ctx(id: string) {
  return { params: Promise.resolve({ capabilityId: id }) };
}

describe("POST /api/inline/[capabilityId]", () => {
  it("404 for an unknown capability", async () => {
    const res = await POST(new Request("http://x", { method: "POST", body: "{}" }), ctx("nope"));
    expect(res.status).toBe(404);
  });

  it("501 when the handler needs ADO but it is not configured", async () => {
    const res = await POST(
      new Request("http://x", { method: "POST", body: "{}" }),
      ctx("exec-dashboard"),
    );
    expect(res.status).toBe(501);
    expect(await res.json()).toEqual({ error: "ado_not_configured" });
  });
});
