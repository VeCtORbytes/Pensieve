"use client";

import { useState, useEffect } from "react";
import { Search, FileText, File, Link2, Video, Upload, X, ArrowRight } from "lucide-react";

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
        else {
          // Open handled by parent or state
        }
      }
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredSources = sources.filter((s) =>
    s.title.toLowerCase().includes(query.toLowerCase()) ||
    s.type.toLowerCase().includes(query.toLowerCase())
  );

  const starterPrompts = [
    "Summarize the key takeaways from my sources.",
    "What are the main arguments or topics presented?",
    "List key insights and recommendations.",
  ].filter((p) => p.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-xs pt-20 p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden border border-rule animate-in fade-in zoom-in-95 duration-150">
        {/* Search Bar */}
        <div className="flex items-center px-4 border-b border-rule">
          <Search className="w-4 h-4 text-neutral-400 shrink-0" />
          <input
            autoFocus
            type="text"
            placeholder="Search sources or select starter prompt (ESC to close)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full px-3 py-3.5 text-xs bg-transparent outline-none text-ink placeholder-neutral-400"
          />
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-neutral-600 rounded cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-3">
          {/* Sources Section */}
          {filteredSources.length > 0 && (
            <div className="space-y-1">
              <div className="px-3 py-1 text-[10px] uppercase font-semibold text-neutral-400 tracking-wider">
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
                  className="w-full text-left p-2.5 rounded-xl hover:bg-vessel flex items-center justify-between text-xs transition cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <TypeIcon type={s.type} />
                    <span className="font-medium text-ink group-hover:text-accent truncate">
                      {s.title}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-neutral-400 uppercase bg-neutral-100 px-1.5 py-0.5 rounded">
                    {s.type}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Prompts Section */}
          {starterPrompts.length > 0 && (
            <div className="space-y-1">
              <div className="px-3 py-1 text-[10px] uppercase font-semibold text-neutral-400 tracking-wider">
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
                  className="w-full text-left p-2.5 rounded-xl hover:bg-vessel flex items-center justify-between text-xs text-neutral-700 transition cursor-pointer group"
                >
                  <span>{p}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-neutral-400 group-hover:text-accent transition" />
                </button>
              ))}
            </div>
          )}

          {filteredSources.length === 0 && starterPrompts.length === 0 && (
            <div className="py-8 text-center text-xs text-neutral-400">
              No matching sources or prompts found for "{query}".
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TypeIcon({ type }: { type: string }) {
  if (type === "PDF") return <File className="w-4 h-4 text-red-500 shrink-0" />;
  if (type === "YOUTUBE") return <Video className="w-4 h-4 text-red-500 shrink-0" />;
  if (type === "WEBSITE") return <Link2 className="w-4 h-4 text-blue-500 shrink-0" />;
  if (type === "TRANSCRIPT") return <Upload className="w-4 h-4 text-emerald-600 shrink-0" />;
  return <FileText className="w-4 h-4 text-neutral-500 shrink-0" />;
}
