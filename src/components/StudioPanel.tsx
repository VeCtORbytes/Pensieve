"use client";

import { useState } from "react";
import { Volume2, Layers, Loader2, GitFork, FileText, StickyNote } from "lucide-react";
import StudyToolsModal from "@/components/StudyToolsModal";
import MindMapModal from "@/components/MindMapModal";
import BriefingModal from "@/components/BriefingModal";
import NotesModal from "@/components/NotesModal";
import AudioOverviewModal from "@/components/AudioOverviewModal";

/**
 * Persistent home for generated notebook outputs (Audio Overview, Notes & Scratchpad,
 * Study Tools, AI Mind Map & Knowledge Graph, Executive Briefings & Study Guides).
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
      {/* Studio Header */}
      <div className="flex items-center justify-between border-b border-rule px-4 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Studio
        </h2>
      </div>

      {/* Main Studio Tools List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <p className="text-[11px] font-medium text-neutral-400">
          Synthesize and transform your sources into interactive study artifacts and publication documents.
        </p>

        {/* Audio Podcast Overview Card */}
        <div className="p-4 rounded-2xl border border-rule bg-vessel hover:bg-white transition space-y-3 shadow-2xs group">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-accent/10 text-accent group-hover:scale-105 transition">
              <Volume2 className="w-5 h-5" />
            </div>
            <div className="space-y-0.5">
              <h3 className="text-xs font-semibold text-ink">Audio Podcast Overview</h3>
              <p className="text-[11px] text-neutral-500 leading-normal">
                Customizable Voice Personas (Casual, Academic, ELI5, Debate) with synchronized transcript player.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setAudioOverviewOpen(true)}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-ink hover:bg-accent py-2 text-xs font-semibold text-white shadow-xs transition cursor-pointer"
          >
            <Volume2 className="w-4 h-4" />
            <span>Open Audio Studio</span>
          </button>
        </div>

        {/* Notes & Scratchpad Button */}
        <div className="p-4 rounded-2xl border border-rule bg-vessel hover:bg-white transition space-y-3 shadow-2xs group">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 group-hover:scale-105 transition">
              <StickyNote className="w-5 h-5" />
            </div>
            <div className="space-y-0.5">
              <h3 className="text-xs font-semibold text-ink">Notes & Scratchpad</h3>
              <p className="text-[11px] text-neutral-500 leading-normal">
                Write markdown notes, pin AI insights, search saved notes, and export as .md files.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setNotesOpen(true)}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-ink hover:bg-amber-600 py-2 text-xs font-semibold text-white shadow-xs transition cursor-pointer"
          >
            <StickyNote className="w-4 h-4" />
            <span>Open Notes Scratchpad</span>
          </button>
        </div>

        {/* Executive Briefing Document Button */}
        <div className="p-4 rounded-2xl border border-rule bg-vessel hover:bg-white transition space-y-3 shadow-2xs group">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 group-hover:scale-105 transition">
              <FileText className="w-5 h-5" />
            </div>
            <div className="space-y-0.5">
              <h3 className="text-xs font-semibold text-ink">Executive Briefing</h3>
              <p className="text-[11px] text-neutral-500 leading-normal">
                Publication-grade executive document with key takeaways, data tables, and citations.
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={loadingFormat !== null}
            onClick={() => handleGenerateBriefing("briefing")}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-ink hover:bg-emerald-600 disabled:opacity-40 py-2 text-xs font-semibold text-white shadow-xs transition cursor-pointer"
          >
            {loadingFormat === "briefing" ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Generating Executive Briefing...</span>
              </>
            ) : (
              <>
                <FileText className="w-4 h-4" />
                <span>Generate Executive Briefing</span>
              </>
            )}
          </button>
        </div>

        {/* Study Guide Document Button */}
        <div className="p-4 rounded-2xl border border-rule bg-vessel hover:bg-white transition space-y-3 shadow-2xs group">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 group-hover:scale-105 transition">
              <FileText className="w-5 h-5" />
            </div>
            <div className="space-y-0.5">
              <h3 className="text-xs font-semibold text-ink">Comprehensive Study Guide</h3>
              <p className="text-[11px] text-neutral-500 leading-normal">
                Structured study guide with core concepts, chapter summaries, FAQs, and glossary.
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={loadingFormat !== null}
            onClick={() => handleGenerateBriefing("study-guide")}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-ink hover:bg-blue-600 disabled:opacity-40 py-2 text-xs font-semibold text-white shadow-xs transition cursor-pointer"
          >
            {loadingFormat === "study-guide" ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Generating Study Guide...</span>
              </>
            ) : (
              <>
                <FileText className="w-4 h-4" />
                <span>Generate Study Guide</span>
              </>
            )}
          </button>
        </div>

        {/* Multi-Language Study Tools (Flashcards & Quiz) Button */}
        <div className="p-4 rounded-2xl border border-rule bg-vessel hover:bg-white transition space-y-3 shadow-2xs group">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600 group-hover:scale-105 transition">
              <Layers className="w-5 h-5" />
            </div>
            <div className="space-y-0.5">
              <h3 className="text-xs font-semibold text-ink">Flashcards & Quiz Deck</h3>
              <p className="text-[11px] text-neutral-500 leading-normal">
                Multi-Language Flashcards (English, Hinglish, Hindi) & Interactive Quizzes with live scores.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setStudyToolsOpen(true)}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-ink hover:bg-purple-600 py-2 text-xs font-semibold text-white shadow-xs transition cursor-pointer"
          >
            <Layers className="w-4 h-4" />
            <span>Open Flashcards & Quiz Deck</span>
          </button>
        </div>

        {/* AI Mind Map & Knowledge Graph Button */}
        <div className="p-4 rounded-2xl border border-rule bg-vessel hover:bg-white transition space-y-3 shadow-2xs group">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600 group-hover:scale-105 transition">
              <GitFork className="w-5 h-5" />
            </div>
            <div className="space-y-0.5">
              <h3 className="text-xs font-semibold text-ink">AI Mind Map & Knowledge Graph</h3>
              <p className="text-[11px] text-neutral-500 leading-normal">
                Mermaid.js conceptual diagram & interactive node inspector synthesized from your sources.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setMindMapOpen(true)}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-ink hover:bg-indigo-600 py-2 text-xs font-semibold text-white shadow-xs transition cursor-pointer"
          >
            <GitFork className="w-4 h-4" />
            <span>Generate Mind Map & Diagram</span>
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
