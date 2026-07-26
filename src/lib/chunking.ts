import { Chunk, Segment } from "./locator";

const SEPARATOR = "\n\n";

/** Target chunk size in characters. Enforced as a hard cap, not a hint. */
export const DEFAULT_MAX_CHARS = 900;
/** Characters repeated between consecutive pieces of one oversized segment. */
export const DEFAULT_OVERLAP = 120;

type PreparedSegment = Segment & {
  /**
   * True when this came from splitting an oversized segment. Such pieces overlap
   * their neighbours in rawText, so merging them would make the unified locator
   * span wider than the text it describes. They are always kept standalone.
   */
  standalone: boolean;
};

/**
 * Chunks structured segments into maxChars windows while unifying locators.
 *
 * Segments larger than maxChars are split with overlap; segments smaller than
 * maxChars are grouped. Every chunk satisfies
 * `rawText.slice(charStart, charEnd)` covering exactly the chunk's own text.
 */
export function chunkSegments(
  segments: Segment[],
  maxChars: number = DEFAULT_MAX_CHARS,
  overlap: number = DEFAULT_OVERLAP
): Chunk[] {
  if (!segments || segments.length === 0) return [];

  const cap = Math.max(1, Math.floor(maxChars));
  const step = Math.min(Math.max(0, Math.floor(overlap)), Math.floor(cap / 2));

  const prepared: PreparedSegment[] = [];
  for (const seg of segments) {
    const normalized = normalize(seg);
    if (normalized) prepared.push(...splitOversized(normalized, cap, step));
  }
  if (prepared.length === 0) return [];

  const chunks: Chunk[] = [];
  let parts: string[] = [];
  let length = 0;
  let first: PreparedSegment | null = null;
  let last: PreparedSegment | null = null;

  const flush = () => {
    const startSeg = first;
    const endSeg = last;
    if (parts.length === 0 || !startSeg || !endSeg) return;

    chunks.push({
      text: parts.join(SEPARATOR),
      chunkIndex: chunks.length,
      locator: {
        charStart: startSeg.locator.charStart,
        charEnd: endSeg.locator.charEnd,
        page: startSeg.locator.page,
        startSec: startSeg.locator.startSec,
        heading: startSeg.locator.heading,
        endSec: endSeg.locator.endSec,
        // Ordinal range is what survives translation, so it is recorded even
        // though the character offsets above are variant-specific.
        segStart: startSeg.index,
        segEnd: endSeg.index,
      },
    });

    parts = [];
    length = 0;
    first = null;
    last = null;
  };

  for (const seg of prepared) {
    const projected =
      parts.length === 0 ? seg.text.length : length + SEPARATOR.length + seg.text.length;

    // Flush before absorbing the segment, so the emitted chunk's locator only
    // ever covers segments whose text is actually in it.
    if (parts.length > 0 && (projected > cap || seg.standalone || last?.standalone)) {
      flush();
    }

    if (parts.length === 0) {
      first = seg;
      length = seg.text.length;
    } else {
      length += SEPARATOR.length + seg.text.length;
    }
    parts.push(seg.text);
    last = seg;
  }
  flush();

  return chunks;
}

/**
 * Trims a segment while keeping its locator aligned, so that
 * `charEnd - charStart === text.length` holds for everything downstream.
 */
function normalize(seg: Segment): Segment | null {
  const source = seg.text ?? "";
  const leading = source.length - source.trimStart().length;
  const text = source.trim();
  if (!text) return null;

  const charStart = seg.locator.charStart + leading;
  return {
    text,
    index: seg.index,
    locator: { ...seg.locator, charStart, charEnd: charStart + text.length },
  };
}

/**
 * Splits a segment longer than maxChars into overlapping pieces, preferring
 * paragraph then sentence then word boundaries. Offsets stay exact because each
 * piece's charStart is derived from its position within the parent segment.
 */
function splitOversized(
  seg: Segment,
  maxChars: number,
  overlap: number
): PreparedSegment[] {
  if (seg.text.length <= maxChars) return [{ ...seg, standalone: false }];

  const pieces: PreparedSegment[] = [];
  const base = seg.locator.charStart;
  const text = seg.text;
  let pos = 0;

  while (pos < text.length) {
    let end = Math.min(pos + maxChars, text.length);
    if (end < text.length) end = findSplitPoint(text, pos, end, maxChars);

    const piece = text.slice(pos, end);
    const leading = piece.length - piece.trimStart().length;
    const trimmed = piece.trim();

    if (trimmed) {
      const charStart = base + pos + leading;
      pieces.push({
        text: trimmed,
        // Every piece keeps the parent's ordinal: they are all the same segment,
        // so they all map to the same span in a translated variant.
        index: seg.index,
        locator: { ...seg.locator, charStart, charEnd: charStart + trimmed.length },
        standalone: true,
      });
    }

    if (end >= text.length) break;
    pos = Math.max(end - overlap, pos + 1); // always make forward progress
  }

  return pieces;
}

/**
 * Finds the latest natural boundary inside [start, hardEnd), falling back to a
 * hard cut. Refuses boundaries in the first half of the window so a stray
 * separator cannot produce a tiny chunk.
 */
function findSplitPoint(
  text: string,
  start: number,
  hardEnd: number,
  maxChars: number
): number {
  const earliest = start + Math.max(1, Math.floor(maxChars * 0.5));

  for (const probe of [SEPARATOR, ". ", "! ", "? ", "\n", " "]) {
    const found = text.lastIndexOf(probe, hardEnd - probe.length);
    if (found >= earliest) return found + probe.length;
  }

  return hardEnd;
}
