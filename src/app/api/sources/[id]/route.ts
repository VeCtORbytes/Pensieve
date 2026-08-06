import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { loadOwnedSource } from "@/lib/authz";

/** Full source row (including blobUrl/rawText), fetched on demand by the viewer. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { userId } = await auth();
    const { error } = await loadOwnedSource(id, userId);
    if (error) return error;

    // Heavy columns are excluded from the ownership check, so read them here.
    const source = await db.source.findUnique({ where: { id } });

    return NextResponse.json(source);
  } catch (error: any) {
    console.error("Failed to fetch source:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch source" },
      { status: 500 }
    );
  }
}
