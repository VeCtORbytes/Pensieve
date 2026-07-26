export default function Home() {
  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center p-6 overflow-hidden bg-gradient-to-br from-[#0b0f19] via-[#111827] to-[#090d16]">
      {/* Glow Orbs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 w-80 h-80 bg-purple-600/15 blur-[100px] rounded-full pointer-events-none" />

      <div className="relative z-10 max-w-3xl w-full text-center space-y-8 backdrop-blur-xl bg-white/[0.03] p-10 rounded-2xl border border-white/10 shadow-2xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold uppercase tracking-wider">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Skeleton Live & De-risked
        </div>

        <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-indigo-300 tracking-tight">
          NotebookLLM Studio
        </h1>

        <p className="text-gray-400 text-base md:text-lg leading-relaxed max-w-xl mx-auto">
          Grounded AI research assistant. Upload documents, query sources with precise citations, and synthesize insights seamlessly.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 text-left">
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
            <div className="text-indigo-400 text-xs font-medium uppercase">Prisma Schema</div>
            <div className="text-white text-sm font-semibold">Notebook & Sources</div>
            <div className="text-gray-500 text-xs">QUEUED → READY pipeline status defined</div>
          </div>
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
            <div className="text-purple-400 text-xs font-medium uppercase">Vector DB</div>
            <div className="text-white text-sm font-semibold">Qdrant Collection</div>
            <div className="text-gray-500 text-xs">notebook_chunks (1536 Cosine) initialized</div>
          </div>
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
            <div className="text-emerald-400 text-xs font-medium uppercase">Vercel Deploy</div>
            <div className="text-white text-sm font-semibold">Ready for Submissions</div>
            <div className="text-gray-500 text-xs">Deployment pipeline verified</div>
          </div>
        </div>

        <div className="pt-2 flex flex-wrap items-center justify-center gap-4">
          <button className="px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-all shadow-lg shadow-indigo-600/30">
            Create Notebook
          </button>
          <button className="px-6 py-3 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 font-medium text-sm border border-white/10 transition-all">
            View API Docs
          </button>
        </div>
      </div>
    </main>
  );
}
