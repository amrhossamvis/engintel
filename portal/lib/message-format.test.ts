import { describe, it, expect } from "vitest";
import { splitMessage } from "./message-format";

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
