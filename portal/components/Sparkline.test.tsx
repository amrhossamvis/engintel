import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Sparkline } from "./Sparkline";

describe("Sparkline", () => {
  it("renders a line + area path for a series", () => {
    const { container } = render(<Sparkline data={[0, 1, 2, 1, 3]} />);
    const paths = container.querySelectorAll("path");
    expect(paths.length).toBe(2);
    expect(paths[1].getAttribute("d")).toMatch(/^M/);
  });

  it("does not crash on an all-zero (flat) series", () => {
    const { container } = render(<Sparkline data={[0, 0, 0, 0]} />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });
});
