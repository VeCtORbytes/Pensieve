import { NextResponse } from "next/server";
import { db } from "./db";

/**
 * Notebooks created without a signed-in user (userId null) are intentionally
 * open to anyone, so ownership only fails closed when the notebook actually
 * has an owner that doesn't match the caller.
 */
export async function loadOwnedNotebook(notebookId: string, userId: string | null) {
  const notebook = await db.notebook.findUnique({ where: { id: notebookId } });

  if (!notebook) {
    return { error: NextResponse.json({ error: "Notebook not found" }, { status: 404 }) } as const;
  }
  if (notebook.userId && notebook.userId !== userId) {
    return {
      error: NextResponse.json({ error: "Unauthorized notebook access" }, { status: 403 }),
    } as const;
  }
  return { data: notebook } as const;
}

export async function loadOwnedSource(sourceId: string, userId: string | null) {
  const source = await db.source.findUnique({
    where: { id: sourceId },
    include: { notebook: { select: { id: true, userId: true } } },
  });

  if (!source) {
    return { error: NextResponse.json({ error: "Source not found" }, { status: 404 }) } as const;
  }
  if (source.notebook.userId && source.notebook.userId !== userId) {
    return {
      error: NextResponse.json({ error: "Unauthorized source access" }, { status: 403 }),
    } as const;
  }
  return { data: source } as const;
}
