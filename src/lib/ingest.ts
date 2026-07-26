import { SourceType } from "@prisma/client";
import { db } from "./db";
import { qdrant, NOTEBOOK_COLLECTION_NAME, ensureCollection } from "./qdrant";
import { transformSegments } from "./translate";
import { detectLanguage, ENGLISH, needsTranslation } from "./language";
import {
  extractPdf,
  extractWebsite,
  extractYoutube,
  extractVtt,
  extractPlainText,
} from "./extractors";
import { Extraction } from "./locator";
import {
  indexVariant,
  saveSourceLanguage,
  saveVariant,
  variantSegments,
} from "./variants";
import { metaFromSegments } from "./segments";

export interface IngestArgs {
  sourceId: string;
  type: SourceType;
  /** Data URL, remote URL, or literal text, depending on `type`. */
  rawContent: string;
  notebookId: string;
}

/**
 * Extract -> detect language -> build variants -> chunk -> embed -> upsert,
 * driving the source's status column as it goes. Shared by initial ingestion and
 * re-indexing.
 *
 * Both the ORIGINAL and the ENGLISH rendering are indexed, so a question asked
 * in either language retrieves well. Their chunks share segment ordinals, which
 * the chat route uses to recognise the two copies of a passage as one hit.
 *
 * Existing vectors for the source are removed first, so first runs and retries
 * are idempotent rather than accumulating duplicates.
 */
export async function ingestSource({
  sourceId,
  type,
  rawContent,
  notebookId,
}: IngestArgs): Promise<void> {
  try {
    await ensureCollection();
    await deleteSourceVectors(sourceId);

    // Phase 1: EXTRACTING
    await db.source.update({
      where: { id: sourceId },
      data: { status: "EXTRACTING" },
    });

    const extraction = await extract(type, rawContent);
    const { rawText, segments } = extraction;

    if (!rawText || !rawText.trim()) {
      throw new Error(`Failed to extract text from ${type} source content.`);
    }

    // The caption track's own language tag when we have one, otherwise inferred.
    const language = await detectLanguage(rawText, extraction.language);

    await db.source.update({
      where: { id: sourceId },
      data: { status: "EMBEDDING", rawText, language },
    });
    await saveSourceLanguage(sourceId, language, segments);

    // ORIGINAL variant: the text exactly as extracted.
    const originalTexts = segments.map((seg) => seg.text);
    await saveVariant(sourceId, "ORIGINAL", language, originalTexts);

    let indexedChunks = await indexVariant({
      sourceId,
      notebookId,
      sourceType: type,
      kind: "ORIGINAL",
      segments,
    });

    // ENGLISH variant: only worth building for a non-English source. Translating
    // per segment keeps ordinals aligned with the original.
    if (needsTranslation(language)) {
      await db.source.update({
        where: { id: sourceId },
        data: { status: "TRANSLATING" },
      });

      const englishTexts = await transformSegments(originalTexts, "translate-en", language);
      const englishVariant = await saveVariant(sourceId, "ENGLISH", ENGLISH, englishTexts);

      await db.source.update({
        where: { id: sourceId },
        data: { status: "EMBEDDING" },
      });

      indexedChunks += await indexVariant({
        sourceId,
        notebookId,
        sourceType: type,
        kind: "ENGLISH",
        segments: variantSegments(englishVariant, metaFromSegments(segments)),
      });
    }

    // Phase 3: READY
    await db.source.update({
      where: { id: sourceId },
      data: { status: "READY", chunkCount: indexedChunks, error: null },
    });
  } catch (err: any) {
    console.error(`Source ${sourceId} ingestion failed:`, err);
    await db.source
      .update({
        where: { id: sourceId },
        data: { status: "FAILED", error: err?.message || "Ingestion pipeline error" },
      })
      .catch((dbErr) => {
        console.error(`Could not mark source ${sourceId} as FAILED:`, dbErr);
      });
  }
}

/** Removes every variant's vectors for a source. */
export async function deleteSourceVectors(sourceId: string): Promise<void> {
  try {
    await qdrant.delete(NOTEBOOK_COLLECTION_NAME, {
      filter: { must: [{ key: "sourceId", match: { value: sourceId } }] },
    });
  } catch (err) {
    console.warn(`Notice: failed to delete Qdrant points for source ${sourceId}:`, err);
  }
}

async function extract(type: SourceType, rawContent: string): Promise<Extraction> {
  if (type === "PDF") {
    const base64Data = rawContent.includes(",") ? rawContent.split(",")[1] : rawContent;
    return extractPdf(new Uint8Array(Buffer.from(base64Data, "base64")));
  }

  if (type === "WEBSITE") {
    return extractWebsite(rawContent);
  }

  if (type === "YOUTUBE") {
    const isUrl = rawContent.startsWith("http://") || rawContent.startsWith("https://");
    return isUrl ? extractYoutube(rawContent) : extractVtt(rawContent);
  }

  if (type === "TRANSCRIPT") {
    return extractVtt(rawContent);
  }

  return extractPlainText(rawContent);
}
