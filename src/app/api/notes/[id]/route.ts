import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { title, content } = await req.json();

    const note = await db.note.update({
      where: { id },
      data: {
        ...(title !== undefined && { title: title.trim() || "Untitled Note" }),
        ...(content !== undefined && { content }),
      },
    });

    return NextResponse.json({ note });
  } catch (error: any) {
    console.error("PUT note error:", error);
    return NextResponse.json({ error: error.message || "Failed to update note" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await db.note.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE note error:", error);
    return NextResponse.json({ error: error.message || "Failed to delete note" }, { status: 500 });
  }
}
