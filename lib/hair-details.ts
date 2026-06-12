import { Doc } from "@/convex/_generated/dataModel";

const LENGTH_KEY: Record<string, "short" | "medium" | "long"> = {
  "קצר":    "short",
  "בינוני": "medium",
  "ארוך":   "long",
};

/** Returns the final price for a service given the selected hair length.
 *  Falls back to service.price if no per-length price is configured. */
export function calcFinalPrice(
  service: Doc<"services">,
  hairLength: string | undefined
): number {
  const key = hairLength ? LENGTH_KEY[hairLength] : undefined;
  const pbl = service.pricesByLength;
  if (key && pbl?.[key] && pbl[key]! > 0) return pbl[key]!;
  return service.price;
}

export interface HairDetailsData {
  hairLength?: string;
  hairCondition?: string;
  bleachHistory?: string;
  grayHairPercentage?: string;
  previousKeratin?: string;
  currentHairPhotoStorageId?: string;
  desiredHairPhotoStorageId?: string;
  /** Catalog color code (colors.json) chosen for the current-hair photo. */
  currentHairColorCode?: string;
  /** Catalog color code (colors.json) chosen for the desired/inspiration photo. */
  desiredHairColorCode?: string;
}

/**
 * Detection helpers — match on the Hebrew service name stored in the DB.
 *
 * Mapping:
 *   בליאז' / צבע / הייליטס / גוונים → length, images, condition, bleach, grayHair
 *   טיפול קראטין (any spelling)       → length, previousKeratin
 *   עיצוב שיער / תספורת               → length
 *   עיצוב לאירועים                    → length, images
 */

/** Covers every known spelling variant of "קראטין" including English. */
function matchesKeratin(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.includes("קראטין") ||
    lower.includes("קירטין") ||
    lower.includes("קרטין")  ||
    lower.includes("keratin")
  );
}

/**
 * Covers "בליאז'" in all its Unicode apostrophe/geresh variants.
 * The base substring "בליאז" already catches the trailing character
 * regardless of variant; the explicit full-string checks are a hard
 * guarantee against any edge-case encoding difference.
 */
function matchesBalayage(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    name.includes("בליאז")       ||  // base — catches any trailing char
    name.includes("בליאז׳") ||  // + Hebrew geresh ׳ (U+05F3)
    name.includes("בליאז'") ||  // + right single quotation mark ' (U+2019)
    name.includes("בליאז'") ||  // + ASCII apostrophe ' (U+0027)
    lower.includes("balayage")        // Latin fallback
  );
}

// Needs photo uploads (current hair + inspiration)
export function needsImages(name: string): boolean {
  return (
    name.includes("צבע")     ||
    matchesBalayage(name)    ||
    name.includes("הייליטס") ||
    name.includes("גוונים")  ||
    name.includes("אירועים")
  );
}

// Needs hair length selection
export function needsLength(name: string): boolean {
  return (
    matchesKeratin(name)      ||  // טיפול קראטין (all spellings)
    matchesBalayage(name)     ||  // בליאז' (all apostrophe variants)
    name.includes("תספורת")  ||  // תספורת
    name.includes("עיצוב")   ||  // עיצוב שיער, עיצוב לאירועים
    name.includes("אירועים") ||  // עיצוב לאירועים (belt-and-suspenders)
    name.includes("צבע")     ||  // צבע
    name.includes("הייליטס") ||  // הייליטס / גוונים
    name.includes("גוונים")      // גוונים
  );
}

// Needs hair condition + bleach history (coloring / lightening services)
export function needsConditionBleach(name: string): boolean {
  return (
    name.includes("צבע")     ||
    matchesBalayage(name)    ||
    name.includes("הייליטס") ||
    name.includes("גוונים")
  );
}

// Needs gray hair percentage (color services only — NOT highlights-only)
export function needsGrayHair(name: string): boolean {
  return (
    name.includes("צבע")   ||
    matchesBalayage(name)  ||
    name.includes("גוונים")
  );
}

// Needs previous keratin treatment history
export function needsPreviousKeratin(name: string): boolean {
  return matchesKeratin(name);
}

// True if this service triggers at least one extra hair-detail question
export function needsHairDetailsStep(service: Doc<"services"> | null): boolean {
  if (!service) return false;
  // Explicit admin flag takes priority over name-based detection
  if (service.requiresHairDetails === true) return true;
  if (service.requiresHairDetails === false) return false;
  const n = service.name.he;
  return (
    needsImages(n) ||
    needsLength(n) ||
    needsConditionBleach(n) ||
    needsGrayHair(n) ||
    needsPreviousKeratin(n)
  );
}
