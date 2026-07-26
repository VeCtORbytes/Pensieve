import { Segment, SegmentMeta, SegmentSpan } from "./locator";

export const SEGMENT_SEPARATOR = "\n\n";

export type AssembledVariant = {
  rawText: string;
  spans: SegmentSpan[];
};

/**
 * Joins segment texts into one document and records each segment's exact
 * character span within it.
 *
 * Every input yields exactly one span — including empty ones — so segment
 * ordinals line up across a source's language variants even if a translation
 * renders some segment as nothing. This is the only place variant text is
 * assembled, so ORIGINAL and translated variants are always laid out the same
 * way.
 */
export function assembleVariant(texts: string[]): AssembledVariant {
  const spans: SegmentSpan[] = [];
  let raw = "";

  texts.forEach((text, index) => {
    const clean = (text ?? "").trim();
    const start = raw.length;
    spans.push([start, start + clean.length]);

    raw += clean;
    if (index < texts.length - 1) raw += SEGMENT_SEPARATOR;
  });

  return { rawText: raw, spans };
}

/** Pulls the translation-invariant metadata out of a source's segments. */
export function metaFromSegments(segments: Segment[]): SegmentMeta[] {
  return segments.map((seg) => ({
    page: seg.locator.page,
    startSec: seg.locator.startSec,
    endSec: seg.locator.endSec,
    heading: seg.locator.heading,
  }));
}

/**
 * Rebuilds chunkable segments for one variant from its stored spans, reattaching
 * the shared per-segment metadata so a translated chunk still carries the right
 * page number or timestamp.
 */
export function segmentsFromVariant(
  rawText: string,
  spans: SegmentSpan[],
  meta: SegmentMeta[]
): Segment[] {
  return spans.map(([charStart, charEnd], index) => ({
    text: rawText.slice(charStart, charEnd),
    index,
    locator: {
      ...(meta[index] ?? {}),
      charStart,
      charEnd,
      segStart: index,
      segEnd: index,
    },
  }));
}

/**
 * Maps a chunk's segment range onto the character span it occupies in some other
 * variant. This is what lets a citation found in the English text highlight the
 * corresponding Hindi passage, and vice versa.
 */
export function spanForSegmentRange(
  spans: SegmentSpan[],
  segStart?: number,
  segEnd?: number
): SegmentSpan | null {
  if (segStart === undefined || segEnd === undefined) return null;

  const first = clampIndex(segStart, spans.length);
  const last = clampIndex(segEnd, spans.length);
  if (first === null || last === null) return null;

  const lo = Math.min(first, last);
  const hi = Math.max(first, last);
  return [spans[lo][0], spans[hi][1]];
}

function clampIndex(value: number, length: number): number | null {
  if (!Number.isInteger(value) || length === 0) return null;
  if (value < 0) return 0;
  if (value >= length) return length - 1;
  return value;
}

/** Narrows unknown JSON from Prisma into a span array. */
export function parseSegmentSpans(value: unknown): SegmentSpan[] {
  if (!Array.isArray(value)) return [];
  const spans: SegmentSpan[] = [];

  for (const entry of value) {
    if (
      Array.isArray(entry) &&
      typeof entry[0] === "number" &&
      typeof entry[1] === "number"
    ) {
      spans.push([entry[0], entry[1]]);
    }
  }

  return spans;
}

/** Narrows unknown JSON from Prisma into per-segment metadata. */
export function parseSegmentMeta(value: unknown): SegmentMeta[] {
  if (!Array.isArray(value)) return [];

  return value.map((entry) => {
    const record = (entry ?? {}) as Record<string, unknown>;
    return {
      page: typeof record.page === "number" ? record.page : undefined,
      startSec: typeof record.startSec === "number" ? record.startSec : undefined,
      endSec: typeof record.endSec === "number" ? record.endSec : undefined,
      heading: typeof record.heading === "string" ? record.heading : undefined,
    };
  });
}
