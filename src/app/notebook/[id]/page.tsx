import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import NotebookHeader from "@/components/NotebookHeader";
import SourcePanel from "@/components/SourcePanel";
import ChatPanel from "@/components/ChatPanel";

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

  return (
    <div className="flex h-screen flex-col bg-white">
      <NotebookHeader id={notebook.id} title={notebook.title} />

      <div className="grid flex-1 grid-cols-[340px_1fr] overflow-hidden">
        <aside className="border-r border-neutral-200 overflow-hidden">
          <SourcePanel notebookId={notebook.id} />
        </aside>

        <section className="flex flex-col overflow-hidden bg-neutral-50/30">
          <ChatPanel notebookId={notebook.id} />
        </section>
      </div>
    </div>
  );
}