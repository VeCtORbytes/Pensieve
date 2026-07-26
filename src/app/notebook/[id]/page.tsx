import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import NotebookHeader from "@/components/NotebookHeader";
import NotebookWorkspace from "@/components/NotebookWorkspace";
import EmptyNotebook from "@/components/EmptyNotebook";

export const dynamic = "force-dynamic";

export default async function NotebookPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { userId } = await auth();

  const notebook = await db.notebook.findUnique({
    where: { id },
    include: { sources: { orderBy: { createdAt: "desc" } } },
  });

  if (!notebook) notFound();

  // Enforce notebook user ownership
  if (notebook.userId && notebook.userId !== userId) {
    notFound();
  }

  const hasSources = notebook.sources.length > 0;

  return (
    <div className="flex h-screen flex-col bg-[#F5F7F8] text-[#141A22]">
      <NotebookHeader id={notebook.id} title={notebook.title} />

      {!hasSources ? (
        <EmptyNotebook notebookId={notebook.id} />
      ) : (
        <NotebookWorkspace
          notebookId={notebook.id}
          sourceCount={notebook.sources.length}
        />
      )}
    </div>
  );
}