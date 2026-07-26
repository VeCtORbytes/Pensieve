import Link from "next/link";
import { Sparkles, Plus, BookOpen, Layers, Database, ArrowRight } from "lucide-react";
import { db } from "@/lib/db";
import { createNotebook } from "./actions/notebooks";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const notebooks = await db.notebook.findMany({
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { sources: true } } },
  });

  const totalSources = notebooks.reduce((sum, n) => sum + n._count.sources, 0);

  return (
    <main className="min-h-screen bg-[#F5F7F8] bg-mesh text-[#141A22] px-6 py-12">
      <div className="mx-auto max-w-5xl space-y-10">
        {/* Top Hero Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-[#E2E7EA] pb-8 gap-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-[#E2E7EA] shadow-2xs">
              <Sparkles className="w-3.5 h-3.5 text-[#3B4CC0] animate-pulse" />
              <span className="text-[11px] font-semibold text-[#141A22]">
                Precision Grounded RAG Vessel
              </span>
            </div>

            <h1 className="font-serif-display text-4xl sm:text-5xl font-normal tracking-tight text-[#141A22]">
              Pensieve Memory Vessels
            </h1>

            <p className="text-xs text-neutral-500 max-w-lg leading-relaxed">
              Pour PDFs, articles, YouTube videos, and transcripts into isolated vector knowledge vessels.
              Retrieve precision answers with exact page and timestamp locators.
            </p>

            {/* Metrics Pills */}
            <div className="flex items-center gap-4 pt-1 text-xs font-mono">
              <div className="flex items-center gap-1.5 text-neutral-600 bg-white/80 px-2.5 py-1 rounded-lg border border-[#E2E7EA]">
                <Layers className="w-3.5 h-3.5 text-[#3B4CC0]" />
                <span>{notebooks.length} Vessels</span>
              </div>
              <div className="flex items-center gap-1.5 text-neutral-600 bg-white/80 px-2.5 py-1 rounded-lg border border-[#E2E7EA]">
                <Database className="w-3.5 h-3.5 text-[#1D9E75]" />
                <span>{totalSources} Ingested Sources</span>
              </div>
            </div>
          </div>

          {/* New Notebook Form */}
          <form action={createNotebook} className="bg-white p-4 rounded-2xl border border-[#E2E7EA] shadow-md space-y-3 shrink-0 sm:w-80">
            <div className="text-xs font-semibold text-[#141A22]">Create New Vessel</div>
            <input
              type="text"
              name="title"
              placeholder="e.g. Quantum Computing Research"
              className="w-full px-3.5 py-2.5 text-xs bg-[#F5F7F8] border border-[#E2E7EA] rounded-xl outline-none focus:ring-2 focus:ring-[#3B4CC0] focus:bg-white transition"
            />
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#141A22] hover:bg-[#3B4CC0] py-2.5 text-xs font-semibold text-white shadow-sm transition cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Initialize Vessel
            </button>
          </form>
        </div>

        {/* Notebook Grid */}
        {notebooks.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[#E2E7EA] bg-white/80 p-16 text-center space-y-4 shadow-xs backdrop-blur-xs">
            <BookOpen className="mx-auto h-12 w-12 text-neutral-300 animate-float" />
            <div>
              <p className="text-base font-serif-display text-[#141A22]">No memory vessels created yet</p>
              <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto">
                Create a new vessel above to ingest your first research paper, website, or video source.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {notebooks.map((n) => (
              <Link
                key={n.id}
                href={`/notebook/${n.id}`}
                className="group relative p-6 rounded-2xl bg-white border border-[#E2E7EA] hover:border-[#3B4CC0] shadow-xs hover:shadow-xl transition-all duration-300 block space-y-4 overflow-hidden"
              >
                {/* Accent Corner Line */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#3B4CC0] to-transparent opacity-0 group-hover:opacity-100 transition duration-300" />

                <div className="space-y-1">
                  <h2 className="font-serif-display text-xl font-normal text-[#141A22] group-hover:text-[#3B4CC0] transition truncate">
                    {n.title}
                  </h2>
                  <p className="text-[11px] font-mono text-neutral-400">
                    Updated {new Date(n.updatedAt).toLocaleDateString()}
                  </p>
                </div>

                <div className="pt-3 border-t border-[#E2E7EA]/60 flex items-center justify-between text-xs">
                  <span className="font-mono text-[11px] bg-[#F5F7F8] px-2.5 py-1 rounded-lg text-neutral-700 font-semibold border border-[#E2E7EA]/40">
                    {n._count.sources} {n._count.sources === 1 ? "source" : "sources"}
                  </span>
                  <span className="text-[#3B4CC0] font-semibold text-xs flex items-center gap-1 opacity-0 group-hover:opacity-100 transition transform translate-x-1 group-hover:translate-x-0">
                    Open Vessel <ArrowRight className="w-3.5 h-3.5" />
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