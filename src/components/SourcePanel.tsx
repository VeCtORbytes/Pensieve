"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, FileText, Upload, Link2, Video, File, Loader2, X } from "lucide-react";

interface Source {
  id: string;
  notebookId: string;
  type: string;
  title: string;
  url?: string | null;
  status: "QUEUED" | "EXTRACTING" | "EMBEDDING" | "READY" | "FAILED";
  error?: string | null;
  chunkCount: number;
  createdAt: string;
}

type TabType = "text" | "vtt" | "pdf" | "website" | "youtube";

export default function SourcePanel({ notebookId }: { notebookId: string }) {
  const [sources, setSources] = useState<Source[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("text");

  // Form states
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [url, setUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const fetchSources = useCallback(async () => {
    try {
      const res = await fetch(`/api/sources?notebookId=${notebookId}`);
      if (res.ok) {
        const data = await res.json();
        setSources(data);
      }
    } catch (err) {
      console.error("Failed to poll sources:", err);
    }
  }, [notebookId]);

  // Poll every 2 seconds
  useEffect(() => {
    fetchSources();
    const interval = setInterval(fetchSources, 2000);
    return () => clearInterval(interval);
  }, [fetchSources]);

  function resetForm() {
    setTitle("");
    setContent("");
    setUrl("");
    setSubmitError("");
  }

  async function handleCreateSource(e: React.FormEvent) {
    e.preventDefault();

    let sourceType = "TEXT";
    let bodyContent = content;
    let bodyUrl = url;

    if (activeTab === "vtt") sourceType = "TRANSCRIPT";
    if (activeTab === "pdf") sourceType = "PDF";
    if (activeTab === "website") {
      sourceType = "WEBSITE";
      bodyContent = url;
    }
    if (activeTab === "youtube") {
      sourceType = "YOUTUBE";
      bodyContent = url;
    }

    if (!title.trim()) return;
    if ((activeTab === "website" || activeTab === "youtube") && !url.trim()) return;
    if ((activeTab === "text" || activeTab === "vtt" || activeTab === "pdf") && !content.trim()) return;

    setIsSubmitting(true);
    setSubmitError("");

    try {
      const res = await fetch("/api/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notebookId,
          type: sourceType,
          title: title.trim(),
          content: bodyContent,
          url: bodyUrl || undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to create source");
      }

      resetForm();
      setIsModalOpen(false);
      fetchSources();
    } catch (err: any) {
      setSubmitError(err.message || "Failed to add source");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleVttUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!title) {
      setTitle(file.name.replace(/\.[^/.]+$/, ""));
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setContent((event.target?.result as string) || "");
    };
    reader.readAsText(file);
  }

  function handlePdfUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!title) {
      setTitle(file.name.replace(/\.[^/.]+$/, ""));
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setContent(base64 || "");
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="flex flex-col h-full bg-neutral-50/50">
      <div className="flex items-center justify-between p-4 border-b border-neutral-200">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Sources ({sources.length})
        </h2>
        <button
          onClick={() => {
            resetForm();
            setIsModalOpen(true);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-neutral-900 rounded-lg hover:bg-neutral-800 transition"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Source
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
        {sources.length === 0 ? (
          <div className="py-12 text-center text-neutral-400">
            <FileText className="w-8 h-8 mx-auto text-neutral-300 mb-2" />
            <p className="text-xs">No sources added yet.</p>
            <p className="text-[11px] text-neutral-400 mt-1">
              Add PDF, Website, YouTube, Text, or VTT sources.
            </p>
          </div>
        ) : (
          sources.map((s) => (
            <div
              key={s.id}
              className="p-3 rounded-lg border border-neutral-200 bg-white shadow-sm space-y-1.5"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium text-sm text-neutral-800 truncate flex-1">
                  {s.title}
                </span>
                <StatusBadge status={s.status} />
              </div>

              <div className="flex items-center justify-between text-xs text-neutral-400 pt-1 border-t border-neutral-100">
                <span className="uppercase text-[10px] font-semibold tracking-wide text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded">
                  {s.type}
                </span>
                <span>
                  {s.status === "READY" ? `${s.chunkCount} chunks` : s.status}
                </span>
              </div>

              {s.error && (
                <div className="text-[11px] text-red-600 bg-red-50 p-2 rounded border border-red-100 mt-1">
                  {s.error}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Modal Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl max-w-xl w-full p-6 shadow-2xl space-y-5 border border-neutral-200">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h3 className="text-base font-semibold text-neutral-900">Add Knowledge Source</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tab navigation for 5 sources */}
            <div className="flex border-b border-neutral-200 text-xs overflow-x-auto">
              {[
                { id: "text", label: "Text", icon: FileText },
                { id: "pdf", label: "PDF", icon: File },
                { id: "website", label: "Website", icon: Link2 },
                { id: "youtube", label: "YouTube", icon: Video },
                { id: "vtt", label: "VTT", icon: Upload },
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(tab.id as TabType);
                      setSubmitError("");
                    }}
                    className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-medium transition whitespace-nowrap ${
                      activeTab === tab.id
                        ? "border-neutral-900 text-neutral-900"
                        : "border-transparent text-neutral-400 hover:text-neutral-700"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <form onSubmit={handleCreateSource} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Source Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Documentation / Lecture Video"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg outline-none focus:ring-2 focus:ring-neutral-900"
                />
              </div>

              {/* PDF Tab */}
              {activeTab === "pdf" && (
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Select .pdf File
                  </label>
                  <input
                    type="file"
                    accept=".pdf"
                    required={!content}
                    onChange={handlePdfUpload}
                    className="w-full text-xs text-neutral-500 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-neutral-100 file:text-neutral-700 hover:file:bg-neutral-200"
                  />
                </div>
              )}

              {/* Website Tab */}
              {activeTab === "website" && (
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Website URL
                  </label>
                  <input
                    type="url"
                    required
                    placeholder="https://example.com/article"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg outline-none focus:ring-2 focus:ring-neutral-900"
                  />
                </div>
              )}

              {/* YouTube Tab */}
              {activeTab === "youtube" && (
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    YouTube Video URL
                  </label>
                  <input
                    type="url"
                    required
                    placeholder="https://www.youtube.com/watch?v=..."
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg outline-none focus:ring-2 focus:ring-neutral-900"
                  />
                </div>
              )}

              {/* VTT Tab */}
              {activeTab === "vtt" && (
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Select .vtt / .txt File
                  </label>
                  <input
                    type="file"
                    accept=".vtt,.txt"
                    onChange={handleVttUpload}
                    className="w-full text-xs text-neutral-500 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-neutral-100 file:text-neutral-700 hover:file:bg-neutral-200"
                  />
                </div>
              )}

              {/* Text Area for Text / VTT / PDF content view */}
              {(activeTab === "text" || activeTab === "vtt") && (
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Content Text
                  </label>
                  <textarea
                    required
                    rows={5}
                    placeholder="Paste article, raw text, or document notes here..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono border border-neutral-300 rounded-lg outline-none focus:ring-2 focus:ring-neutral-900"
                  />
                </div>
              )}

              {submitError && (
                <p className="text-xs text-red-600 bg-red-50 p-2 rounded">{submitError}</p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-neutral-600 hover:bg-neutral-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Ingesting...
                    </>
                  ) : (
                    "Ingest Source"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: Source["status"] }) {
  if (status === "READY") {
    return (
      <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        Ready
      </span>
    );
  }

  if (status === "FAILED") {
    return (
      <span className="flex items-center gap-1 text-[11px] font-semibold text-red-700 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
        Failed
      </span>
    );
  }

  // QUEUED, EXTRACTING, EMBEDDING (Yellow pulsing indicator)
  return (
    <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
      {status.toLowerCase()}
    </span>
  );
}
