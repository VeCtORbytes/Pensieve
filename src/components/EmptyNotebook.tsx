"use client";

import { useState } from "react";
import { File, Link2, Video, FileText, Upload, Plus } from "lucide-react";
import SourcePanel, { TabType } from "@/components/SourcePanel";

export default function EmptyNotebook({ notebookId }: { notebookId: string }) {
  const [activeModalTab, setActiveModalTab] = useState<TabType | null>(null);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 bg-vessel min-h-[calc(100vh-60px)]">
      <div className="max-w-2xl w-full text-center space-y-6">
        <div className="space-y-2">
          <h1 className="font-serif-display text-4xl md:text-5xl text-ink font-normal tracking-tight">
            Pensieve Memory Vessel
          </h1>
          <p className="text-sm text-ink/70 max-w-md mx-auto leading-relaxed">
            Pour your documents, articles, videos, and notes into this notebook. Ask questions and receive precision-grounded answers with exact citations.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-4 text-left">
          {[
            {
              type: "pdf" as TabType,
              title: "PDF Document",
              desc: "Upload research papers, slides, or books with page citations.",
              icon: File,
              color: "text-red-600 bg-red-50 border-red-200",
            },
            {
              type: "website" as TabType,
              title: "Website URL",
              desc: "Scrape article text cleanly stripped of ads and navigation.",
              icon: Link2,
              color: "text-blue-600 bg-blue-50 border-blue-200",
            },
            {
              type: "youtube" as TabType,
              title: "YouTube Video",
              desc: "Ingest video captions with timestamp locators for seeking.",
              icon: Video,
              color: "text-red-600 bg-red-50 border-red-200",
            },
            {
              type: "text" as TabType,
              title: "Raw Text",
              desc: "Paste notes, transcripts, or unformatted text blocks.",
              icon: FileText,
              color: "text-neutral-700 bg-neutral-100 border-neutral-200",
            },
            {
              type: "vtt" as TabType,
              title: "VTT Subtitle File",
              desc: "Upload timestamped VTT caption files for precise video locators.",
              icon: Upload,
              color: "text-emerald-700 bg-emerald-50 border-emerald-200",
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.type}
                type="button"
                onClick={() => setActiveModalTab(item.type)}
                className="p-4 rounded-xl bg-white border border-rule hover:border-accent shadow-xs hover:shadow-md transition duration-200 text-left space-y-2 group cursor-pointer flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${item.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <Plus className="w-4 h-4 text-neutral-400 group-hover:text-accent transition" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-ink group-hover:text-accent transition">
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

        <div className="pt-4 flex justify-center">
          <button
            type="button"
            onClick={() => setActiveModalTab("text")}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-ink text-white text-xs font-semibold rounded-xl hover:bg-accent shadow-sm transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add First Source Now
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
