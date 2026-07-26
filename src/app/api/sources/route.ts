import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { qdrant, NOTEBOOK_COLLECTION_NAME } from "@/lib/qdrant";
import { cleanVtt, chunkText } from "@/lib/chunking";
import { generateEmbeddings } from "@/lib/embeddings";
import { extractPdf, extractWebsite, extractYoutube } from "@/lib/extractors";
import { SourceType } from "@prisma/client";
import crypto from "crypto";

// Max duration for Vercel route handler inline execution (60s)
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

    // 1. Initial State: QUEUED
    const source = await db.source.create({
      data: {
        notebookId,
        type: sourceType,
        title: title.trim(),
        url: url || (type === "WEBSITE" || type === "YOUTUBE" ? content : null),
        rawText: sourceType === "TEXT" ? sourceContent : null,
        status: "QUEUED",
      },
    });

    // Execute inline ingestion pipeline
    processSourceInline(source.id, sourceType, sourceContent, notebookId).catch((err) => {
      console.error(`Background execution error for source ${source.id}:`, err);
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

    let extractedText = "";

    if (type === "PDF") {
      const base64Data = rawContent.includes(",") ? rawContent.split(",")[1] : rawContent;
      const pdfBuffer = Buffer.from(base64Data, "base64");
      extractedText = await extractPdf(pdfBuffer);
    } else if (type === "WEBSITE") {
      extractedText = await extractWebsite(rawContent);
    } else if (type === "YOUTUBE") {
      if (rawContent.startsWith("http://") || rawContent.startsWith("https://")) {
        extractedText = await extractYoutube(rawContent);
      } else {
        extractedText = cleanVtt(rawContent);
      }
    } else if (type === "TRANSCRIPT") {
      extractedText = cleanVtt(rawContent);
    } else {
      // TEXT
      extractedText = rawContent;
    }

    if (!extractedText || !extractedText.trim()) {
      throw new Error(`Failed to extract text from ${type} source content.`);
    }

    // Phase 2: EMBEDDING
    await db.source.update({
      where: { id: sourceId },
      data: { status: "EMBEDDING", rawText: extractedText },
    });

    const chunks = chunkText(extractedText, 800, 100);

    if (chunks.length > 0) {
      const chunkTexts = chunks.map((c) => c.text);
      const embeddings = await generateEmbeddings(chunkTexts);

      const points = chunks.map((chunk, idx) => ({
        id: crypto.randomUUID(),
        vector: embeddings[idx],
        payload: {
          sourceId,
          notebookId,
          text: chunk.text,
          chunkIndex: chunk.chunkIndex,
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
