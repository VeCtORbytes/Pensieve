"use client";

import { useState } from "react";
import { File, Link2, Video, FileText, Upload, Plus } from "lucide-react";
import SourcePanel from "@/components/SourcePanel";

export default function EmptyNotebook({ notebookId }: { notebookId: string }) {
  const [isAddingSource, setIsAddingSource] = useState(false);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 bg-[#F5F7F8] min-h-[calc(100vh-60px)]">
      <div className="max-w-2xl w-full text-center space-y-6">
        <div className="space-y-2">
          <h1 className="font-serif-display text-4xl md:text-5xl text-[#141A22] font-normal tracking-tight">
            Pensieve Memory Vessel
          </h1>
          <p className="text-sm text-[#141A22]/70 max-w-md mx-auto leading-relaxed">
            Pour your documents, articles, videos, and notes into this notebook. Ask questions and receive precision-grounded answers with exact citations.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-4 text-left">
          {[
            {
              type: "PDF",
              title: "PDF Document",
              desc: "Upload research papers, slides, or books with page citations.",
              icon: File,
              color: "text-red-600 bg-red-50 border-red-200",
            },
            {
              type: "WEBSITE",
              title: "Website URL",
              desc: "Scrape article text cleanly stripped of ads and navigation.",
              icon: Link2,
              color: "text-blue-600 bg-blue-50 border-blue-200",
            },
            {
              type: "YOUTUBE",
              title: "YouTube Video",
              desc: "Ingest video captions with timestamp locators for seeking.",
              icon: Video,
              color: "text-red-600 bg-red-50 border-red-200",
            },
            {
              type: "TEXT",
              title: "Raw Text",
              desc: "Paste notes, transcripts, or unformatted text blocks.",
              icon: FileText,
              color: "text-neutral-700 bg-neutral-100 border-neutral-200",
            },
            {
              type: "TRANSCRIPT",
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
                onClick={() => setIsAddingSource(true)}
                className="p-4 rounded-xl bg-white border border-[#E2E7EA] hover:border-[#3B4CC0] shadow-xs hover:shadow-md transition duration-200 text-left space-y-2 group cursor-pointer flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${item.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <Plus className="w-4 h-4 text-neutral-400 group-hover:text-[#3B4CC0] transition" />
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

        {/* Hidden SourcePanel used for triggering Add Source modal dialog */}
        <div className="pt-4 flex justify-center">
          <button
            type="button"
            onClick={() => setIsAddingSource(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#141A22] text-white text-xs font-semibold rounded-xl hover:bg-[#3B4CC0] shadow-sm transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add First Source Now
          </button>
        </div>

        {/* Embedded SourcePanel for Modal standard behavior */}
        <div className="hidden">
          <SourcePanel notebookId={notebookId} />
        </div>
      </div>
    </div>
  );
}
