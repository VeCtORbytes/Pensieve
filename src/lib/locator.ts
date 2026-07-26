export type Locator = {
  /**
   * Character offsets into a *specific variant's* rawText. Only meaningful
   * together with the variant the chunk was built from — translated text has
   * different offsets for the same content.
   */
  charStart: number;
  charEnd: number;
  page?: number;
  startSec?: number;
  endSec?: number;
  heading?: string;
  /**
   * Segment ordinals covered by this chunk, inclusive.
   *
   * Translation is performed one-to-one per segment, so ordinals are stable
   * across every language variant of a source. That makes them the anchor used
   * to (a) recognise that a Hindi hit and an English hit are the same content
   * and (b) re-locate a citation inside whichever variant the reader has open.
   */
  segStart?: number;
  segEnd?: number;
};

/** Per-segment metadata that does not change when the text is translated. */
export type SegmentMeta = Pick<Locator, "page" | "startSec" | "endSec" | "heading">;

export type Segment = {
  text: string;
  /** Ordinal within the source. Stable across variants. */
  index: number;
  locator: Locator;
};

export type Extraction = {
  rawText: string;
  segments: Segment[];
  /** BCP-47 tag when the extractor knows it outright (e.g. a caption track). */
  language?: string;
};

export type Chunk = {
  text: string;
  chunkIndex: number;
  locator: Locator;
};

/** `[charStart, charEnd]` for one segment, within a single variant's rawText. */
export type SegmentSpan = [number, number];

export const VARIANT_KINDS = ["ORIGINAL", "ENGLISH", "ROMANIZED"] as const;
export type VariantKind = (typeof VARIANT_KINDS)[number];

export function isVariantKind(value: unknown): value is VariantKind {
  return typeof value === "string" && (VARIANT_KINDS as readonly string[]).includes(value);
}
