import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ingestSource, deleteSourceVectors } from "@/lib/ingest";
import { SourceType } from "@prisma/client";

// Ingestion now also translates non-English sources segment by segment.
export const maxDuration = 300;

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
