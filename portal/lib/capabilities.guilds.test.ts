import { describe, it, expect } from "vitest";
import {
  commonCapabilities,
  ownCapabilitiesForGuild,
  guildHasOwnCapabilities,
} from "./capabilities";

describe("guild filtering helpers", () => {
  it("commonCapabilities returns only cross-guild tools", () => {
    const common = commonCapabilities();
    expect(common.length).toBeGreaterThan(0);
    expect(common.every((c) => c.guild === "cross-guild")).toBe(true);
  });

  it("ownCapabilitiesForGuild returns only that guild's own tools", () => {
    const mobile = ownCapabilitiesForGuild("mobile");
    expect(mobile.length).toBeGreaterThan(0);
    expect(mobile.every((c) => c.guild === "mobile")).toBe(true);
  });

  it("product guild owns the backlog-shaping tools", () => {
    const ids = ownCapabilitiesForGuild("product").map((c) => c.id);
    expect(ids).toEqual(
      expect.arrayContaining(["feature-breakdown", "business-intent", "story-extractor"]),
    );
  });

  it("guildHasOwnCapabilities is false for guilds with no dedicated capability", () => {
    // web has no dedicated capability yet — all its tools are cross-guild
    expect(guildHasOwnCapabilities("web")).toBe(false);
  });
});
