import { describe, it, expect } from "vitest";
import { slugify } from "./skills";

describe("slugify", () => {
  it("lowercases and dashes non-alphanumerics", () => {
    expect(slugify("My Cool Skill!")).toBe("my-cool-skill");
  });
  it("collapses repeats and trims", () => {
    expect(slugify("  A / B  ")).toBe("a-b");
  });
});
