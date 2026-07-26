import { Locator } from "./locator";

/**
 * Formats a locator into a clean, human-readable string for citation chips and retrieval traces.
 * Examples: "p.4", "41:12", "Heading Name", "Chars 100–300"
 */
export function locatorLabel(sourceType?: string | null, locator?: Locator | null): string {
  if (!locator) return "";

  if (locator.page !== undefined && locator.page !== null) {
    return `p.${locator.page}`;
  }

  if (locator.startSec !== undefined && locator.startSec !== null) {
    const mins = Math.floor(locator.startSec / 60);
    const secs = (locator.startSec % 60).toString().padStart(2, "0");
    return `${mins}:${secs}`;
  }

  if (locator.heading && locator.heading.trim()) {
    return locator.heading.trim();
  }

  if (
    locator.charStart !== undefined &&
    locator.charEnd !== undefined &&
    locator.charEnd > locator.charStart
  ) {
    return `Chars ${locator.charStart}–${locator.charEnd}`;
  }

  return "";
}
