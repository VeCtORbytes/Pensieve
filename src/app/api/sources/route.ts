import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { ingestSource, deleteSourceVectors } from "@/lib/ingest";
import { SourceType } from "@prisma/client";
import { loadOwnedNotebook, loadOwnedSource } from "@/lib/authz";

// Ingestion now also translates non-English sources segment by segment.
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const notebookId = searchParams.get("notebookId");

  if (!notebookId) {
    return NextResponse.json({ error: "notebookId parameter is required" }, { status: 400 });
  }

  const { userId } = await auth();
  const { error } = await loadOwnedNotebook(notebookId, userId);
  if (error) return error;

  // Lightweight fields only: this is polled every few seconds while sources are
  // processing, and blobUrl/rawText can be several MB (base64 PDFs) — the list
  // view never renders them. SourceViewerModal fetches the full row on demand.
  const sources = await db.source.findMany({
    where: { notebookId },
    select: {
      id: true,
      notebookId: true,
      type: true,
      title: true,
      url: true,
      status: true,
      error: true,
      chunkCount: true,
      createdAt: true,
    },
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

    const { userId } = await auth();
    const { error } = await loadOwnedNotebook(notebookId, userId);
    if (error) return error;

    const sourceType = (type as string).toUpperCase() as SourceType;
    const sourceContent = content || url || "";

    // 1. Initial State: QUEUED (Store blobUrl Data URL for PDF)
    const source = await db.source.create({
      data: {
        notebookId,
        type: sourceType,
        title: title.trim(),
        url: url || (type === "WEBSITE" || type === "YOUTUBE" ? content : null),
        blobUrl:
          sourceType === "PDF" && sourceContent.startsWith("data:application/pdf")
            ? sourceContent
            : null,
        rawText: sourceType === "TEXT" ? sourceContent : null,
        status: "QUEUED",
      },
    });

    // 2. Run the ingestion pipeline.
    // NOTE: not awaited, so the client can poll for status. This only works
    // where the process outlives the response (e.g. `next dev`). On a
    // serverless host the context is frozen once the response is sent and the
    // source will stall in QUEUED/EXTRACTING — that needs a real job queue.
    ingestSource({
      sourceId: source.id,
      type: sourceType,
      rawContent: sourceContent,
      notebookId,
    }).catch((err) => {
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

// Delete Source + Delete Qdrant Vectors
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "source id parameter is required" }, { status: 400 });
    }

    const { userId } = await auth();
    const { error } = await loadOwnedSource(id, userId);
    if (error) return error;

    await deleteSourceVectors(id);
    await db.source.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: "Source and vectors deleted successfully",
    });
  } catch (error: any) {
    console.error("Failed to delete source:", error);
    return NextResponse.json({ error: error.message || "Failed to delete source" }, { status: 500 });
  }
}
