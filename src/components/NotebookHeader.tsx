"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Trash2, Volume2, Search, Loader2, Sparkles } from "lucide-react";
import { renameNotebook, deleteNotebook } from "@/app/actions/notebooks";
import AudioPlayer from "@/components/AudioPlayer";
import CommandPalette from "@/components/CommandPalette";
import SourceViewerModal from "@/components/SourceViewerModal";

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
      <header className="flex items-center gap-3 border-b border-[#E2E7EA] px-5 py-3 bg-[#F5F7F8]">
        <Link href="/" className="text-neutral-400 hover:text-[#141A22] transition">
          <ArrowLeft className="h-4 w-4" />
        </Link>

        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          className="flex-1 rounded px-2 py-1 text-base font-serif-display font-normal text-[#141A22] outline-none hover:bg-white/60 focus:bg-white border border-transparent focus:border-[#E2E7EA] transition"
        />

        {isPending && <span className="text-xs font-mono text-neutral-400">Saving…</span>}

        {/* Command Palette Trigger */}
        <button
          type="button"
          onClick={() => setIsCmdPaletteOpen(true)}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#E2E7EA] hover:border-[#3B4CC0] rounded-xl text-xs font-mono text-neutral-500 transition cursor-pointer shadow-2xs"
        >
          <Search className="w-3.5 h-3.5 text-neutral-400" />
          <span>Search</span>
          <kbd className="bg-[#F5F7F8] border border-[#E2E7EA] px-1 rounded text-[10px]">⌘K</kbd>
        </button>

        {/* Audio Overview Button */}
        <button
          type="button"
          disabled={isGeneratingAudio}
          onClick={handleGenerateAudioOverview}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#141A22] hover:bg-[#3B4CC0] text-white rounded-xl text-xs font-semibold transition cursor-pointer disabled:opacity-50 shadow-xs"
        >
          {isGeneratingAudio ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Generating Audio...</span>
            </>
          ) : (
            <>
              <Volume2 className="w-3.5 h-3.5 text-amber-300" />
              <span>Audio Overview</span>
            </>
          )}
        </button>

        {/* Delete Notebook Button */}
        <button
          type="button"
          onClick={remove}
          aria-label="Delete notebook"
          className="text-neutral-400 hover:text-red-600 transition cursor-pointer p-1.5 rounded-lg hover:bg-red-50"
        >
          <Trash2 className="h-4 w-4" />
        </button>
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
          onClose={() => setSelectedViewerSource(null)}
        />
      )}
    </>
  );
}