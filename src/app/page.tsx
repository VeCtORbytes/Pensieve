import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { Sparkles, Plus, BookOpen, Layers, Database, ArrowRight, Wand2 } from "lucide-react";
import { db } from "@/lib/db";
import { createNotebook } from "./actions/notebooks";
import AuthControls from "@/components/AuthControls";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { userId } = await auth();

  const notebooks = await db.notebook.findMany({
    where: userId
      ? { OR: [{ userId }, { userId: null }] }
      : { userId: null },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { sources: true } } },
  });

  const totalSources = notebooks.reduce((sum, n) => sum + n._count.sources, 0);

  return (
    <main className="min-h-screen bg-[#090D14] bg-mesh text-[#E6EDF3] px-6 py-12">
      <div className="mx-auto max-w-5xl space-y-10">
        {/* Navigation Bar with Auth */}
        <div className="flex items-center justify-between pb-5 border-b border-[#222B3D]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#8B5CF6]/10 border border-[#8B5CF6]/30 text-[#8B5CF6]">
              <Wand2 className="w-5 h-5 animate-pulse" />
            </div>
            <span className="font-serif-display text-2xl font-normal text-[#E6EDF3] tracking-wide">
              Pensieve
            </span>
          </div>
          <AuthControls />
        </div>

        {/* Top Hero Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-8 gap-6 border-b border-[#222B3D]">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#111622] border border-[#8B5CF6]/30 shadow-2xs">
              <Sparkles className="w-3.5 h-3.5 text-[#38BDF8] animate-pulse" />
              <span className="text-[11px] font-semibold text-[#E6EDF3]">
                Arcane Grounded Memory Basin
              </span>
            </div>

            <h1 className="font-serif-display text-4xl sm:text-5xl font-normal tracking-tight text-[#E6EDF3]">
              Pensieve Memory Vessels
            </h1>

            <p className="text-xs text-[#8B949E] max-w-lg leading-relaxed">
              Pour PDFs, research articles, YouTube videos, and transcripts into isolated vector knowledge basins.
              Retrieve precision answers grounded in exact page and timestamp locators.
            </p>

            {/* Metrics Pills */}
            <div className="flex items-center gap-4 pt-1 text-xs font-mono">
              <div className="flex items-center gap-1.5 text-[#E6EDF3] bg-[#111622] px-3 py-1.5 rounded-xl border border-[#222B3D]">
                <Layers className="w-3.5 h-3.5 text-[#8B5CF6]" />
                <span>{notebooks.length} Vessels</span>
              </div>
              <div className="flex items-center gap-1.5 text-[#E6EDF3] bg-[#111622] px-3 py-1.5 rounded-xl border border-[#222B3D]">
                <Database className="w-3.5 h-3.5 text-[#10B981]" />
                <span>{totalSources} Ingested Sources</span>
              </div>
            </div>
          </div>

          {/* New Notebook Form */}
          <form action={createNotebook} className="bg-[#111622] p-5 rounded-2xl border border-[#222B3D] shadow-xl space-y-3.5 shrink-0 sm:w-80">
            <div className="text-xs font-semibold text-[#E6EDF3] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#8B5CF6]" />
              Initialize New Vessel
            </div>
            <input
              type="text"
              name="title"
              placeholder="e.g. Quantum Entanglement Memory"
              className="w-full px-3.5 py-2.5 text-xs bg-[#090D14] border border-[#222B3D] rounded-xl outline-none focus:ring-2 focus:ring-[#8B5CF6] focus:border-transparent text-[#E6EDF3] placeholder:text-[#8B949E]/60 transition"
            />
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#8B5CF6] hover:bg-[#7C3AED] py-2.5 text-xs font-semibold text-white shadow-md transition cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Conjure Vessel
            </button>
          </form>
        </div>

        {/* Notebook Grid */}
        {notebooks.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[#222B3D] bg-[#111622]/60 p-16 text-center space-y-4 shadow-xs backdrop-blur-xs">
            <BookOpen className="mx-auto h-12 w-12 text-[#8B949E]/40 animate-float" />
            <div>
              <p className="text-base font-serif-display text-[#E6EDF3]">No memory vessels created yet</p>
              <p className="text-xs text-[#8B949E] mt-1 max-w-sm mx-auto">
                Create a new vessel above to pour in your first research paper, website, or video source.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {notebooks.map((n) => (
              <Link
                key={n.id}
                href={`/notebook/${n.id}`}
                className="group relative p-6 rounded-2xl bg-[#111622] border border-[#222B3D] hover:border-[#8B5CF6]/60 shadow-xs hover:shadow-2xl hover:shadow-[#8B5CF6]/10 transition-all duration-300 block space-y-4 overflow-hidden"
              >
                {/* Glowing Accent Top Line */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#8B5CF6] to-[#38BDF8] opacity-0 group-hover:opacity-100 transition duration-300" />

                <div className="space-y-1">
                  <h2 className="font-serif-display text-xl font-normal text-[#E6EDF3] group-hover:text-[#38BDF8] transition truncate">
                    {n.title}
                  </h2>
                  <p className="text-[11px] font-mono text-[#8B949E]">
                    Updated {new Date(n.updatedAt).toLocaleDateString()}
                  </p>
                </div>

                <div className="pt-3 border-t border-[#222B3D] flex items-center justify-between text-xs">
                  <span className="font-mono text-[11px] bg-[#090D14] px-2.5 py-1 rounded-lg text-[#8B949E] font-semibold border border-[#222B3D]">
                    {n._count.sources} {n._count.sources === 1 ? "source" : "sources"}
                  </span>
                  <span className="text-[#8B5CF6] font-semibold text-xs flex items-center gap-1 opacity-0 group-hover:opacity-100 transition transform translate-x-1 group-hover:translate-x-0">
                    Open Basin <ArrowRight className="w-3.5 h-3.5" />
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