import { describe, it, expect } from "vitest";
import { splitMessage, splitStories } from "./message-format";

describe("splitMessage", () => {
  it("takes the first non-empty line as title, rest as description", () => {
    expect(splitMessage("Line one\n\nbody here")).toEqual({
      title: "Line one",
      description: "body here",
    });
  });

  it("strips markdown lead markers from the title", () => {
    expect(splitMessage("## A story\ndetails").title).toBe("A story");
    expect(splitMessage("- bullet title").title).toBe("bullet title");
    expect(splitMessage("1. numbered").title).toBe("numbered");
  });

  it("handles leading blank lines and empty input", () => {
    expect(splitMessage("\n\n  Title\nx").title).toBe("Title");
    expect(splitMessage("   ")).toEqual({ title: "", description: "" });
  });
});

describe("splitStories", () => {
  it("returns a single story when there are fewer than two headings", () => {
    expect(splitStories("# Only one\nbody")).toHaveLength(1);
    expect(splitStories("no headings at all\nmore")).toHaveLength(1);
  });

  it("splits on two or more headings, one story per heading", () => {
    const msg = "### Story A\nas a user...\n\n### Story B\nas an admin...";
    const out = splitStories(msg);
    expect(out.map((s) => s.title)).toEqual(["Story A", "Story B"]);
    expect(out[0].description).toBe("as a user...");
    expect(out[1].description).toBe("as an admin...");
  });

  it("does not split on numbered lines (acceptance criteria)", () => {
    const msg = "## Single story\n1. AC one\n2. AC two";
    expect(splitStories(msg)).toHaveLength(1);
  });
});
