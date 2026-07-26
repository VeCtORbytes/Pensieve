"use client";

import { useState } from "react";
import { File, Link2, Video, FileText, Upload, Plus, Sparkles, BookOpen } from "lucide-react";
import SourcePanel, { TabType } from "@/components/SourcePanel";

export default function EmptyNotebook({ notebookId }: { notebookId: string }) {
  const [activeModalTab, setActiveModalTab] = useState<TabType | null>(null);
  const [isIngestingSample, setIsIngestingSample] = useState(false);

  async function handleIngestSampleData() {
    try {
      setIsIngestingSample(true);
      const sampleText = `Quantum computing is a rapidly-emerging technology that harnesses the laws of quantum mechanics to solve problems too complex for classical computers. Classical computers encode information into binary bits (0 or 1), whereas quantum computers utilize quantum bits or qubits. Key principles include superposition, where qubits exist in combinations of 0 and 1 simultaneously, and quantum entanglement, where qubits interact instantaneously across distance. Applications include cryptography, material science, drug discovery, and financial portfolio optimization.`;

      await fetch("/api/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notebookId,
          type: "TEXT",
          title: "Introduction to Quantum Computing",
          content: sampleText,
        }),
      });

      window.location.reload();
    } catch (err) {
      console.error("Failed to ingest sample data:", err);
    } finally {
      setIsIngestingSample(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 bg-[#F5F7F8] bg-mesh min-h-[calc(100vh-60px)]">
      <div className="max-w-2xl w-full text-center space-y-8 glass-panel p-8 sm:p-10 rounded-3xl shadow-xl border border-[#E2E7EA]">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-[#E2E7EA] shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-[#3B4CC0] animate-pulse" />
            <span className="text-[11px] font-semibold text-[#141A22]">
              Empty Knowledge Vessel
            </span>
          </div>

          <h1 className="font-serif-display text-4xl md:text-5xl text-[#141A22] font-normal tracking-tight">
            Pour Knowledge into Pensieve
          </h1>
          <p className="text-xs text-neutral-500 max-w-md mx-auto leading-relaxed">
            Upload PDFs, websites, YouTube videos, transcripts, or notes. Receive grounded answers with exact position locators.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-left">
          {[
            {
              type: "pdf" as TabType,
              title: "PDF Document",
              desc: "Upload research papers or books with page citations.",
              icon: File,
              color: "text-red-600 bg-red-50 border-red-200 group-hover:border-red-400",
            },
            {
              type: "website" as TabType,
              title: "Website URL",
              desc: "Scrape article text cleanly stripped of navigation.",
              icon: Link2,
              color: "text-blue-600 bg-blue-50 border-blue-200 group-hover:border-blue-400",
            },
            {
              type: "youtube" as TabType,
              title: "YouTube Video",
              desc: "Ingest video captions with timestamp locators.",
              icon: Video,
              color: "text-red-600 bg-red-50 border-red-200 group-hover:border-red-400",
            },
            {
              type: "text" as TabType,
              title: "Raw Text",
              desc: "Paste notes, transcripts, or unformatted text blocks.",
              icon: FileText,
              color: "text-neutral-700 bg-neutral-100 border-neutral-200 group-hover:border-neutral-400",
            },
            {
              type: "vtt" as TabType,
              title: "VTT Subtitle File",
              desc: "Upload timestamped caption files for video locators.",
              icon: Upload,
              color: "text-emerald-700 bg-emerald-50 border-emerald-200 group-hover:border-emerald-400",
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.type}
                type="button"
                onClick={() => setActiveModalTab(item.type)}
                className="p-4 rounded-2xl bg-white border border-[#E2E7EA] hover:border-[#3B4CC0] shadow-2xs hover:shadow-lg transition duration-300 text-left space-y-3 group cursor-pointer flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${item.color} transition`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <Plus className="w-4 h-4 text-neutral-400 group-hover:text-[#3B4CC0] transition transform group-hover:scale-110" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-[#141A22] group-hover:text-[#3B4CC0] transition">
                    {item.title}
                  </h3>
                  <p className="text-[11px] text-neutral-500 leading-snug mt-0.5">
                    {item.desc}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Primary Call to Action & Sample Loader */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setActiveModalTab("text")}
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#141A22] text-white text-xs font-semibold rounded-xl hover:bg-[#3B4CC0] shadow-md transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add First Source Now
          </button>

          <button
            type="button"
            disabled={isIngestingSample}
            onClick={handleIngestSampleData}
            className="inline-flex items-center gap-2 px-5 py-3 bg-white text-[#141A22] text-xs font-semibold rounded-xl border border-[#E2E7EA] hover:border-[#3B4CC0] shadow-2xs transition cursor-pointer disabled:opacity-50"
          >
            <BookOpen className="w-4 h-4 text-[#1D9E75]" />
            {isIngestingSample ? "Ingesting Sample..." : "Try with Sample Note"}
          </button>
        </div>

        {/* Render SourcePanel modal when user selects a source card */}
        {activeModalTab && (
          <SourcePanel
            notebookId={notebookId}
            initialOpenModal={true}
            initialTab={activeModalTab}
            onModalClose={() => setActiveModalTab(null)}
          />
        )}
      </div>
    </div>
  );
}
