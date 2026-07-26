import Link from "next/link";
import { Sparkles, Plus, BookOpen } from "lucide-react";
import { db } from "@/lib/db";
import { createNotebook } from "./actions/notebooks";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const notebooks = await db.notebook.findMany({
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { sources: true } } },
  });

  return (
    <main className="min-h-screen bg-[#F5F7F8] text-[#141A22] px-6 py-12">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="flex items-center justify-between border-b border-[#E2E7EA] pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#3B4CC0]" />
              <h1 className="font-serif-display text-3xl font-normal tracking-tight text-[#141A22]">
                Pensieve Memory Vessels
              </h1>
            </div>
            <p className="text-xs text-neutral-500">
              Each notebook maintains an isolated vector knowledge base with exact citation locators.
            </p>
          </div>

          <form action={createNotebook}>
            <button
              type="submit"
              className="flex items-center gap-2 rounded-xl bg-[#141A22] hover:bg-[#3B4CC0] px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              New Notebook
            </button>
          </form>
        </div>

        {notebooks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#E2E7EA] bg-white p-16 text-center space-y-4">
            <BookOpen className="mx-auto h-10 w-10 text-neutral-300" />
            <div>
              <p className="text-sm font-medium text-[#141A22]">No notebooks created yet.</p>
              <p className="text-xs text-neutral-400 mt-1">
                Create a new notebook vessel to ingest your first PDF, website, or video source.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {notebooks.map((n) => (
              <Link
                key={n.id}
                href={`/notebook/${n.id}`}
                className="group p-5 rounded-2xl bg-white border border-[#E2E7EA] hover:border-[#3B4CC0] shadow-2xs hover:shadow-md transition duration-200 block space-y-3"
              >
                <div className="space-y-1">
                  <h2 className="font-serif-display text-lg font-normal text-[#141A22] group-hover:text-[#3B4CC0] transition truncate">
                    {n.title}
                  </h2>
                  <p className="text-[11px] font-mono text-neutral-400">
                    Updated {new Date(n.updatedAt).toLocaleDateString()}
                  </p>
                </div>

                <div className="pt-2 border-t border-[#E2E7EA]/60 flex items-center justify-between text-xs text-neutral-500">
                  <span className="font-mono text-[11px] bg-[#F5F7F8] px-2 py-0.5 rounded text-neutral-600 font-semibold">
                    {n._count.sources} {n._count.sources === 1 ? "source" : "sources"}
                  </span>
                  <span className="text-[#3B4CC0] font-medium text-[11px] opacity-0 group-hover:opacity-100 transition">
                    Open →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}