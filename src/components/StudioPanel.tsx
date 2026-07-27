"use client";

import { useState } from "react";
import { Volume2, Layers, Loader2, GitFork } from "lucide-react";
import AudioPlayer from "@/components/AudioPlayer";
import StudyToolsModal from "@/components/StudyToolsModal";
import MindMapModal from "@/components/MindMapModal";

/**
 * Persistent home for generated notebook outputs (Audio Overview, Study Tools,
 * AI Mind Map & Knowledge Graph).
 */
export default function StudioPanel({ notebookId }: { notebookId: string }) {
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [audioData, setAudioData] = useState<{ audioUrl: string; scriptText: string } | null>(null);
  const [studyToolsOpen, setStudyToolsOpen] = useState(false);
  const [mindMapOpen, setMindMapOpen] = useState(false);

  async function handleGenerateAudioOverview() {
    try {
      setIsGeneratingAudio(true);
      const res = await fetch("/api/audio-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notebookId }),
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
    <div className="flex h-full flex-col bg-vessel text-ink">
      <div className="flex items-center px-4 py-3 border-b border-rule">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
          Studio
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {/* Audio Overview entry */}
        <div className="rounded-xl bg-surface border border-rule shadow-xs overflow-hidden">
          {audioData ? (
            <div className="p-4">
              <AudioPlayer
                audioUrl={audioData.audioUrl}
                scriptText={audioData.scriptText}
                onClose={() => setAudioData(null)}
              />
            </div>
          ) : (
            <div className="p-4 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <Volume2 className="h-4 w-4 shrink-0 text-secondary" />
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-ink">Audio Overview</p>
                  <p className="text-[11px] text-neutral-400">Podcast synthesis</p>
                </div>
              </div>
              <button
                type="button"
                disabled={isGeneratingAudio}
                onClick={handleGenerateAudioOverview}
                className="flex shrink-0 items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-accent disabled:opacity-50 cursor-pointer"
              >
                {isGeneratingAudio ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  "Generate"
                )}
              </button>
            </div>
          )}
        </div>

        {/* Study Tools entry */}
        <div className="rounded-xl bg-surface border border-rule shadow-xs overflow-hidden">
          {studyToolsOpen ? (
            <div className="p-4">
              <StudyToolsModal
                notebookId={notebookId}
                onClose={() => setStudyToolsOpen(false)}
              />
            </div>
          ) : (
            <div className="p-4 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <Layers className="h-4 w-4 shrink-0 text-accent" />
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-ink">Study Tools</p>
                  <p className="text-[11px] text-neutral-400">Flashcards & Quizzes</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStudyToolsOpen(true)}
                className="shrink-0 rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-accent cursor-pointer"
              >
                Generate
              </button>
            </div>
          )}
        </div>

        {/* AI Mind Map & Knowledge Graph entry */}
        <div className="rounded-xl bg-surface border border-rule shadow-xs overflow-hidden">
          <div className="p-4 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <GitFork className="h-4 w-4 shrink-0 text-accent animate-pulse" />
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-ink">Mind Map & Graph</p>
                <p className="text-[11px] text-neutral-400">Mermaid.js diagram</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMindMapOpen(true)}
              className="shrink-0 rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-accent cursor-pointer"
            >
              Generate
            </button>
          </div>
        </div>
      </div>

      {/* Mind Map Modal Launcher */}
      {mindMapOpen && (
        <MindMapModal
          notebookId={notebookId}
          onClose={() => setMindMapOpen(false)}
        />
      )}
    </div>
  );
}
