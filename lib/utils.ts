import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(agorot: number): string {
  return `₪${(agorot / 100).toFixed(0)}`;
}

export function formatDuration(minutes: number, lang: "he" | "ar"): string {
  if (lang === "ar") return `${minutes} دق'`;
  return `${minutes} דק'`;
}

export function toDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatSlotTime(startTimeMs: number, timezone: string, lang: "he" | "ar"): string {
  const locale = lang === "ar" ? "ar-IL" : "he-IL";
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
    hour12: false,
  }).format(new Date(startTimeMs));
}
