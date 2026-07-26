import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { qdrant, NOTEBOOK_COLLECTION_NAME } from "@/lib/qdrant";
import { chunkSegments } from "@/lib/chunking";
import { generateEmbeddings } from "@/lib/embeddings";
import {
  extractPdf,
  extractWebsite,
  extractYoutube,
  extractVtt,
  extractPlainText,
} from "@/lib/extractors";
import { Extraction } from "@/lib/locator";
import { SourceType } from "@prisma/client";
import crypto from "crypto";

export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "source id parameter is required" }, { status: 400 });
    }

    const source = await db.source.findUnique({ where: { id } });
    if (!source) {
      return NextResponse.json({ error: "Source not found" }, { status: 404 });
    }

    // 1. Reset status to QUEUED
    await db.source.update({
      where: { id },
      data: { status: "QUEUED", error: null },
    });

    const sourceContent = source.blobUrl || source.url || source.rawText || "";

    // 2. Execute background re-indexing pipeline
    reindexSourceInline(source.id, source.type, sourceContent, source.notebookId).catch((err) => {
      console.error(`Re-index error for source ${source.id}:`, err);
    });

    return NextResponse.json({ success: true, message: "Re-indexing started", source });
  } catch (err: any) {
    console.error("Re-indexing API error:", err);
    return NextResponse.json({ error: err.message || "Failed to re-index source" }, { status: 500 });
  }
}

async function reindexSourceInline(
  sourceId: string,
  type: SourceType,
  rawContent: string,
  notebookId: string
) {
  try {
    // Clean up existing Qdrant vector points for this source
    try {
      await qdrant.delete(NOTEBOOK_COLLECTION_NAME, {
        filter: {
          must: [{ key: "sourceId", match: { value: sourceId } }],
        },
      });
    } catch (qErr) {
      console.warn("Notice: Vector cleanup during re-index:", qErr);
    }

    // Phase 1: EXTRACTING
    await db.source.update({
      where: { id: sourceId },
      data: { status: "EXTRACTING" },
    });

    let extraction: Extraction;

    if (type === "PDF") {
      const base64Data = rawContent.includes(",") ? rawContent.split(",")[1] : rawContent;
      const pdfUint8Array = new Uint8Array(Buffer.from(base64Data, "base64"));
      extraction = await extractPdf(pdfUint8Array);
    } else if (type === "WEBSITE") {
      extraction = await extractWebsite(rawContent);
    } else if (type === "YOUTUBE") {
      if (rawContent.startsWith("http://") || rawContent.startsWith("https://")) {
        extraction = await extractYoutube(rawContent);
      } else {
        extraction = extractVtt(rawContent);
      }
    } else if (type === "TRANSCRIPT") {
      extraction = extractVtt(rawContent);
    } else {
      extraction = extractPlainText(rawContent);
    }

    const { rawText, segments } = extraction;

    if (!rawText || !rawText.trim()) {
      throw new Error(`Failed to extract text from ${type} source content.`);
    }

    // Phase 2: EMBEDDING
    await db.source.update({
      where: { id: sourceId },
      data: { status: "EMBEDDING", rawText },
    });

    const chunks = chunkSegments(segments, 900);

    if (chunks.length > 0) {
      const chunkTexts = chunks.map((c) => c.text);
      const embeddings = await generateEmbeddings(chunkTexts);

      const points = chunks.map((chunk, idx) => ({
        id: crypto.randomUUID(),
        vector: embeddings[idx],
        payload: {
          sourceId,
          notebookId,
          sourceType: type,
          text: chunk.text,
          chunkIndex: chunk.chunkIndex,
          locator: chunk.locator,
        },
      }));

      await qdrant.upsert(NOTEBOOK_COLLECTION_NAME, { points });
    }

    // Phase 3: READY
    await db.source.update({
      where: { id: sourceId },
      data: {
        status: "READY",
        chunkCount: chunks.length,
        error: null,
      },
    });
  } catch (err: any) {
    console.error(`Re-index source ${sourceId} failed:`, err);
    await db.source.update({
      where: { id: sourceId },
      data: {
        status: "FAILED",
        error: err.message || "Re-indexing error",
      },
    });
  }
}
