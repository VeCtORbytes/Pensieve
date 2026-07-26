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

  // Optimized query: Select only lightweight fields and source count
  // Avoid transferring heavy rawText / Base64 PDF data over network
  const notebook = await db.notebook.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      userId: true,
      _count: { select: { sources: true } },
    },
  });

  if (!notebook) notFound();

  // Enforce notebook user ownership
  if (notebook.userId && notebook.userId !== userId) {
    notFound();
  }

  const sourceCount = notebook._count.sources;
  const hasSources = sourceCount > 0;

  return (
    <div className="flex h-screen flex-col bg-vessel text-ink">
      <NotebookHeader id={notebook.id} title={notebook.title} />

      {!hasSources ? (
        <EmptyNotebook notebookId={notebook.id} />
      ) : (
        <NotebookWorkspace
          notebookId={notebook.id}
          sourceCount={sourceCount}
        />
      )}
    </div>
  );
}