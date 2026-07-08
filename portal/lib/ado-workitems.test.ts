import { describe, it, expect } from "vitest";
import { flatten, markdownToHtml, type ClassificationNode } from "./ado-workitems";

describe("flatten", () => {
  it("builds backslash-joined Project\\Area\\Sub paths", () => {
    const out: ClassificationNode[] = [];
    flatten(
      { name: "Digital", children: [{ name: "Web", children: [{ name: "Squad" }] }] },
      "",
      out,
    );
    expect(out.map((n) => n.path)).toEqual(["Digital", "Digital\\Web", "Digital\\Web\\Squad"]);
  });
});

describe("markdownToHtml", () => {
  it("escapes html so message content cannot inject markup", () => {
    expect(markdownToHtml("<script>alert(1)</script>")).toContain("&lt;script&gt;");
  });

  it("renders headings, bold, italic and inline code", () => {
    expect(markdownToHtml("## Title")).toBe("<h2>Title</h2>");
    expect(markdownToHtml("**b** and *i* and `c`")).toBe(
      "<p><b>b</b> and <i>i</i> and <code>c</code></p>",
    );
  });

  it("renders unordered and ordered lists", () => {
    expect(markdownToHtml("- a\n- b")).toBe("<ul><li>a</li><li>b</li></ul>");
    expect(markdownToHtml("1. a\n2. b")).toBe("<ol><li>a</li><li>b</li></ol>");
  });

  it("renders fenced code blocks with escaped contents", () => {
    expect(markdownToHtml("```\n<x>\n```")).toBe("<pre><code>&lt;x&gt;</code></pre>");
  });

  it("joins wrapped paragraph lines with <br>", () => {
    expect(markdownToHtml("one\ntwo")).toBe("<p>one<br>two</p>");
  });
});
