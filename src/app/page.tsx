import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { Plus, BookOpen, Layers, Database, ArrowRight } from "lucide-react";
import { db } from "@/lib/db";
import { createNotebook } from "./actions/notebooks";
import AuthControls from "@/components/AuthControls";
import DeleteNotebookButton from "@/components/DeleteNotebookButton";
import PensieveLogo from "@/components/PensieveLogo";
import SocialLinks from "@/components/SocialLinks";
import CartoonGuideTour from "@/components/CartoonGuideTour";
import ThemeToggle from "@/components/ThemeToggle";

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
    <main className="min-h-screen bg-vessel text-ink px-6 py-12 flex flex-col justify-between relative transition-colors duration-200">
      <div className="mx-auto max-w-5xl space-y-10 w-full">
        {/* Navigation Bar with Auth, Social Links & Theme Switcher */}
        <div className="flex items-center justify-between pb-5 border-b border-rule">
          <div className="flex items-center gap-2.5">
            <PensieveLogo className="w-8 h-8" />
            <span className="font-serif-display text-2xl font-normal text-ink tracking-wide">
              Pensieve
            </span>
          </div>

          <div className="flex items-center gap-3">
            <SocialLinks />
            <ThemeToggle />
            <AuthControls />
          </div>
        </div>

        {/* Top Hero Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-8 gap-6 border-b border-rule">
          <div className="space-y-3">
            <h1 className="font-serif-display text-4xl sm:text-5xl font-normal tracking-tight text-ink">
              Notebooks
            </h1>
            <p className="text-neutral-500 text-sm max-w-md leading-relaxed">
              Synthesize, query, and transform research documents into grounded intelligence.
            </p>
          </div>

          {/* Quick Metrics Bar */}
          <div className="flex items-center gap-6 p-4 rounded-2xl bg-white dark:bg-[#1E293B] border border-rule shadow-2xs">
            <div className="space-y-0.5">
              <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block">
                Notebooks
              </span>
              <span className="font-mono text-xl font-bold text-ink">
                {notebooks.length}
              </span>
            </div>
            <div className="w-px h-8 bg-rule" />
            <div className="space-y-0.5">
              <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block">
                Total Sources
              </span>
              <span className="font-mono text-xl font-bold text-accent">
                {totalSources}
              </span>
            </div>
          </div>
        </div>

        {/* New Notebook Creator */}
        <form
          action={createNotebook}
          className="flex items-center gap-3 p-2 bg-white dark:bg-[#1E293B] rounded-2xl border border-rule focus-within:border-accent focus-within:ring-1 focus-within:ring-accent transition shadow-xs max-w-xl"
        >
          <input
            type="text"
            name="title"
            placeholder="Name your new research notebook..."
            required
            className="flex-1 bg-transparent px-3 py-2 text-xs text-ink placeholder:text-neutral-400 outline-none"
          />
          <button
            type="submit"
            className="px-4 py-2.5 rounded-xl bg-ink text-white hover:bg-accent font-semibold text-xs transition cursor-pointer flex items-center gap-2 shrink-0 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Create Notebook</span>
          </button>
        </form>

        {/* Notebooks List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-neutral-500">
            <span className="font-semibold uppercase tracking-wider text-[10px]">
              Recent Workspace Notebooks ({notebooks.length})
            </span>
          </div>

          {notebooks.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-[#1E293B] rounded-3xl border border-rule space-y-3">
              <BookOpen className="w-8 h-8 text-neutral-300 mx-auto" />
              <p className="text-xs text-neutral-500 font-medium">No notebooks created yet.</p>
              <p className="text-[11px] text-neutral-400">
                Type a title above to start your first grounded AI research notebook.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {notebooks.map((nb) => (
                <div
                  key={nb.id}
                  className="p-5 rounded-2xl bg-white dark:bg-[#1E293B] border border-rule hover:border-accent transition group flex flex-col justify-between space-y-4 shadow-2xs"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/notebook/${nb.id}`}
                        className="font-serif-display text-lg font-medium text-ink group-hover:text-accent transition line-clamp-1 flex-1"
                      >
                        {nb.title}
                      </Link>
                      <DeleteNotebookButton notebookId={nb.id} />
                    </div>
                    <p className="text-[11px] text-neutral-400 font-mono">
                      Updated {new Date(nb.updatedAt).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-rule text-xs">
                    <div className="flex items-center gap-1.5 text-neutral-500 text-[11px] font-medium">
                      <Layers className="w-3.5 h-3.5 text-accent" />
                      <span>{nb._count.sources} Sources</span>
                    </div>

                    <Link
                      href={`/notebook/${nb.id}`}
                      className="flex items-center gap-1 text-[11px] font-semibold text-accent group-hover:translate-x-0.5 transition-transform"
                    >
                      <span>Open</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="mx-auto max-w-5xl w-full pt-12 border-t border-rule mt-12 flex flex-col sm:flex-row items-center justify-between text-xs text-neutral-400 gap-4">
        <span>© {new Date().getFullYear()} Pensieve AI · Grounded Multilingual Research Workspace</span>
        <div className="flex items-center gap-4 text-[11px]">
          <span>OpenAI RAG + Qdrant</span>
          <span>·</span>
          <span>Next.js App Router</span>
        </div>
      </footer>

      {/* Cartoon Speech Bubble Tour for Homepage */}
      <CartoonGuideTour page="home" />
    </main>
  );
}
