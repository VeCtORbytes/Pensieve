import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const notebookId = searchParams.get("notebookId");

    if (!notebookId) {
      return NextResponse.json({ error: "notebookId is required" }, { status: 400 });
    }

    const notes = await prisma.note.findMany({
      where: { notebookId },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ notes });
  } catch (error: any) {
    console.error("GET notes error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch notes" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { notebookId, title = "Untitled Note", content = "" } = await req.json();
    if (!notebookId) {
      return NextResponse.json({ error: "notebookId is required" }, { status: 400 });
    }

    const note = await prisma.note.create({
      data: {
        notebookId,
        title: title.trim() || "Untitled Note",
        content,
      },
    });

    return NextResponse.json({ note }, { status: 201 });
  } catch (error: any) {
    console.error("POST note error:", error);
    return NextResponse.json({ error: error.message || "Failed to create note" }, { status: 500 });
  }
}
