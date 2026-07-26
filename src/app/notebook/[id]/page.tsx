import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import NotebookHeader from "@/components/NotebookHeader";
import SourcePanel from "@/components/SourcePanel";
import ChatPanel from "@/components/ChatPanel";
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
    <div className="flex h-screen flex-col bg-[#F5F7F8] text-[#141A22]">
      <NotebookHeader id={notebook.id} title={notebook.title} />

      {!hasSources ? (
        <EmptyNotebook notebookId={notebook.id} />
      ) : (
        <div className="grid flex-1 grid-cols-[260px_1fr] overflow-hidden">
          {/* Quieter Reference Rail */}
          <aside className="border-r border-[#E2E7EA] overflow-hidden bg-[#F5F7F8]">
            <SourcePanel notebookId={notebook.id} />
          </aside>

          {/* Hero Conversation View */}
          <section className="flex flex-col overflow-hidden bg-white">
            <ChatPanel notebookId={notebook.id} />
          </section>
        </div>
      )}
    </div>
  );
}