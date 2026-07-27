"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Trash2, Search, Waypoints, Sparkles, GitFork } from "lucide-react";
import { renameNotebook, deleteNotebook } from "@/app/actions/notebooks";
import CommandPalette from "@/components/CommandPalette";
import SourceViewerModal from "@/components/SourceViewerModal";
import AuthControls from "@/components/AuthControls";
import IngestionPipelineVisualizer from "@/components/IngestionPipelineVisualizer";
import MindMapModal from "@/components/MindMapModal";

export default function NotebookHeader({
  id,
  title,
}: {
  id: string;
  title: string;
}) {
  const [value, setValue] = useState(title);
  const [isPending, startTransition] = useTransition();

  // Command Palette states
  const [isCmdPaletteOpen, setIsCmdPaletteOpen] = useState(false);
  const [selectedViewerSource, setSelectedViewerSource] = useState<any | null>(null);

  // Pipeline Visualizer state
  const [isVisualizerOpen, setIsVisualizerOpen] = useState(false);

  // Mind Map Modal state
  const [isMindMapOpen, setIsMindMapOpen] = useState(false);

  // Capture-phase so this fires even when focus is inside an input/textarea.
  useEffect(() => {
    function handleGlobalKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && (e.key.toLowerCase() === "k" || e.code === "KeyK")) {
        e.preventDefault();
        e.stopPropagation();
        setIsCmdPaletteOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handleGlobalKeyDown, true);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown, true);
  }, []);

  function save() {
    const clean = value.trim();
    if (!clean || clean === title) {
      setValue(title);
      return;
    }
    startTransition(() => renameNotebook(id, clean));
  }

  function remove() {
    if (!confirm("Delete this notebook and everything in it?")) return;
    startTransition(() => deleteNotebook(id));
  }

  return (
    <>
      <header className="flex items-center gap-2 border-b border-rule bg-white/90 backdrop-blur-md px-3 py-2.5 sm:gap-3 sm:px-6 sm:py-3 sticky top-0 z-30 text-ink">
        {/* Pensieve Logo & Brand Title Link to Home */}
        <Link
          href="/"
          aria-label="Pensieve Home"
          title="Back to all notebooks"
          className="flex items-center gap-2 shrink-0 rounded-xl px-2 py-1 hover:bg-vessel transition group cursor-pointer"
        >
          <div className="p-1.5 rounded-xl bg-accent/10 border border-accent/20 text-accent group-hover:bg-accent group-hover:text-white transition shadow-2xs">
            <Sparkles className="w-4 h-4 animate-pulse" />
          </div>
          <span className="font-serif-display text-lg font-normal text-ink group-hover:text-accent transition tracking-wide hidden sm:inline">
            Pensieve
          </span>
          <span className="text-neutral-300 font-light hidden sm:inline">/</span>
        </Link>

        {/* Back Arrow for Mobile View */}
        <Link
          href="/"
          aria-label="Back to home"
          className="sm:hidden shrink-0 rounded-xl p-1.5 text-neutral-400 hover:text-ink hover:bg-vessel transition"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>

        {/* Notebook Title Input */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-found shrink-0" />
          <input
            value={value}
            aria-label="Notebook title"
            onChange={(e) => setValue(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") {
                setValue(title);
                e.currentTarget.blur();
              }
            }}
            className="w-full max-w-[min(28ch,100%)] truncate rounded-lg border border-transparent bg-transparent px-2 py-1 font-serif-display text-lg font-normal text-ink outline-none transition hover:border-rule hover:bg-white focus:border-accent focus:bg-white sm:max-w-[40ch]"
          />
          {isPending && (
            <span className="hidden shrink-0 font-mono text-xs text-neutral-400 sm:inline">
              Saving…
            </span>
          )}
        </div>

        {/* Mind Map Modal Trigger */}
        <button
          type="button"
          onClick={() => setIsMindMapOpen(true)}
          aria-label="Open AI Knowledge Graph & Mind Map"
          className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-rule bg-white hover:bg-vessel px-3 py-1.5 text-xs font-semibold text-ink shadow-xs transition hover:border-accent"
        >
          <GitFork className="h-3.5 w-3.5 text-accent" />
          <span className="hidden md:inline">Mind Map</span>
        </button>

        {/* Pipeline Visualizer Trigger */}
        <button
          type="button"
          onClick={() => setIsVisualizerOpen(true)}
          aria-label="Open ingestion pipeline visualizer"
          className="hidden shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-rule bg-white px-3 py-1.5 text-xs font-semibold text-ink shadow-xs transition hover:border-accent md:flex"
        >
          <Waypoints className="h-3.5 w-3.5 text-accent" />
          <span className="hidden lg:inline">Pipeline</span>
        </button>

        {/* Command Palette Trigger */}
        <button
          type="button"
          onClick={() => setIsCmdPaletteOpen(true)}
          className="hidden shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-rule bg-white px-3 py-1.5 font-mono text-xs text-neutral-600 shadow-xs transition hover:border-accent md:flex"
        >
          <Search className="h-3.5 w-3.5 text-neutral-400" />
          <span>Search</span>
          <kbd className="rounded border border-rule bg-vessel px-1 text-[10px] text-neutral-700">⌘K</kbd>
        </button>

        {/* Delete Notebook Button */}
        <button
          type="button"
          onClick={remove}
          aria-label="Delete notebook"
          title="Delete notebook"
          className="shrink-0 cursor-pointer rounded-xl p-2 text-neutral-400 transition hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 className="h-4 w-4" />
        </button>

        {/* Auth Controls */}
        <AuthControls />
      </header>

      {/* Mind Map Modal */}
      {isMindMapOpen && (
        <MindMapModal notebookId={id} onClose={() => setIsMindMapOpen(false)} />
      )}

      {/* Pipeline Visualizer Modal */}
      {isVisualizerOpen && (
        <IngestionPipelineVisualizer onClose={() => setIsVisualizerOpen(false)} />
      )}

      {/* Command Palette Modal */}
      <CommandPalette
        notebookId={id}
        isOpen={isCmdPaletteOpen}
        onClose={() => setIsCmdPaletteOpen(false)}
        onSelectSource={(s) => setSelectedViewerSource(s)}
      />

      {/* Source Viewer Modal when source is selected from Command Palette */}
      {selectedViewerSource && (
        <SourceViewerModal
          source={{
            id: selectedViewerSource.id,
            title: selectedViewerSource.title,
            type: selectedViewerSource.type,
            url: selectedViewerSource.url,
            blobUrl: selectedViewerSource.blobUrl,
            rawText: selectedViewerSource.rawText,
            createdAt: selectedViewerSource.createdAt,
          }}
          notebookId={id}
          onClose={() => setSelectedViewerSource(null)}
        />
      )}
    </>
  );
}
