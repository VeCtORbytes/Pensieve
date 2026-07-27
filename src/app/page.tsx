import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { Plus, BookOpen, Layers, Database, ArrowRight } from "lucide-react";
import { db } from "@/lib/db";
import { createNotebook } from "./actions/notebooks";
import AuthControls from "@/components/AuthControls";
import DeleteNotebookButton from "@/components/DeleteNotebookButton";
import PensieveLogo from "@/components/PensieveLogo";

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
    <main className="min-h-screen bg-vessel text-ink px-6 py-12">
      <div className="mx-auto max-w-5xl space-y-10">
        {/* Navigation Bar with Auth */}
        <div className="flex items-center justify-between pb-5 border-b border-rule">
          <div className="flex items-center gap-2.5">
            <PensieveLogo className="w-8 h-8" />
            <span className="font-serif-display text-2xl font-normal text-ink tracking-wide">
              Pensieve
            </span>
          </div>
          <AuthControls />
        </div>

        {/* Top Hero Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-8 gap-6 border-b border-rule">
          <div className="space-y-3">
            <h1 className="font-serif-display text-4xl sm:text-5xl font-normal tracking-tight text-ink">
              Notebooks
            </h1>

            <p className="text-xs text-neutral-500 max-w-lg leading-relaxed">
              Upload PDFs, articles, YouTube videos, and transcripts. Get
              answers grounded in exact page and timestamp citations.
            </p>

            {/* Metrics Pills */}
            <div className="flex items-center gap-4 pt-1 text-xs">
              <div className="flex items-center gap-1.5 text-ink bg-surface px-3 py-1.5 rounded-xl border border-rule shadow-xs">
                <Layers className="w-3.5 h-3.5 text-accent" />
                <span>
                  <span className="font-mono">{notebooks.length}</span> Notebooks
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-ink bg-surface px-3 py-1.5 rounded-xl border border-rule shadow-xs">
                <Database className="w-3.5 h-3.5 text-found" />
                <span>
                  <span className="font-mono">{totalSources}</span> Sources
                </span>
              </div>
            </div>
          </div>

          {/* New Notebook Form */}
          <form action={createNotebook} className="bg-surface p-5 rounded-2xl border border-rule shadow-md space-y-3.5 shrink-0 sm:w-80">
            <div className="text-xs font-semibold text-ink">
              New notebook
            </div>
            <input
              type="text"
              name="title"
              placeholder="e.g. Quantum Computing Research"
              className="w-full px-3.5 py-2.5 text-xs bg-vessel border border-rule rounded-xl outline-none focus:ring-2 focus:ring-accent focus:bg-surface text-ink placeholder:text-neutral-400 transition"
            />
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-ink hover:bg-accent py-2.5 text-xs font-semibold text-white shadow-sm transition cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Create notebook
            </button>
          </form>
        </div>

        {/* Notebook Grid */}
        {notebooks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-rule bg-surface p-16 text-center space-y-4 shadow-xs">
            <BookOpen className="mx-auto h-12 w-12 text-neutral-300" />
            <div>
              <p className="text-base font-semibold text-ink">No notebooks yet</p>
              <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto">
                Create a notebook above to add your first source.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {notebooks.map((n) => (
              <div
                key={n.id}
                className="group relative p-6 rounded-xl bg-surface border border-rule hover:border-accent shadow-xs hover:shadow-md transition-all duration-300 flex flex-col justify-between space-y-4"
              >
                <div className="space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      href={`/notebook/${n.id}`}
                      className="text-base font-semibold text-ink group-hover:text-accent transition truncate flex-1 hover:underline"
                    >
                      {n.title}
                    </Link>
                    <DeleteNotebookButton notebookId={n.id} />
                  </div>

                  <p className="text-[11px] font-mono text-neutral-400">
                    Updated {new Date(n.updatedAt).toLocaleDateString()}
                  </p>
                </div>

                <div className="pt-3 border-t border-rule flex items-center justify-between text-xs">
                  <span className="font-mono text-[11px] bg-vessel px-2.5 py-1 rounded-lg text-neutral-700 font-semibold border border-rule">
                    {n._count.sources} {n._count.sources === 1 ? "source" : "sources"}
                  </span>
                  <Link
                    href={`/notebook/${n.id}`}
                    className="text-accent font-semibold text-xs flex items-center gap-1 hover:underline cursor-pointer"
                  >
                    Open <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
