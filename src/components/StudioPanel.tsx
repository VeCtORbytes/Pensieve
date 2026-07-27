"use client";

import { useState } from "react";
import { Volume2, Layers, Loader2, GitFork, FileText, StickyNote, Sparkles, ArrowRight } from "lucide-react";
import StudyToolsModal from "@/components/StudyToolsModal";
import MindMapModal from "@/components/MindMapModal";
import BriefingModal from "@/components/BriefingModal";
import NotesModal from "@/components/NotesModal";
import AudioOverviewModal from "@/components/AudioOverviewModal";

/**
 * Publication-Grade Studio Panel for Notebook Transformations & Artifacts.
 */
export default function StudioPanel({ notebookId }: { notebookId: string }) {
  const [audioOverviewOpen, setAudioOverviewOpen] = useState(false);
  const [studyToolsOpen, setStudyToolsOpen] = useState(false);
  const [mindMapOpen, setMindMapOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);

  // Executive Briefing & Study Guide states
  const [loadingFormat, setLoadingFormat] = useState<"briefing" | "study-guide" | null>(null);
  const [briefingData, setBriefingData] = useState<{ title: string; markdown: string } | null>(null);

  async function handleGenerateBriefing(format: "briefing" | "study-guide") {
    try {
      setLoadingFormat(format);
      const res = await fetch("/api/export-briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notebookId, format }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Failed to generate document");
        return;
      }

      const data = await res.json();
      setBriefingData({ title: data.title, markdown: data.markdown });
    } catch (err: any) {
      alert("Error generating briefing: " + (err.message || "Failed"));
    } finally {
      setLoadingFormat(null);
    }
  }

  return (
    <div className="flex h-full flex-col bg-white border-l border-rule min-w-0 overflow-hidden select-none">
      {/* Studio Header matching left Sources panel height */}
      <div className="flex items-center justify-between border-b border-rule px-4 py-3.5 bg-vessel shrink-0">
        <div className="flex items-center gap-2 font-semibold text-xs text-ink truncate">
          <Sparkles className="w-4 h-4 text-accent shrink-0" />
          <span className="truncate">Studio Tools</span>
        </div>
        <span className="text-[10px] font-mono font-medium text-neutral-400 bg-white px-2 py-0.5 rounded-full border border-rule shrink-0">
          6 Utilities
        </span>
      </div>

      {/* Main Studio Tools List with Balanced Spacing */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 min-w-0">
        {/* Section 1: Audio & Notes */}
        <div className="space-y-2.5 min-w-0">
          <div className="px-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400 flex items-center justify-between">
            <span>Audio & Notes</span>
          </div>

          <div className="grid grid-cols-1 gap-2.5 min-w-0">
            {/* Audio Overview Tile */}
            <button
              type="button"
              onClick={() => setAudioOverviewOpen(true)}
              className="w-full text-left p-3.5 rounded-2xl border border-rule bg-vessel hover:bg-white hover:border-accent transition-all flex items-center justify-between gap-3 group cursor-pointer shadow-2xs min-w-0 overflow-hidden"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1 overflow-hidden">
                <div className="p-2.5 rounded-xl bg-accent/10 text-accent group-hover:scale-105 transition-transform shrink-0">
                  <Volume2 className="w-4.5 h-4.5" />
                </div>
                <div className="min-w-0 flex-1 overflow-hidden">
                  <h3 className="text-xs font-semibold text-ink group-hover:text-accent transition-colors truncate">
                    Audio Podcast Overview
                  </h3>
                  <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                    Voice Personas & Player
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-neutral-400 group-hover:text-accent group-hover:translate-x-0.5 transition-all shrink-0" />
            </button>

            {/* Notes & Scratchpad Tile */}
            <button
              type="button"
              onClick={() => setNotesOpen(true)}
              className="w-full text-left p-3.5 rounded-2xl border border-rule bg-vessel hover:bg-white hover:border-amber-500 transition-all flex items-center justify-between gap-3 group cursor-pointer shadow-2xs min-w-0 overflow-hidden"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1 overflow-hidden">
                <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 group-hover:scale-105 transition-transform shrink-0">
                  <StickyNote className="w-4.5 h-4.5" />
                </div>
                <div className="min-w-0 flex-1 overflow-hidden">
                  <h3 className="text-xs font-semibold text-ink group-hover:text-amber-600 transition-colors truncate">
                    Notes & Scratchpad
                  </h3>
                  <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                    Markdown Editor & Pins
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-neutral-400 group-hover:text-amber-600 group-hover:translate-x-0.5 transition-all shrink-0" />
            </button>
          </div>
        </div>

        {/* Section 2: Study & Transformations */}
        <div className="space-y-2.5 min-w-0">
          <div className="px-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400 flex items-center justify-between">
            <span>Study & Documents</span>
          </div>

          <div className="grid grid-cols-1 gap-2.5 min-w-0">
            {/* Executive Briefing Tile */}
            <button
              type="button"
              disabled={loadingFormat !== null}
              onClick={() => handleGenerateBriefing("briefing")}
              className="w-full text-left p-3.5 rounded-2xl border border-rule bg-vessel hover:bg-white hover:border-emerald-500 disabled:opacity-40 transition-all flex items-center justify-between gap-3 group cursor-pointer shadow-2xs min-w-0 overflow-hidden"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1 overflow-hidden">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 group-hover:scale-105 transition-transform shrink-0">
                  {loadingFormat === "briefing" ? (
                    <Loader2 className="w-4.5 h-4.5 animate-spin text-emerald-600" />
                  ) : (
                    <FileText className="w-4.5 h-4.5" />
                  )}
                </div>
                <div className="min-w-0 flex-1 overflow-hidden">
                  <h3 className="text-xs font-semibold text-ink group-hover:text-emerald-600 transition-colors truncate">
                    Executive Briefing
                  </h3>
                  <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                    Publication Document
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-neutral-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all shrink-0" />
            </button>

            {/* Study Guide Tile */}
            <button
              type="button"
              disabled={loadingFormat !== null}
              onClick={() => handleGenerateBriefing("study-guide")}
              className="w-full text-left p-3.5 rounded-2xl border border-rule bg-vessel hover:bg-white hover:border-blue-500 disabled:opacity-40 transition-all flex items-center justify-between gap-3 group cursor-pointer shadow-2xs min-w-0 overflow-hidden"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1 overflow-hidden">
                <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 group-hover:scale-105 transition-transform shrink-0">
                  {loadingFormat === "study-guide" ? (
                    <Loader2 className="w-4.5 h-4.5 animate-spin text-blue-600" />
                  ) : (
                    <FileText className="w-4.5 h-4.5" />
                  )}
                </div>
                <div className="min-w-0 flex-1 overflow-hidden">
                  <h3 className="text-xs font-semibold text-ink group-hover:text-blue-600 transition-colors truncate">
                    Comprehensive Study Guide
                  </h3>
                  <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                    Summaries & FAQs
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-neutral-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all shrink-0" />
            </button>

            {/* Flashcards & Quiz Deck Tile */}
            <button
              type="button"
              onClick={() => setStudyToolsOpen(true)}
              className="w-full text-left p-3.5 rounded-2xl border border-rule bg-vessel hover:bg-white hover:border-purple-500 transition-all flex items-center justify-between gap-3 group cursor-pointer shadow-2xs min-w-0 overflow-hidden"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1 overflow-hidden">
                <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600 group-hover:scale-105 transition-transform shrink-0">
                  <Layers className="w-4.5 h-4.5" />
                </div>
                <div className="min-w-0 flex-1 overflow-hidden">
                  <h3 className="text-xs font-semibold text-ink group-hover:text-purple-600 transition-colors truncate">
                    Flashcards & Quiz Deck
                  </h3>
                  <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                    Multi-Language Quizzes
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-neutral-400 group-hover:text-purple-600 group-hover:translate-x-0.5 transition-all shrink-0" />
            </button>

            {/* Mind Map Tile */}
            <button
              type="button"
              onClick={() => setMindMapOpen(true)}
              className="w-full text-left p-3.5 rounded-2xl border border-rule bg-vessel hover:bg-white hover:border-indigo-500 transition-all flex items-center justify-between gap-3 group cursor-pointer shadow-2xs min-w-0 overflow-hidden"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1 overflow-hidden">
                <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600 group-hover:scale-105 transition-transform shrink-0">
                  <GitFork className="w-4.5 h-4.5" />
                </div>
                <div className="min-w-0 flex-1 overflow-hidden">
                  <h3 className="text-xs font-semibold text-ink group-hover:text-indigo-600 transition-colors truncate">
                    AI Mind Map & Diagram
                  </h3>
                  <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                    Knowledge Graph
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-neutral-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all shrink-0" />
            </button>
          </div>
        </div>
      </div>

      {/* Audio Podcast Overview Modal */}
      {audioOverviewOpen && (
        <AudioOverviewModal notebookId={notebookId} onClose={() => setAudioOverviewOpen(false)} />
      )}

      {/* Notes & Scratchpad Modal */}
      {notesOpen && (
        <NotesModal notebookId={notebookId} onClose={() => setNotesOpen(false)} />
      )}

      {/* Multi-Language Study Tools Modal */}
      {studyToolsOpen && (
        <StudyToolsModal notebookId={notebookId} onClose={() => setStudyToolsOpen(false)} />
      )}

      {/* AI Mind Map & Diagram Modal */}
      {mindMapOpen && (
        <MindMapModal notebookId={notebookId} onClose={() => setMindMapOpen(false)} />
      )}

      {/* Executive Briefing & Study Guide Preview Modal */}
      {briefingData && (
        <BriefingModal
          data={briefingData}
          onClose={() => setBriefingData(null)}
        />
      )}
    </div>
  );
}
