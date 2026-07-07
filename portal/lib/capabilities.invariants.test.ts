import { describe, it, expect } from "vitest";
import { CAPABILITIES, GUILDS } from "./capabilities";

describe("capability schema invariants", () => {
  it("every capability has a non-empty provider array", () => {
    for (const c of CAPABILITIES) {
      expect(c.provider.length, `${c.id} provider`).toBeGreaterThan(0);
    }
  });

  it("every capability has a guild in the GUILDS taxonomy", () => {
    for (const c of CAPABILITIES) {
      expect(GUILDS, `${c.id} guild`).toContain(c.guild);
    }
  });

  it("pipeline execution iff pipeline+script are set", () => {
    for (const c of CAPABILITIES) {
      const isPipeline = c.execution === "pipeline";
      expect(Boolean(c.pipeline && c.script), `${c.id} pipeline fields`).toBe(isPipeline);
    }
  });

  it("credGate copilot requires tokenEnv; non-copilot burns 0 credits", () => {
    for (const c of CAPABILITIES) {
      if (c.credGate === "copilot") {
        expect(c.tokenEnv, `${c.id} tokenEnv`).toBeTruthy();
      } else {
        expect(c.estCredits, `${c.id} estCredits`).toBe(0);
      }
    }
  });
});
