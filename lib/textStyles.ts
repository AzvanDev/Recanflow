export type TextLevel = "heading" | "subheading" | "body";
export type TextSize = "small" | "medium" | "large";
export type TextAlign = "left" | "center" | "right";

const LEVEL_BASE_PX: Record<TextLevel, number> = { heading: 22, subheading: 16, body: 13 };
const SIZE_SCALE: Record<TextSize, number> = { small: 0.8, medium: 1, large: 1.35 };
const LEVEL_WEIGHT: Record<TextLevel, number> = { heading: 700, subheading: 600, body: 400 };

export function textFontSize(level: TextLevel = "body", size: TextSize = "medium"): number {
  return Math.round(LEVEL_BASE_PX[level] * SIZE_SCALE[size]);
}

export function textFontWeight(level: TextLevel = "body", bold?: boolean): number {
  return bold ? 700 : LEVEL_WEIGHT[level];
}

export const TEXT_COLORS: { name: string; value: string }[] = [
  { name: "Default", value: "" },
  { name: "Purple", value: "#7355e9" },
  { name: "Blue", value: "#3a6fc4" },
  { name: "Green", value: "#2f7a49" },
  { name: "Red", value: "#c0392b" },
  { name: "Amber", value: "#b8860b" },
];
