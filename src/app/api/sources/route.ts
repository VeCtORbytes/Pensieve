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

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const notebookId = searchParams.get("notebookId");

  if (!notebookId) {
    return NextResponse.json({ error: "notebookId parameter is required" }, { status: 400 });
  }

  const sources = await db.source.findMany({
    where: { notebookId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(sources);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { notebookId, type, title, content, url } = body;

    if (!notebookId || !type || !title) {
      return NextResponse.json(
        { error: "notebookId, type, and title are required" },
        { status: 400 }
      );
    }

    const sourceType = (type as string).toUpperCase() as SourceType;
    const sourceContent = content || url || "";

    // 1. Initial State: QUEUED (Store blobUrl Data URL for PDF)
    const source = await db.source.create({
      data: {
        notebookId,
        type: sourceType,
        title: title.trim(),
        url: url || (type === "WEBSITE" || type === "YOUTUBE" ? content : null),
        blobUrl: sourceType === "PDF" && sourceContent.startsWith("data:application/pdf") ? sourceContent : null,
        rawText: sourceType === "TEXT" ? sourceContent : null,
        status: "QUEUED",
      },
    });

    // Execute background ingestion pipeline safely
    processSourceInline(source.id, sourceType, sourceContent, notebookId).catch((err) => {
      console.error(`Background ingestion error for source ${source.id}:`, err);
    });

    return NextResponse.json(source, { status: 201 });
  } catch (error: any) {
    console.error("Failed to create source:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create source" },
      { status: 500 }
    );
  }
}

// Re-index endpoint: Delete vectors, re-chunk from stored rawText/blobUrl, re-embed
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: "source id is required" }, { status: 400 });
    }

    const source = await db.source.findUnique({ where: { id } });
    if (!source) {
      return NextResponse.json({ error: "Source not found" }, { status: 404 });
    }

    // Reset status to QUEUED
    await db.source.update({
      where: { id },
      data: { status: "QUEUED", error: null },
    });

    const sourceContent = source.blobUrl || source.url || source.rawText || "";

    processSourceInline(source.id, source.type, sourceContent, source.notebookId).catch((err) => {
      console.error(`Re-index error for source ${source.id}:`, err);
    });

    return NextResponse.json({ message: "Re-indexing started", source });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Re-indexing failed" }, { status: 500 });
  }
}

// Delete Source + Delete Qdrant Vectors
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "source id parameter is required" }, { status: 400 });
    }

    // 1. Delete points from Qdrant vector database
    try {
      await qdrant.delete(NOTEBOOK_COLLECTION_NAME, {
        filter: {
          must: [
            {
              key: "sourceId",
              match: { value: id },
            },
          ],
        },
      });
    } catch (qErr) {
      console.warn("Notice: Failed to delete points from Qdrant:", qErr);
    }

    // 2. Delete source record from PostgreSQL
    await db.source.delete({ where: { id } });

    return NextResponse.json({ success: true, message: "Source and vectors deleted successfully" });
  } catch (error: any) {
    console.error("Failed to delete source:", error);
    return NextResponse.json({ error: error.message || "Failed to delete source" }, { status: 500 });
  }
}

async function processSourceInline(
  sourceId: string,
  type: SourceType,
  rawContent: string,
  notebookId: string
) {
  try {
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
      // TEXT
      extraction = extractPlainText(rawContent);
    }

    const { rawText, segments } = extraction;

    if (!rawText || !rawText.trim()) {
      throw new Error(`Failed to extract text from ${type} source content.`);
    }

    // Phase 2: EMBEDDING (Save rawText as coordinate system)
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

      // Upsert vectors to Qdrant collection
      await qdrant.upsert(NOTEBOOK_COLLECTION_NAME, {
        points,
      });
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
    console.error(`Source ${sourceId} ingestion failed:`, err);
    await db.source.update({
      where: { id: sourceId },
      data: {
        status: "FAILED",
        error: err.message || "Ingestion pipeline error",
      },
    });
  }
}
