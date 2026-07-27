import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const notebookId = searchParams.get("notebookId");

    if (!notebookId) {
      return NextResponse.json({ error: "notebookId is required" }, { status: 400 });
    }

    const notes = await db.note.findMany({
      where: { notebookId },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ notes });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch notes" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { notebookId, title = "Untitled Note", content = "" } = await req.json();
    if (!notebookId) {
      return NextResponse.json({ error: "notebookId is required" }, { status: 400 });
    }

    const note = await db.note.create({
      data: {
        notebookId,
        title: title.trim() || "Untitled Note",
        content,
      },
    });

    return NextResponse.json({ note }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to create note" }, { status: 500 });
  }
}
