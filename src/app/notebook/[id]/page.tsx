import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import NotebookHeader from "@/components/NotebookHeader";

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
    <div className="flex h-screen flex-col">
      <NotebookHeader id={notebook.id} title={notebook.title} />

      <div className="grid flex-1 grid-cols-[300px_1fr] overflow-hidden">
        <aside className="overflow-y-auto border-r border-neutral-200 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Sources
          </p>
          <p className="mt-6 text-sm text-neutral-400">
            Source panel arrives in P2.
          </p>
        </aside>

        <section className="flex items-center justify-center">
          <p className="text-sm text-neutral-400">Chat arrives in P4.</p>
        </section>
      </div>
    </div>
  );
}