import { notFound } from "next/navigation";
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

  const notebook = await db.notebook.findUnique({
    where: { id },
    include: { sources: { orderBy: { createdAt: "desc" } } },
  });

  if (!notebook) notFound();

  const hasSources = notebook.sources.length > 0;

  return (
    <div className="flex h-screen flex-col bg-vessel text-ink">
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