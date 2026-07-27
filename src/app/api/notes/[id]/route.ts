import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function getNoteModel() {
  const model = (prisma as any).note || (new PrismaClient() as any).note;
  if (!model) {
    throw new Error("Prisma Note model is not initialized.");
  }
  return model;
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { title, content } = await req.json();

    const noteModel = getNoteModel();
    const note = await noteModel.update({
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
    const noteModel = getNoteModel();
    await noteModel.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE note error:", error);
    return NextResponse.json({ error: error.message || "Failed to delete note" }, { status: 500 });
  }
}
