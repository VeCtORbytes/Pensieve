"use client";

import { useState } from "react";
import { Volume2, Layers, Loader2, GitFork, FileText, StickyNote, Sparkles } from "lucide-react";
import StudyToolsModal from "@/components/StudyToolsModal";
import MindMapModal from "@/components/MindMapModal";
import BriefingModal from "@/components/BriefingModal";
import NotesModal from "@/components/NotesModal";
import AudioOverviewModal from "@/components/AudioOverviewModal";

/**
 * Compact & Sleek Studio Panel for Notebook Transformations & Artifacts.
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
    <div className="flex h-full flex-col bg-white border-l border-rule">
      {/* Sleek Studio Header */}
      <div className="flex items-center justify-between border-b border-rule px-4 py-3 bg-vessel">
        <div className="flex items-center gap-1.5 font-semibold text-xs text-ink">
          <Sparkles className="w-3.5 h-3.5 text-accent" />
          <span>Studio Tools</span>
        </div>
        <span className="text-[10px] font-mono text-neutral-400">6 Utilities</span>
      </div>

      {/* Main Studio Tools List */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5">
        {/* Compact Grid of Tools */}
        <div className="grid grid-cols-1 gap-2.5">
          {/* Audio Overview Tile */}
          <button
            type="button"
            onClick={() => setAudioOverviewOpen(true)}
            className="w-full text-left p-3 rounded-xl border border-rule bg-vessel hover:bg-white hover:border-accent transition flex items-center justify-between group cursor-pointer shadow-2xs"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent/10 text-accent group-hover:scale-105 transition shrink-0">
                <Volume2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-ink group-hover:text-accent transition">
                  Audio Podcast Overview
                </h3>
                <p className="text-[10px] text-neutral-400">Voice Personas & Synchronized Player</p>
              </div>
            </div>
            <span className="text-[10px] font-semibold text-accent opacity-0 group-hover:opacity-100 transition">
              Open ➔
            </span>
          </button>

          {/* Notes & Scratchpad Tile */}
          <button
            type="button"
            onClick={() => setNotesOpen(true)}
            className="w-full text-left p-3 rounded-xl border border-rule bg-vessel hover:bg-white hover:border-amber-500 transition flex items-center justify-between group cursor-pointer shadow-2xs"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 group-hover:scale-105 transition shrink-0">
                <StickyNote className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-ink group-hover:text-amber-600 transition">
                  Notes & Scratchpad
                </h3>
                <p className="text-[10px] text-neutral-400">Markdown Editor & Pin Insights</p>
              </div>
            </div>
            <span className="text-[10px] font-semibold text-amber-600 opacity-0 group-hover:opacity-100 transition">
              Open ➔
            </span>
          </button>

          {/* Executive Briefing Tile */}
          <button
            type="button"
            disabled={loadingFormat !== null}
            onClick={() => handleGenerateBriefing("briefing")}
            className="w-full text-left p-3 rounded-xl border border-rule bg-vessel hover:bg-white hover:border-emerald-500 disabled:opacity-40 transition flex items-center justify-between group cursor-pointer shadow-2xs"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 group-hover:scale-105 transition shrink-0">
                {loadingFormat === "briefing" ? (
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                ) : (
                  <FileText className="w-4 h-4" />
                )}
              </div>
              <div>
                <h3 className="text-xs font-semibold text-ink group-hover:text-emerald-600 transition">
                  Executive Briefing
                </h3>
                <p className="text-[10px] text-neutral-400">Publication Document & Tables</p>
              </div>
            </div>
            <span className="text-[10px] font-semibold text-emerald-600 opacity-0 group-hover:opacity-100 transition">
              Generate ➔
            </span>
          </button>

          {/* Study Guide Tile */}
          <button
            type="button"
            disabled={loadingFormat !== null}
            onClick={() => handleGenerateBriefing("study-guide")}
            className="w-full text-left p-3 rounded-xl border border-rule bg-vessel hover:bg-white hover:border-blue-500 disabled:opacity-40 transition flex items-center justify-between group cursor-pointer shadow-2xs"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 group-hover:scale-105 transition shrink-0">
                {loadingFormat === "study-guide" ? (
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                ) : (
                  <FileText className="w-4 h-4" />
                )}
              </div>
              <div>
                <h3 className="text-xs font-semibold text-ink group-hover:text-blue-600 transition">
                  Comprehensive Study Guide
                </h3>
                <p className="text-[10px] text-neutral-400">Chapter Summaries & FAQs</p>
              </div>
            </div>
            <span className="text-[10px] font-semibold text-blue-600 opacity-0 group-hover:opacity-100 transition">
              Generate ➔
            </span>
          </button>

          {/* Flashcards & Quiz Deck Tile */}
          <button
            type="button"
            onClick={() => setStudyToolsOpen(true)}
            className="w-full text-left p-3 rounded-xl border border-rule bg-vessel hover:bg-white hover:border-purple-500 transition flex items-center justify-between group cursor-pointer shadow-2xs"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600 group-hover:scale-105 transition shrink-0">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-ink group-hover:text-purple-600 transition">
                  Flashcards & Quiz Deck
                </h3>
                <p className="text-[10px] text-neutral-400">Hinglish & Multi-Language Quizzes</p>
              </div>
            </div>
            <span className="text-[10px] font-semibold text-purple-600 opacity-0 group-hover:opacity-100 transition">
              Open ➔
            </span>
          </button>

          {/* Mind Map Tile */}
          <button
            type="button"
            onClick={() => setMindMapOpen(true)}
            className="w-full text-left p-3 rounded-xl border border-rule bg-vessel hover:bg-white hover:border-indigo-500 transition flex items-center justify-between group cursor-pointer shadow-2xs"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600 group-hover:scale-105 transition shrink-0">
                <GitFork className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-ink group-hover:text-indigo-600 transition">
                  AI Mind Map & Diagram
                </h3>
                <p className="text-[10px] text-neutral-400">Mermaid.js Knowledge Graph</p>
              </div>
            </div>
            <span className="text-[10px] font-semibold text-indigo-600 opacity-0 group-hover:opacity-100 transition">
              Generate ➔
            </span>
          </button>
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
