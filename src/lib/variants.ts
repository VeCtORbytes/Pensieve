import crypto from "crypto";
import { SourceType } from "@prisma/client";
import { db } from "./db";
import { qdrant, NOTEBOOK_COLLECTION_NAME, ensureCollection } from "./qdrant";
import { chunkSegments } from "./chunking";
import { generateEmbeddings } from "./embeddings";
import { transformSegments } from "./translate";
import {
  ENGLISH,
  canRomanize,
  isEnglish,
  languageName,
  shortLanguageName,
} from "./language";
import {
  assembleVariant,
  metaFromSegments,
  parseSegmentMeta,
  parseSegmentSpans,
  segmentsFromVariant,
  spanForSegmentRange,
} from "./segments";
import { Segment, SegmentSpan, VariantKind } from "./locator";

/** Chunks embedded and upserted per round trip. */
const INDEX_BATCH_SIZE = 128;

export type VariantSummary = {
  kind: VariantKind;
  /** Language of this rendering's text. */
  language: string | null;
  label: string;
  status: "READY" | "PENDING" | "GENERATING" | "FAILED";
  /** True when the text exists and can be displayed right now. */
  available: boolean;
  /** True when this variant's chunks are searchable in Qdrant. */
  indexed: boolean;
  error?: string | null;
};

export type VariantText = {
  kind: VariantKind;
  language: string | null;
  rawText: string;
  spans: SegmentSpan[];
};

/** Records the source-level facts that all of its variants share. */
export async function saveSourceLanguage(
  sourceId: string,
  language: string | null,
  segments: Segment[]
): Promise<void> {
  await db.source.update({
    where: { id: sourceId },
    data: {
      language,
      segmentMeta: metaFromSegments(segments) as any,
    },
  });
}

/**
 * Writes one variant's text, deriving its character spans from the segment texts
 * so the ordinal-to-offset mapping is always consistent with the stored text.
 */
export async function saveVariant(
  sourceId: string,
  kind: VariantKind,
  language: string | null,
  texts: string[]
): Promise<VariantText> {
  const { rawText, spans } = assembleVariant(texts);

  await db.sourceVariant.upsert({
    where: { sourceId_kind: { sourceId, kind } },
    create: {
      sourceId,
      kind,
      language,
      rawText,
      segmentSpans: spans as any,
      status: "READY",
    },
    update: {
      language,
      rawText,
      segmentSpans: spans as any,
      status: "READY",
      error: null,
      indexed: false,
    },
  });

  return { kind, language, rawText, spans };
}

/**
 * Chunks, embeds, and upserts one variant, tagging every point with its variant
 * kind and segment range. Replaces any vectors this variant already had.
 */
export async function indexVariant(opts: {
  sourceId: string;
  notebookId: string;
  sourceType: SourceType;
  kind: VariantKind;
  segments: Segment[];
}): Promise<number> {
  const { sourceId, notebookId, sourceType, kind, segments } = opts;

  await ensureCollection();
  await deleteVariantVectors(sourceId, kind);

  const chunks = chunkSegments(segments);

  for (let i = 0; i < chunks.length; i += INDEX_BATCH_SIZE) {
    const batch = chunks.slice(i, i + INDEX_BATCH_SIZE);
    const vectors = await generateEmbeddings(batch.map((c) => c.text));

    await qdrant.upsert(NOTEBOOK_COLLECTION_NAME, {
      wait: true,
      points: batch.map((chunk, idx) => ({
        id: crypto.randomUUID(),
        vector: vectors[idx],
        payload: {
          sourceId,
          notebookId,
          sourceType,
          variantKind: kind,
          text: chunk.text,
          chunkIndex: chunk.chunkIndex,
          locator: chunk.locator,
        },
      })),
    });
  }

  await db.sourceVariant
    .update({
      where: { sourceId_kind: { sourceId, kind } },
      data: { indexed: true },
    })
    .catch(() => {
      /* variant row may have been removed mid-flight */
    });

  return chunks.length;
}

export async function deleteVariantVectors(
  sourceId: string,
  kind: VariantKind
): Promise<void> {
  try {
    await qdrant.delete(NOTEBOOK_COLLECTION_NAME, {
      filter: {
        must: [
          { key: "sourceId", match: { value: sourceId } },
          { key: "variantKind", match: { value: kind } },
        ],
      },
    });
  } catch (err) {
    console.warn(`Notice: failed to delete ${kind} vectors for ${sourceId}:`, err);
  }
}

/** Loads a variant's text and spans, or null when it does not exist yet. */
export async function getVariantText(
  sourceId: string,
  kind: VariantKind
): Promise<VariantText | null> {
  const variant = await db.sourceVariant.findUnique({
    where: { sourceId_kind: { sourceId, kind } },
  });

  if (!variant || variant.status !== "READY") return null;

  return {
    kind: variant.kind as VariantKind,
    language: variant.language,
    rawText: variant.rawText,
    spans: parseSegmentSpans(variant.segmentSpans),
  };
}

/**
 * Returns the passage covering a segment range, rendered in the requested
 * variant.
 */
export async function materializeVariantText(
  sourceId: string,
  kind: VariantKind,
  segStart?: number,
  segEnd?: number
): Promise<string | null> {
  const variant = await getVariantText(sourceId, kind);
  if (!variant) return null;

  const span = spanForSegmentRange(variant.spans, segStart, segEnd);
  if (!span) return null;

  const text = variant.rawText.slice(span[0], span[1]).trim();
  return text.length > 0 ? text : null;
}

