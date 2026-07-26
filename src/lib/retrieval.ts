import { Locator, VariantKind } from "./locator";
import {
  detectLanguage,
  detectScript,
  isEnglish,
  languageName,
  normalizeLanguageCode,
  shortLanguageName,
} from "./language";

/**
 * Common English function words. Two or more distinct hits means the question is
 * confidently English, which lets us skip a model call on the hot path — a
 * romanized-Hindi question ("kya bataya video mein") matches almost none of them.
 */
const ENGLISH_MARKERS =
  /\b(the|is|are|was|were|what|why|how|does|do|did|an?|of|in|on|to|and|for|with|this|that|these|can|could|should|would|which|who|when|where|about|from|explain|summar\w*)\b/gi;

function looksEnglish(text: string): boolean {
  const hits = text.toLowerCase().match(ENGLISH_MARKERS);
  return hits ? new Set(hits).size >= 2 : false;
}

/**
 * Picks the reading variant from the question itself, for when the reader has not
 * explicitly chosen one.
 *
 * Ask in English about a Hindi video and you get English; ask in Devanagari and
 * you get the original; type romanized Hindi and you get Hinglish. An explicit
 * toggle always takes precedence over this and never reaches here.
 */
export async function inferReadingVariant(
  question: string,
  sourceLanguage: string | null
): Promise<VariantKind> {
  const sourceLang = normalizeLanguageCode(sourceLanguage);

  // Nothing to switch between for an English (or unknown-language) source.
  if (!sourceLang || isEnglish(sourceLang)) return "ORIGINAL";

  // Written in the source's own script — answer in the source's language.
  if (!detectScript(question).isLatin) return "ORIGINAL";

  // Latin script: either English, or the source language romanized.
  if (looksEnglish(question)) return "ENGLISH";

  const questionLang = await detectLanguage(question).catch(() => null);
  return questionLang === sourceLang ? "ROMANIZED" : "ENGLISH";
}

export type SearchPoint = {
  id: string | number;
  score: number;
  payload?: Record<string, unknown> | null;
};

export function pointVariant(point: SearchPoint): VariantKind {
  return (point.payload?.variantKind as VariantKind) || "ORIGINAL";
}

export function pointLocator(point: SearchPoint): Locator | undefined {
  return (point.payload?.locator as Locator) || undefined;
}

/**
 * True when two hits are the same passage in different languages.
 *
 * Segment ordinals are assigned once per source and preserved through
 * translation, so an overlapping ordinal range across two variants means the
 * same content. Two hits from the *same* variant are never duplicates: pieces of
 * one oversized segment share an ordinal but hold genuinely different text.
 */
export function isSamePassage(a: SearchPoint, b: SearchPoint): boolean {
  if ((a.payload?.sourceId as string) !== (b.payload?.sourceId as string)) return false;
  if (pointVariant(a) === pointVariant(b)) return false;

  const locA = pointLocator(a);
  const locB = pointLocator(b);

  if (
    locA?.segStart === undefined ||
    locA?.segEnd === undefined ||
    locB?.segStart === undefined ||
    locB?.segEnd === undefined
  ) {
    return false;
  }

  return locA.segStart <= locB.segEnd && locB.segStart <= locA.segEnd;
}

export type DedupeResult<T extends SearchPoint> = {
  kept: T[];
  /** Point id -> the variant whose copy of the passage was kept instead. */
  duplicateOf: Map<string, VariantKind>;
};

/**
 * Collapses cross-variant duplicates, keeping the better-scoring copy.
 * Input is expected in descending score order, as Qdrant returns it.
 */
export function dedupeByPassage<T extends SearchPoint>(points: T[]): DedupeResult<T> {
  const kept: T[] = [];
  const duplicateOf = new Map<string, VariantKind>();

  for (const point of points) {
    const twin = kept.find((existing) => isSamePassage(existing, point));
    if (twin) {
      duplicateOf.set(String(point.id), pointVariant(twin));
      continue;
    }
    kept.push(point);
  }

  return { kept, duplicateOf };
}

/**
 * Picks up to `limit` chunks, favouring breadth across sources first and then
 * backfilling by score, so a single-source question still gets enough context.
 */
export function selectForContext<T extends SearchPoint>(
  candidates: T[],
  limit: number,
  maxPerSource: number
): T[] {
  const selected: T[] = [];
  const perSource = new Map<string, number>();

  for (const point of candidates) {
    if (selected.length >= limit) break;
    const sourceId = (point.payload?.sourceId as string) || "unknown";
    const count = perSource.get(sourceId) || 0;
    if (count < maxPerSource) {
      selected.push(point);
      perSource.set(sourceId, count + 1);
    }
  }

  if (selected.length < limit) {
    for (const point of candidates) {
      if (selected.length >= limit) break;
      if (!selected.includes(point)) selected.push(point);
    }
  }

  // Renumber by score so citation [1] is always the strongest match.
  return selected.sort((a, b) => (b.score || 0) - (a.score || 0));
}

/** The language the model should write in, given the reader's selected variant. */
export function resolveAnswerLanguage(
  readingVariant: VariantKind,
  sourceLanguage: string | null
): string | null {
  if (readingVariant === "ENGLISH") return "English";
  if (!sourceLanguage) return null;

  if (readingVariant === "ROMANIZED") {
    return sourceLanguage === "hi"
      ? "Hinglish (Hindi written in the Latin alphabet, the way people type it casually online)"
      : `${shortLanguageName(sourceLanguage)} written in the Latin alphabet (romanized, not translated)`;
  }

  return languageName(sourceLanguage);
}
