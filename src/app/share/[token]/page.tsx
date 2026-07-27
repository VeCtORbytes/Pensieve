import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import NotebookWorkspace from "@/components/NotebookWorkspace";
import PensieveLogo from "@/components/PensieveLogo";
import { Globe, Lock, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PublicSharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const notebook = await db.notebook.findUnique({
    where: { shareToken: token },
    include: {
      _count: { select: { sources: true } },
    },
  });

  if (!notebook || !notebook.isPublic) {
    return (
      <main className="min-h-screen bg-vessel text-ink flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-surface border border-rule rounded-3xl p-8 text-center space-y-5 shadow-xl">
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 inline-block">
            <Lock className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-serif-display font-medium text-ink">
              Private or Restricted Notebook
            </h1>
            <p className="text-xs text-neutral-500 leading-relaxed">
              This notebook is private or the share link has been disabled by the owner.
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-ink text-white rounded-xl text-xs font-semibold hover:bg-accent transition cursor-pointer"
          >
            <span>Go to Pensieve Home</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </main>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-vessel text-ink">
      {/* Public Banner Header */}
      <header className="flex items-center justify-between border-b border-rule bg-white/95 backdrop-blur-md px-6 py-3 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <PensieveLogo className="w-8 h-8" />
          <div className="flex items-center gap-2">
            <span className="font-serif-display text-xl font-medium text-ink">
              {notebook.title}
            </span>
            <span className="flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-[#1D9E75]/10 text-[#1D9E75] border border-[#1D9E75]/20">
              <Globe className="w-3 h-3" />
              Public Read-Only
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-neutral-400 font-mono hidden md:inline">
            Grounded in {notebook._count.sources} sources
          </span>
          <Link
            href="/"
            className="px-4 py-2 bg-ink text-white text-xs font-semibold rounded-xl hover:bg-accent transition cursor-pointer"
          >
            Create Your Notebook
          </Link>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 overflow-hidden">
        <NotebookWorkspace notebookId={notebook.id} sourceCount={notebook._count.sources} />
      </div>
    </div>
  );
}