/**
 * Loads one variant for many sources at once, so building chat context does not
 * issue a query per citation.
 */
export async function loadVariantsForSources(
  sourceIds: string[],
  kind: VariantKind
): Promise<Map<string, VariantText>> {
  if (sourceIds.length === 0) return new Map();

  const rows = await db.sourceVariant.findMany({
    where: { sourceId: { in: sourceIds }, kind, status: "READY" },
  });

  return new Map(
    rows.map((row) => [
      row.sourceId,
      {
        kind: row.kind as VariantKind,
        language: row.language,
        rawText: row.rawText,
        spans: parseSegmentSpans(row.segmentSpans),
      },
    ])
  );
}

/** Slices the passage covering a segment range out of an already-loaded variant. */
export function sliceVariant(
  variant: VariantText | undefined,
  segStart?: number,
  segEnd?: number
): string | null {
  if (!variant) return null;

  const span = spanForSegmentRange(variant.spans, segStart, segEnd);
  if (!span) return null;

  const text = variant.rawText.slice(span[0], span[1]).trim();
  return text.length > 0 ? text : null;
}

/**
 * Generates a variant on demand and caches it. ORIGINAL always exists already;
 * ENGLISH and ROMANIZED are derived from it segment by segment. Self-heals missing
 * ORIGINAL variants from source.rawText.
 */
export async function ensureVariant(
  sourceId: string,
  kind: VariantKind
): Promise<VariantText> {
  const existing = await getVariantText(sourceId, kind);
  if (existing) return existing;

  const source = await db.source.findUnique({
    where: { id: sourceId },
    select: { language: true, rawText: true, segmentMeta: true },
  });
  if (!source) throw new Error("Source not found");

  let original = await getVariantText(sourceId, "ORIGINAL");
  if (!original) {
    if (source.rawText) {
      const parts = source.rawText.split("\n\n").filter((p) => p.trim());
      original = await saveVariant(
        sourceId,
        "ORIGINAL",
        source.language,
        parts.length > 0 ? parts : [source.rawText]
      );
    } else {
      throw new Error("The original text is missing; re-index this source.");
    }
  }

  // An English source needs no English translation — mirror the original.
  if (kind === "ENGLISH" && isEnglish(source.language)) {
    return saveVariant(sourceId, kind, ENGLISH, segmentTexts(original));
  }

  await db.sourceVariant.upsert({
    where: { sourceId_kind: { sourceId, kind } },
    create: {
      sourceId,
      kind,
      language: kind === "ENGLISH" ? ENGLISH : source.language,
      rawText: "",
      segmentSpans: [] as any,
      status: "GENERATING",
    },
    update: { status: "GENERATING", error: null },
  });

  try {
    const transformed = await transformSegments(
      segmentTexts(original),
      kind === "ENGLISH" ? "translate-en" : "romanize",
      source.language
    );

    return await saveVariant(
      sourceId,
      kind,
      kind === "ENGLISH" ? ENGLISH : source.language,
      transformed
    );
  } catch (err: any) {
    await db.sourceVariant
      .update({
        where: { sourceId_kind: { sourceId, kind } },
        data: { status: "FAILED", error: err?.message || "Generation failed" },
      })
      .catch(() => {});
    throw err;
  }
}

function segmentTexts(variant: VariantText): string[] {
  return variant.spans.map(([start, end]) => variant.rawText.slice(start, end));
}

/**
 * Describes which renderings exist or can be offered for a source, so the UI can
 * show a language switcher without guessing.
 */
export async function listVariants(sourceId: string): Promise<{
  language: string | null;
  languageLabel: string;
  variants: VariantSummary[];
}> {
  const source = await db.source.findUnique({
    where: { id: sourceId },
    select: { language: true, rawText: true },
  });
  if (!source) throw new Error("Source not found");

  const rows = await db.sourceVariant.findMany({ where: { sourceId } });
  const byKind = new Map(rows.map((row) => [row.kind as VariantKind, row]));

  const sampleText = source.rawText || "";
  const offered: VariantKind[] = ["ORIGINAL"];
  if (!isEnglish(source.language)) offered.push("ENGLISH");
  if (canRomanize(source.language, sampleText)) offered.push("ROMANIZED");

  const variants: VariantSummary[] = offered.map((kind) => {
    const row = byKind.get(kind);
    const language = kind === "ENGLISH" ? ENGLISH : source.language;

    return {
      kind,
      language: row?.language ?? language,
      label: variantLabel(kind, source.language),
      status: (row?.status as VariantSummary["status"]) ?? "PENDING",
      available: row?.status === "READY",
      indexed: row?.indexed ?? false,
      error: row?.error ?? null,
    };
  });

  return {
    language: source.language,
    languageLabel: languageName(source.language),
    variants,
  };
}

/** e.g. "हिन्दी (original)", "English", "Hinglish". */
export function variantLabel(kind: VariantKind, sourceLanguage?: string | null): string {
  if (kind === "ENGLISH") return "English";

  if (kind === "ROMANIZED") {
    return sourceLanguage === "hi"
      ? "Hinglish"
      : `${shortLanguageName(sourceLanguage)} (Latin)`;
  }

  return `${shortLanguageName(sourceLanguage)} (original)`;
}

/** Rebuilds chunkable segments for a variant, reattaching shared metadata. */
export function variantSegments(
  variant: VariantText,
  segmentMeta: unknown
): Segment[] {
  return segmentsFromVariant(
    variant.rawText,
    variant.spans,
    parseSegmentMeta(segmentMeta)
  );
}
