import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Markdown } from "./Markdown";

describe("Markdown", () => {
  it("renders headings, lists, code and links without injecting HTML", () => {
    const src = [
      "# Title",
      "",
      "Some **bold** and `code` and [link](https://x.test).",
      "",
      "- one",
      "- two",
      "",
      "```",
      "<script>alert(1)</script>",
      "```",
    ].join("\n");
    const { container, getByText, getByRole } = render(<Markdown source={src} />);

    expect(getByText("Title")).toBeInTheDocument();
    expect(getByText("one")).toBeInTheDocument();
    expect(getByRole("link", { name: "link" })).toHaveAttribute("href", "https://x.test");
    // fenced content is text, never parsed into a real script element
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("code")?.textContent).toContain("code");
  });

  it("neutralizes javascript: links", () => {
    const { getByRole } = render(<Markdown source={"[x](javascript:alert(1))"} />);
    expect(getByRole("link", { name: "x" })).toHaveAttribute("href", "#");
  });
});
