"use client";

import { useState, useEffect, useRef } from "react";
import {
  X,
  Plus,
  Trash2,
  Edit3,
  Copy,
  Check,
  Download,
  Printer,
  Eye,
  Code,
  FileText,
  Loader2,
  Search,
} from "lucide-react";
import FormattedMarkdown from "@/components/FormattedMarkdown";

export interface NoteItem {
  id: string;
  notebookId: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export default function NotesModal({
  notebookId,
  onClose,
  initialNoteContent,
}: {
  notebookId: string;
  onClose: () => void;
  initialNoteContent?: string;
}) {
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [activeNote, setActiveNote] = useState<NoteItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [viewMode, setViewMode] = useState<"edit" | "preview">("edit");
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  async function fetchNotes() {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/notes?notebookId=${notebookId}`);
      if (!res.ok) throw new Error("Failed to load notes");
      const data = await res.json();
      const loaded: NoteItem[] = data.notes || [];
      setNotes(loaded);

      if (loaded.length > 0) {
        setActiveNote(loaded[0]);
      } else {
        createNewNote(initialNoteContent);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchNotes();
  }, [notebookId]);

  async function createNewNote(contentOverride?: string) {
    try {
      setIsSaving(true);
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notebookId,
          title: "New Research Note",
          content: contentOverride || "# Key Findings\n\n- Write your research notes here...",
        }),
      });

      if (!res.ok) throw new Error("Failed to create note");
      const data = await res.json();
      const newNote = data.note;
      setNotes((prev) => [newNote, ...prev]);
      setActiveNote(newNote);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  }

  function handleTitleChange(newTitle: string) {
    if (!activeNote) return;
    const updated = { ...activeNote, title: newTitle };
    setActiveNote(updated);
    setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
    triggerAutoSave(updated);
  }

  function handleContentChange(newContent: string) {
    if (!activeNote) return;
    const updated = { ...activeNote, content: newContent };
    setActiveNote(updated);
    setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
    triggerAutoSave(updated);
  }

  function triggerAutoSave(noteToSave: NoteItem) {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    setIsSaving(true);
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await fetch(`/api/notes/${noteToSave.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: noteToSave.title,
            content: noteToSave.content,
          }),
        });
      } catch (err) {
        console.error("Auto save failed:", err);
      } finally {
        setIsSaving(false);
      }
    }, 800);
  }

  async function deleteCurrentNote(id: string) {
    if (!confirm("Delete this note?")) return;
    try {
      await fetch(`/api/notes/${id}`, { method: "DELETE" });
      const remaining = notes.filter((n) => n.id !== id);
      setNotes(remaining);
      setActiveNote(remaining.length > 0 ? remaining[0] : null);
    } catch (err) {
      console.error("Delete failed:", err);
    }
  }

  function handleCopy() {
    if (!activeNote) return;
    navigator.clipboard.writeText(activeNote.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownload() {
    if (!activeNote) return;
    const blob = new Blob([activeNote.content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeNote.title.replace(/\s+/g, "-")}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  const filteredNotes = notes.filter((n) =>
    n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    n.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-5xl w-full h-[90vh] p-6 shadow-2xl border border-[#E2E7EA] text-[#141A22] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E2E7EA] pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#3B4CC0]/10 border border-[#3B4CC0]/20 text-[#3B4CC0]">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-serif-display font-medium text-[#141A22]">
                Notebook Notes & Scratchpad
              </h3>
              <p className="text-[11px] text-neutral-500">
                Write, organize, and export your research notes
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isSaving && (
              <span className="text-xs text-neutral-400 font-mono flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin text-[#3B4CC0]" />
                Saving...
              </span>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-neutral-400 hover:text-[#141A22] rounded-xl hover:bg-[#F5F7F8] transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body Split View */}
        <div className="flex-1 my-3 overflow-hidden grid grid-cols-1 md:grid-cols-3 rounded-2xl border border-[#E2E7EA]">
          {/* Left Notes List Sidebar */}
          <div className="p-4 bg-[#F5F7F8] border-r border-[#E2E7EA] flex flex-col gap-3 overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                Notes ({notes.length})
              </span>
              <button
                type="button"
                onClick={() => createNewNote()}
                className="flex items-center gap-1 px-2.5 py-1 bg-[#141A22] hover:bg-[#3B4CC0] text-white text-xs font-semibold rounded-lg transition cursor-pointer shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New</span>
              </button>
            </div>

            {/* Search input */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-[#E2E7EA] rounded-xl text-xs">
              <Search className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
              <input
                type="text"
                placeholder="Search notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent outline-none text-xs text-[#141A22]"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pt-1">
              {isLoading ? (
                <div className="text-center py-8 text-xs text-neutral-400">Loading notes...</div>
              ) : filteredNotes.length === 0 ? (
                <div className="text-center py-8 text-xs text-neutral-400">No notes found.</div>
              ) : (
                filteredNotes.map((note) => (
                  <div
                    key={note.id}
                    onClick={() => setActiveNote(note)}
                    className={`p-3 rounded-xl border transition cursor-pointer flex flex-col gap-1 group ${
                      activeNote?.id === note.id
                        ? "bg-white border-[#3B4CC0] shadow-xs text-[#141A22]"
                        : "bg-[#F5F7F8] hover:bg-white border-[#E2E7EA] text-neutral-600"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-xs truncate group-hover:text-[#3B4CC0]">
                        {note.title || "Untitled Note"}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteCurrentNote(note.id);
                        }}
                        className="p-1 text-neutral-400 hover:text-red-600 rounded transition opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <span className="text-[10px] font-mono text-neutral-400">
                      {new Date(note.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right Active Note Editor / Preview Pane */}
          <div className="md:col-span-2 bg-white flex flex-col overflow-hidden">
            {activeNote ? (
              <>
                {/* Editor Header Bar */}
                <div className="p-3 border-b border-[#E2E7EA] flex flex-wrap items-center justify-between gap-3 bg-[#F5F7F8]">
                  <input
                    type="text"
                    value={activeNote.title}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    placeholder="Note Title..."
                    className="font-serif-display font-medium text-base text-[#141A22] bg-transparent border-b border-transparent hover:border-[#E2E7EA] focus:border-[#3B4CC0] outline-none px-1 py-0.5 truncate max-w-xs sm:max-w-md"
                  />

                  <div className="flex items-center gap-2">
                    {/* View mode toggle */}
                    <div className="flex bg-white p-0.5 rounded-full border border-[#E2E7EA] text-xs font-medium shadow-2xs">
                      <button
                        type="button"
                        onClick={() => setViewMode("edit")}
                        className={`px-3 py-1 rounded-full transition cursor-pointer flex items-center gap-1 ${
                          viewMode === "edit"
                            ? "bg-[#141A22] text-white font-semibold shadow-xs"
                            : "text-neutral-500 hover:text-[#141A22]"
                        }`}
                      >
                        <Code className="w-3 h-3" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode("preview")}
                        className={`px-3 py-1 rounded-full transition cursor-pointer flex items-center gap-1 ${
                          viewMode === "preview"
                            ? "bg-[#141A22] text-white font-semibold shadow-xs"
                            : "text-neutral-500 hover:text-[#141A22]"
                        }`}
                      >
                        <Eye className="w-3 h-3" />
                        <span>Preview</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleCopy}
                      title="Copy Markdown"
                      className="p-2 text-neutral-500 hover:text-[#141A22] hover:bg-white rounded-xl transition cursor-pointer border border-[#E2E7EA]"
                    >
                      {copied ? <Check className="w-4 h-4 text-[#1D9E75]" /> : <Copy className="w-4 h-4" />}
                    </button>

                    <button
                      type="button"
                      onClick={handleDownload}
                      title="Download Markdown file"
                      className="p-2 text-neutral-500 hover:text-[#141A22] hover:bg-white rounded-xl transition cursor-pointer border border-[#E2E7EA]"
                    >
                      <Download className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => window.print()}
                      title="Print Note"
                      className="p-2 text-neutral-500 hover:text-[#141A22] hover:bg-white rounded-xl transition cursor-pointer border border-[#E2E7EA]"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Editor Content Area */}
                <div className="flex-1 overflow-y-auto p-4">
                  {viewMode === "edit" ? (
                    <textarea
                      value={activeNote.content}
                      onChange={(e) => handleContentChange(e.target.value)}
                      placeholder="Write your research notes, quotes, ideas, or pin AI chat answers..."
                      className="w-full h-full p-4 font-mono text-xs text-[#141A22] bg-white outline-none resize-none leading-relaxed"
                    />
                  ) : (
                    <div className="p-4 bg-white rounded-xl border border-[#E2E7EA] min-h-full">
                      <FormattedMarkdown content={activeNote.content} />
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-neutral-400 text-xs">
                Select a note from the sidebar or click "New" to create a note.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
