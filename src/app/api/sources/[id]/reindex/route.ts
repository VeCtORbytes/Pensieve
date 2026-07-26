import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ingestSource } from "@/lib/ingest";

export const maxDuration = 60;

export async function POST(
  _req: NextRequest,
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

    // 2. Re-run the pipeline. It clears this source's existing vectors first,
    // so re-indexing replaces rather than duplicates them.
    ingestSource({
      sourceId: source.id,
      type: source.type,
      rawContent: sourceContent,
      notebookId: source.notebookId,
    }).catch((err) => {
      console.error(`Re-index error for source ${source.id}:`, err);
    });

    return NextResponse.json({ success: true, message: "Re-indexing started", source });
  } catch (err: any) {
    console.error("Re-indexing API error:", err);
    return NextResponse.json({ error: err.message || "Failed to re-index source" }, { status: 500 });
  }
}
