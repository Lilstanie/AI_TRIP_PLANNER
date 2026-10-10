import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BrandMark, LOGO_SRC } from "@/components/workspace/BrandMark";

describe("brand mark", () => {
  it("references the shared square logo asset without inlining it", () => {
    const file = join(process.cwd(), "public", LOGO_SRC);
    const svg = readFileSync(file, "utf8");
    expect(svg).toContain('viewBox="0 0 1536 1536"');
    const { container } = render(<BrandMark />);
    const img = container.querySelector("img")!;
    expect(img.getAttribute("src")).toBe(LOGO_SRC);
    expect(img.getAttribute("width")).toBe("32");
    expect(img.getAttribute("height")).toBe("32");
    expect(container.innerHTML).not.toContain("base64");
  });

  it("is decorative next to the product name and named when shown alone", () => {
    const { rerender, container } = render(<BrandMark />);
    expect(container.querySelector("img")!.getAttribute("alt")).toBe("");
    expect(screen.getByText("AI Trip Planner")).toBeTruthy();
    rerender(<BrandMark showName={false} />);
    expect(screen.getByRole("img", { name: "AI Trip Planner" })).toBeTruthy();
    expect(screen.queryByText("AI Trip Planner")).toBeNull();
  });
});
