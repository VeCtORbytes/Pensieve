"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { qdrant, NOTEBOOK_COLLECTION_NAME } from "@/lib/qdrant";

export async function createNotebook(formData?: FormData) {
  const { userId } = await auth();
  const customTitle = formData?.get("title") as string;
  const cleanTitle = customTitle?.trim() || "Untitled notebook";

  const notebook = await db.notebook.create({
    data: {
      title: cleanTitle,
      userId: userId ?? null,
    },
  });
  revalidatePath("/");
  redirect(`/notebook/${notebook.id}`);
}

export async function renameNotebook(id: string, title: string) {
  const { userId } = await auth();
  const clean = title.trim();
  if (!clean) return;

  const existing = await db.notebook.findUnique({ where: { id } });
  if (existing?.userId && existing.userId !== userId) {
    throw new Error("Unauthorized access to notebook");
  }

  await db.notebook.update({ where: { id }, data: { title: clean } });

  revalidatePath("/");
  revalidatePath(`/notebook/${id}`);
}

export async function deleteNotebook(id: string) {
  const { userId } = await auth();
  const existing = await db.notebook.findUnique({ where: { id } });
  if (existing?.userId && existing.userId !== userId) {
    throw new Error("Unauthorized access to notebook");
  }

  // Clean up all vector points for this notebook in Qdrant
  try {
    await qdrant.delete(NOTEBOOK_COLLECTION_NAME, {
      filter: {
        must: [
          {
            key: "notebookId",
            match: { value: id },
          },
        ],
      },
    });
  } catch (qErr) {
    console.warn("Notice: Failed to clean up Qdrant points for deleted notebook:", qErr);
  }

  await db.notebook.delete({ where: { id } });
  revalidatePath("/");
  redirect("/");
}
