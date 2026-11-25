/**
 * The shared calendar palette (decision D-13): eight named colors, saturated mid-tones.
 * Used for members now and for children, settings and events later. Lowercase hex so each
 * value passes the database check `^#[0-9a-f]{6}$`. No gray: CAL-6 reserves it for
 * unassigned family events. Two members may share a color.
 */
export const MEMBER_COLORS = [
  { id: "blue", hex: "#2563eb" },
  { id: "green", hex: "#16a34a" },
  { id: "orange", hex: "#ea580c" },
  { id: "purple", hex: "#9333ea" },
  { id: "red", hex: "#dc2626" },
  { id: "teal", hex: "#0d9488" },
  { id: "pink", hex: "#db2777" },
  { id: "amber", hex: "#ca8a04" },
] as const;

export type MemberColorId = (typeof MEMBER_COLORS)[number]["id"];
export type MemberColorHex = (typeof MEMBER_COLORS)[number]["hex"];

export const DEFAULT_MEMBER_COLOR: MemberColorHex = "#2563eb";

/** The hexes as a tuple, for `z.enum`. */
export const MEMBER_COLOR_HEXES = MEMBER_COLORS.map((c) => c.hex) as unknown as readonly [
  MemberColorHex,
  ...MemberColorHex[],
];

/** Events with no member to take a color from: unassigned family events, unknown creators. */
export const NEUTRAL_EVENT_COLOR = "#6b7280";
export const TEXT_ON_DARK = "#ffffff";
export const TEXT_ON_LIGHT = "#000000";
