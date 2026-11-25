import { describe, expect, it } from "vitest";
import {
  DEFAULT_MEMBER_COLOR,
  MEMBER_COLOR_HEXES,
  MEMBER_COLORS,
} from "./palette";

describe("member color palette", () => {
  it("is exactly the eight decided colors, in order", () => {
    expect(MEMBER_COLORS.map((c) => [c.id, c.hex])).toEqual([
      ["blue", "#2563eb"],
      ["green", "#16a34a"],
      ["orange", "#ea580c"],
      ["purple", "#9333ea"],
      ["red", "#dc2626"],
      ["teal", "#0d9488"],
      ["pink", "#db2777"],
      ["amber", "#ca8a04"],
    ]);
  });

  it("uses lowercase hex that the database check accepts", () => {
    for (const { hex } of MEMBER_COLORS) expect(hex).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("has unique ids and unique hexes", () => {
    expect(new Set(MEMBER_COLORS.map((c) => c.id)).size).toBe(MEMBER_COLORS.length);
    expect(new Set(MEMBER_COLORS.map((c) => c.hex)).size).toBe(MEMBER_COLORS.length);
  });

  it("has no gray, which is reserved for unassigned family events", () => {
    for (const { id, hex } of MEMBER_COLORS) {
      expect(id).not.toMatch(/gr[ae]y|slate|zinc|neutral|stone/);
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
      expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeGreaterThan(40);
    }
  });

  it("defaults to blue, which is in the list", () => {
    expect(DEFAULT_MEMBER_COLOR).toBe("#2563eb");
    expect(MEMBER_COLOR_HEXES).toContain(DEFAULT_MEMBER_COLOR);
    expect(MEMBER_COLOR_HEXES).toHaveLength(MEMBER_COLORS.length);
  });
});
