"use client";

import { useState, useEffect } from "react";
import { Search, FileText, File, Link2, Video, Upload, X, ArrowRight, Sparkles } from "lucide-react";

interface CommandPaletteProps {
  notebookId: string;
  isOpen: boolean;
  onClose: () => void;
  onSelectSource?: (source: any) => void;
  onSelectPrompt?: (prompt: string) => void;
}

export default function CommandPalette({
  notebookId,
  isOpen,
  onClose,
  onSelectSource,
  onSelectPrompt,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [sources, setSources] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen) {
      fetch(`/api/sources?notebookId=${notebookId}`)
        .then((res) => res.json())
        .then((data) => setSources(data || []))
        .catch(console.error);
    }
  }, [isOpen, notebookId]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredSources = sources.filter(
    (s) =>
      s.title.toLowerCase().includes(query.toLowerCase()) ||
      s.type.toLowerCase().includes(query.toLowerCase())
  );

  const starterPrompts = [
    "Summarize the key takeaways from my sources.",
    "What are the main arguments or topics presented?",
    "List key insights and recommendations.",
    "Explain the core technical concepts step-by-step.",
  ].filter((p) => p.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-md pt-20 p-4">
      <div className="bg-[#111622] rounded-3xl max-w-xl w-full shadow-2xl overflow-hidden border border-[#222B3D] text-[#E6EDF3] animate-in fade-in zoom-in-95 duration-150">
        {/* Search Bar */}
        <div className="flex items-center px-4 py-1 border-b border-[#222B3D] bg-[#090D14]">
          <Search className="w-4 h-4 text-[#8B949E] shrink-0" />
          <input
            autoFocus
            type="text"
            placeholder="Search sources or select starter prompt (ESC to close)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full px-3 py-3.5 text-xs bg-transparent outline-none text-[#E6EDF3] placeholder-[#8B949E]/60 font-sans"
          />
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#8B949E] hover:text-[#E6EDF3] hover:bg-[#192030] rounded-xl transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-3 space-y-3">
          {/* Sources Section */}
          {filteredSources.length > 0 && (
            <div className="space-y-1">
              <div className="px-3 py-1 text-[10px] uppercase font-semibold text-[#8B949E] tracking-wider flex items-center gap-1">
                <FileText className="w-3 h-3 text-[#38BDF8]" />
                Sources ({filteredSources.length})
              </div>
              {filteredSources.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    if (onSelectSource) onSelectSource(s);
                    onClose();
                  }}
                  className="w-full text-left p-3 rounded-2xl hover:bg-[#192030] border border-transparent hover:border-[#8B5CF6]/30 flex items-center justify-between text-xs transition cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <TypeIcon type={s.type} />
                    <span className="font-medium text-[#E6EDF3] group-hover:text-[#38BDF8] truncate transition">
                      {s.title}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-[#8B949E] uppercase bg-[#090D14] px-2 py-0.5 rounded-lg border border-[#222B3D]">
                    {s.type}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Prompts Section */}
          {starterPrompts.length > 0 && (
            <div className="space-y-1">
              <div className="px-3 py-1 text-[10px] uppercase font-semibold text-[#8B949E] tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-[#8B5CF6]" />
                Starter Prompts
              </div>
              {starterPrompts.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    if (onSelectPrompt) onSelectPrompt(p);
                    onClose();
                  }}
                  className="w-full text-left p-3 rounded-2xl hover:bg-[#192030] border border-transparent hover:border-[#8B5CF6]/30 flex items-center justify-between text-xs text-[#E6EDF3] transition cursor-pointer group"
                >
                  <span>{p}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#8B949E] group-hover:text-[#8B5CF6] transition transform group-hover:translate-x-1" />
                </button>
              ))}
            </div>
          )}

          {filteredSources.length === 0 && starterPrompts.length === 0 && (
            <div className="py-8 text-center text-xs text-[#8B949E]">
              No matching sources or prompts found for "{query}".
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TypeIcon({ type }: { type: string }) {
  if (type === "PDF") return <File className="w-4 h-4 text-red-400 shrink-0" />;
  if (type === "YOUTUBE") return <Video className="w-4 h-4 text-red-400 shrink-0" />;
  if (type === "WEBSITE") return <Link2 className="w-4 h-4 text-sky-400 shrink-0" />;
  if (type === "TRANSCRIPT") return <Upload className="w-4 h-4 text-emerald-400 shrink-0" />;
  return <FileText className="w-4 h-4 text-[#8B949E] shrink-0" />;
}
