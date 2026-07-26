"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Trash2, Volume2, Search, Loader2 } from "lucide-react";
import { renameNotebook, deleteNotebook } from "@/app/actions/notebooks";
import AudioPlayer from "@/components/AudioPlayer";
import CommandPalette from "@/components/CommandPalette";
import SourceViewerModal from "@/components/SourceViewerModal";
import AuthControls from "@/components/AuthControls";

export default function NotebookHeader({
  id,
  title,
}: {
  id: string;
  title: string;
}) {
  const [value, setValue] = useState(title);
  const [isPending, startTransition] = useTransition();

  // Audio Summary states
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [audioData, setAudioData] = useState<{ audioUrl: string; scriptText: string } | null>(null);

  // Command Palette states
  const [isCmdPaletteOpen, setIsCmdPaletteOpen] = useState(false);
  const [selectedViewerSource, setSelectedViewerSource] = useState<any | null>(null);

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

  async function handleGenerateAudioOverview() {
    try {
      setIsGeneratingAudio(true);
      const res = await fetch("/api/audio-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notebookId: id }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Failed to generate audio overview");
        return;
      }

      const data = await res.json();
      setAudioData({ audioUrl: data.audioUrl, scriptText: data.scriptText });
    } catch (err: any) {
      alert("Audio generation error: " + (err.message || "Failed"));
    } finally {
      setIsGeneratingAudio(false);
    }
  }

  return (
    <>
      <header className="flex items-center gap-2 border-b border-[#E2E7EA] bg-white/80 backdrop-blur-md px-3 py-2.5 sm:gap-3 sm:px-6 sm:py-3 sticky top-0 z-30 shadow-2xs">
        <Link
          href="/"
          aria-label="Back to all notebooks"
          className="shrink-0 rounded-xl p-2 text-neutral-400 hover:text-[#141A22] hover:bg-[#F5F7F8] transition"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#1D9E75] shrink-0" />
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
            className="w-full max-w-[min(28ch,100%)] truncate rounded-lg border border-transparent bg-transparent px-2 py-1 font-serif-display text-lg font-normal text-[#141A22] outline-none transition hover:border-[#E2E7EA] hover:bg-white focus:border-[#3B4CC0] focus:bg-white sm:max-w-[40ch]"
          />
          {isPending && (
            <span className="hidden shrink-0 font-mono text-xs text-neutral-400 sm:inline">
              Saving…
            </span>
          )}
        </div>

        {/* Command Palette Trigger */}
        <button
          type="button"
          onClick={() => setIsCmdPaletteOpen(true)}
          className="hidden shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-[#E2E7EA] bg-white px-3 py-1.5 font-mono text-xs text-neutral-500 shadow-2xs transition hover:border-[#3B4CC0] md:flex"
        >
          <Search className="h-3.5 w-3.5 text-neutral-400" />
          <span>Search</span>
          <kbd className="rounded border border-[#E2E7EA] bg-[#F5F7F8] px-1 text-[10px]">⌘K</kbd>
        </button>

        {/* Audio Overview Button */}
        <button
          type="button"
          disabled={isGeneratingAudio}
          onClick={handleGenerateAudioOverview}
          aria-label="Generate audio overview"
          className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl bg-[#141A22] px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-[#3B4CC0] disabled:opacity-50"
        >
          {isGeneratingAudio ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span className="hidden sm:inline">Generating Audio...</span>
            </>
          ) : (
            <>
              <Volume2 className="h-3.5 w-3.5 text-amber-300 animate-pulse" />
              <span className="hidden sm:inline">Audio Overview</span>
            </>
          )}
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

      {/* Floating Audio Player */}
      {audioData && (
        <AudioPlayer
          audioUrl={audioData.audioUrl}
          scriptText={audioData.scriptText}
          onClose={() => setAudioData(null)}
        />
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