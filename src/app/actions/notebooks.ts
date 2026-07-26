"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

export async function createNotebook() {
  const notebook = await db.notebook.create({
    data: { title: "Untitled notebook" },
  });
  revalidatePath("/");
  redirect(`/notebook/${notebook.id}`);
}

export async function renameNotebook(id: string, title: string) {
  const clean = title.trim();
  if (!clean) return;

  await db.notebook.update({ where: { id }, data: { title: clean } });

  revalidatePath("/");
  revalidatePath(`/notebook/${id}`);
}

export async function deleteNotebook(id: string) {
  await db.notebook.delete({ where: { id } });
  revalidatePath("/");
  redirect("/");
}
