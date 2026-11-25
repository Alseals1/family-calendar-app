import { describe, expect, it } from "vitest";
import { contrastRatio, readableTextColor, relativeLuminance } from "./contrast";
import { NEUTRAL_EVENT_COLOR, TEXT_ON_DARK, TEXT_ON_LIGHT } from "./palette";

const hex = (n: number) => n.toString(16).padStart(2, "0");

describe("relativeLuminance", () => {
  it("is 0 for black and 1 for white", () => {
    expect(relativeLuminance("#000000")).toBe(0);
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 10);
  });
});

describe("contrastRatio", () => {
  it("is 21 for black on white, in either order", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 5);
  });

  it("is 1 for the same color", () => {
    expect(contrastRatio("#336699", "#336699")).toBeCloseTo(1, 10);
  });

  it("matches the WCAG value for #777777 on white (about 4.48)", () => {
    expect(contrastRatio("#777777", "#ffffff")).toBeCloseTo(4.48, 2);
  });

  it("accepts upper-case hex", () => {
    expect(contrastRatio("#FFFFFF", "#000000")).toBeCloseTo(21, 5);
  });

  it.each(["", "red", "#fff", "#12345", "#1234567", "123456", "#gggggg"])(
    "throws for %j",
    (bad) => {
      expect(() => contrastRatio(bad, "#ffffff")).toThrow();
      expect(() => readableTextColor(bad)).toThrow();
    },
  );
});

describe("readableTextColor", () => {
  it("picks white on dark and black on light", () => {
    expect(readableTextColor("#000000")).toBe(TEXT_ON_DARK);
    expect(readableTextColor("#ffffff")).toBe(TEXT_ON_LIGHT);
    expect(readableTextColor("#1a2b3c")).toBe(TEXT_ON_DARK);
    expect(readableTextColor("#ffeb3b")).toBe(TEXT_ON_LIGHT);
  });

  it("has at least 4.5:1 contrast for every color in the sweep", () => {
    const samples: string[] = ["#777777", NEUTRAL_EVENT_COLOR];
    for (let r = 0; r <= 255; r += 15) {
      for (let g = 0; g <= 255; g += 15) {
        for (let b = 0; b <= 255; b += 15) samples.push(`#${hex(r)}${hex(g)}${hex(b)}`);
      }
    }
    for (const bg of samples) {
      expect(contrastRatio(bg, readableTextColor(bg)), bg).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("palette", () => {
  it("exposes the neutral gray and the two text colors", () => {
    expect(NEUTRAL_EVENT_COLOR).toMatch(/^#[0-9a-f]{6}$/);
    expect(TEXT_ON_DARK).toBe("#ffffff");
    expect(TEXT_ON_LIGHT).toBe("#000000");
  });
});
