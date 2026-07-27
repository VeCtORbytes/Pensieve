"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Trash2, Search, Waypoints, Share2 } from "lucide-react";
import { renameNotebook, deleteNotebook } from "@/app/actions/notebooks";
import CommandPalette from "@/components/CommandPalette";
import SourceViewerModal from "@/components/SourceViewerModal";
import AuthControls from "@/components/AuthControls";
import IngestionPipelineVisualizer from "@/components/IngestionPipelineVisualizer";
import ShareNotebookModal from "@/components/ShareNotebookModal";
import PensieveLogo from "@/components/PensieveLogo";
import SocialLinks from "@/components/SocialLinks";
import CartoonGuideTour from "@/components/CartoonGuideTour";
import ThemeToggle from "@/components/ThemeToggle";

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

  // Share Modal state
  const [isShareOpen, setIsShareOpen] = useState(false);

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
      <header className="flex items-center gap-3 border-b border-rule bg-white/95 dark:bg-[#0F172A]/95 backdrop-blur-md px-4 py-3 sm:gap-4 sm:px-8 sm:py-3.5 sticky top-0 z-30 text-ink">
        {/* Pensieve Logo & Brand Title Link to Home */}
        <Link
          href="/"
          aria-label="Pensieve Home"
          title="Back to all notebooks"
          className="flex items-center gap-2.5 shrink-0 rounded-2xl px-2 py-1 hover:bg-vessel transition group cursor-pointer"
        >
          <PensieveLogo className="w-9 h-9 sm:w-10 sm:h-10 group-hover:scale-105 transition-transform" />
          <span className="font-serif-display text-xl sm:text-2xl font-medium text-ink group-hover:text-accent transition tracking-wide hidden sm:inline">
            Pensieve
          </span>
          <span className="text-neutral-300 dark:text-neutral-600 font-light hidden sm:inline text-xl">/</span>
        </Link>

        {/* Back Arrow for Mobile View */}
        <Link
          href="/"
          aria-label="Back to home"
          className="sm:hidden shrink-0 rounded-xl p-2 text-neutral-400 hover:text-ink hover:bg-vessel transition"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>

        {/* Notebook Title Input */}
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-found shrink-0" />
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
            className="w-full max-w-[min(30ch,100%)] truncate rounded-xl border border-transparent bg-transparent px-2.5 py-1 font-serif-display text-xl sm:text-2xl font-medium text-ink outline-none transition hover:border-rule hover:bg-white dark:hover:bg-[#1E293B] focus:border-accent focus:bg-white dark:focus:bg-[#1E293B] sm:max-w-[42ch]"
          />
          {isPending && (
            <span className="hidden shrink-0 font-mono text-xs text-neutral-400 sm:inline">
              Saving…
            </span>
          )}
        </div>

        {/* Social Links */}
        <SocialLinks className="hidden xl:flex" />

        {/* Theme Switcher Toggle */}
        <ThemeToggle />

        {/* Share Button */}
        <button
          type="button"
          onClick={() => setIsShareOpen(true)}
          aria-label="Share notebook link"
          className="flex shrink-0 cursor-pointer items-center gap-2 rounded-xl border border-rule bg-white dark:bg-[#1E293B] hover:bg-vessel dark:hover:bg-[#334155] px-3.5 py-2 text-xs font-semibold text-ink shadow-xs transition hover:border-accent"
        >
          <Share2 className="h-4 w-4 text-accent" />
          <span className="hidden md:inline">Share</span>
        </button>

        {/* Pipeline Visualizer Trigger */}
        <button
          type="button"
          onClick={() => setIsVisualizerOpen(true)}
          aria-label="Open ingestion pipeline visualizer"
          className="hidden shrink-0 cursor-pointer items-center gap-2 rounded-xl border border-rule bg-white dark:bg-[#1E293B] px-3.5 py-2 text-xs font-semibold text-ink shadow-xs transition hover:border-accent md:flex"
        >
          <Waypoints className="h-4 w-4 text-accent" />
          <span className="hidden lg:inline">Pipeline</span>
        </button>

        {/* Command Palette Trigger */}
        <button
          type="button"
          onClick={() => setIsCmdPaletteOpen(true)}
          className="hidden shrink-0 cursor-pointer items-center gap-2 rounded-xl border border-rule bg-white dark:bg-[#1E293B] px-3.5 py-2 font-mono text-xs text-neutral-600 dark:text-neutral-300 shadow-xs transition hover:border-accent md:flex"
        >
          <Search className="h-4 w-4 text-neutral-400" />
          <span>Search</span>
          <kbd className="rounded border border-rule bg-vessel dark:bg-[#0F172A] px-1.5 py-0.5 text-[11px] font-semibold text-neutral-700 dark:text-neutral-300">⌘K</kbd>
        </button>

        {/* Delete Notebook Button */}
        <button
          type="button"
          onClick={remove}
          aria-label="Delete notebook"
          title="Delete notebook"
          className="shrink-0 cursor-pointer rounded-xl p-2.5 text-neutral-400 transition hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-600"
        >
          <Trash2 className="h-5 w-5" />
        </button>

        {/* Auth Controls */}
        <AuthControls />
      </header>

      {/* Cartoon Speech Bubble Tour for Notebook Workspace */}
      <CartoonGuideTour page="notebook" />

      {/* Share Notebook Modal */}
      {isShareOpen && (
        <ShareNotebookModal notebookId={id} onClose={() => setIsShareOpen(false)} />
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
