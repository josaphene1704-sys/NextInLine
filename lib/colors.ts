import colorsData from "@/colors.json";

export interface HairColor {
  code: string;
  name: string;
  nameHe: string;
  category: string;
  level: number | null;
  primaryTone: string;
  secondaryTone: string | null;
  imagePath: string;
  hex: string;
  rgb: { r: number; g: number; b: number };
}

export const COLOR_BRAND: string = colorsData.brand;

export const HAIR_COLORS: HairColor[] = colorsData.colors as HairColor[];

export const COLOR_CATEGORIES: string[] = Array.from(
  new Set(HAIR_COLORS.map((c) => c.category))
);

const COLORS_BY_CODE = new Map<string, HairColor>(
  HAIR_COLORS.map((c) => [c.code, c])
);

export function getColorByCode(code: string | undefined | null): HairColor | undefined {
  if (!code) return undefined;
  return COLORS_BY_CODE.get(code);
}

export function getColorsByCategory(category: string): HairColor[] {
  return HAIR_COLORS.filter((c) => c.category === category);
}
