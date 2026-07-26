import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { createNotebook } from "./actions/notebooks";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const notebooks = await db.notebook.findMany({
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { sources: true } } },
  });

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium">Your notebooks</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Each notebook keeps its own isolated knowledge base.
          </p>
        </div>
        <form action={createNotebook}>
          <button className="flex items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700">
            <Plus className="h-4 w-4" />
            New notebook
          </button>
        </form>
      </div>

      {notebooks.length === 0 ? (
        <div className="mt-16 rounded-xl border border-dashed border-neutral-300 p-16 text-center">
          <FileText className="mx-auto h-8 w-8 text-neutral-300" />
          <p className="mt-4 text-sm text-neutral-500">
            No notebooks yet. Create one to add your first source.
          </p>
        </div>
      ) : (
        <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {notebooks.map((n) => (
            <li key={n.id}>
              <Link
                href={`/notebook/${n.id}`}
                className="block rounded-xl border border-neutral-200 p-5 transition hover:border-neutral-400"
              >
                <p className="truncate font-medium">{n.title}</p>
                <p className="mt-1 text-xs text-neutral-500">
                  {n._count.sources}{" "}
                  {n._count.sources === 1 ? "source" : "sources"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}