"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, FileText, Upload, Link2, Video, File, Loader2, X, Trash2, RotateCw } from "lucide-react";
import SourceViewerModal from "@/components/SourceViewerModal";

interface Source {
  id: string;
  notebookId: string;
  type: string;
  title: string;
  url?: string | null;
  blobUrl?: string | null;
  rawText?: string | null;
  status: "QUEUED" | "EXTRACTING" | "EMBEDDING" | "READY" | "FAILED";
  error?: string | null;
  chunkCount: number;
  createdAt: string;
}

export type TabType = "text" | "vtt" | "pdf" | "website" | "youtube";

interface SourcePanelProps {
  notebookId: string;
  initialOpenModal?: boolean;
  initialTab?: TabType;
  onModalClose?: () => void;
}

export default function SourcePanel({
  notebookId,
  initialOpenModal = false,
  initialTab = "text",
  onModalClose,
}: SourcePanelProps) {
  const router = useRouter();

  const [sources, setSources] = useState<Source[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(initialOpenModal);
  const [selectedViewerSource, setSelectedViewerSource] = useState<Source | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [actionSourceId, setActionSourceId] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Form states
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [url, setUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (initialOpenModal) setIsModalOpen(true);
  }, [initialOpenModal]);

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

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

  function handleCloseModal() {
    setIsModalOpen(false);
    resetForm();
    if (onModalClose) onModalClose();
  }

  async function handleBatchUploadFiles(files: FileList) {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const name = file.name.replace(/\.[^/.]+$/, "");
      const ext = file.name.split(".").pop()?.toLowerCase();

      let type = "TEXT";
      if (ext === "pdf") type = "PDF";
      if (ext === "vtt") type = "TRANSCRIPT";

      const reader = new FileReader();
      reader.onload = async (e) => {
        const contentData = (e.target?.result as string) || "";
        try {
          await fetch("/api/sources", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              notebookId,
              type,
              title: name,
              content: contentData,
            }),
          });
          await fetchSources();
          router.refresh();
        } catch (err) {
          console.error("Failed batch file upload:", err);
        }
      };

      if (ext === "pdf") reader.readAsDataURL(file);
      else reader.readAsText(file);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleBatchUploadFiles(e.dataTransfer.files);
    }
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
      if (onModalClose) onModalClose();

      await fetchSources();
      router.refresh();
    } catch (err: any) {
      setSubmitError(err.message || "Failed to add source");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteSource(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (!confirm("Delete this source and its vector embeddings?")) return;

    try {
      setActionSourceId(id);
      const res = await fetch(`/api/sources?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        await fetchSources();
        router.refresh();
      }
    } catch (err) {
      console.error("Failed to delete source:", err);
    } finally {
      setActionSourceId(null);
    }
  }

  async function handleReindexSource(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    try {
      setActionSourceId(id);
      const res = await fetch(`/api/sources/${id}/reindex`, {
        method: "POST",
      });
      if (res.ok) {
        await fetchSources();
        router.refresh();
      }
    } catch (err) {
      console.error("Failed to re-index source:", err);
    } finally {
      setActionSourceId(null);
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
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDraggingOver(true);
      }}
      onDragLeave={() => setIsDraggingOver(false)}
      onDrop={handleDrop}
      className={`flex flex-col h-full bg-[#F5F7F8] relative transition ${
        isDraggingOver ? "ring-2 ring-inset ring-[#3B4CC0] bg-blue-50/40" : ""
      }`}
    >
      {/* Drag Over Overlay */}
      {isDraggingOver && (
        <div className="absolute inset-0 z-30 bg-[#3B4CC0]/10 backdrop-blur-2xs flex flex-col items-center justify-center text-center p-4">
          <Upload className="w-8 h-8 text-[#3B4CC0] animate-bounce mb-2" />
          <p className="text-xs font-semibold text-[#3B4CC0]">Drop files here to ingest into Pensieve</p>
        </div>
      )}

      {/* Quiet Rail Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#E2E7EA]">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#141A22]/60">
          Sources ({sources.length})
        </span>
        <button
          type="button"
          onClick={() => {
            resetForm();
            setIsModalOpen(true);
          }}
          className="p-1.5 text-xs text-[#141A22] hover:bg-[#E2E7EA] rounded-lg transition cursor-pointer"
          title="Add Source"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Source List */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
        {sources.length === 0 ? (
          <div className="py-8 text-center text-neutral-400">
            <p className="text-xs text-neutral-500">No sources added yet.</p>
            <p className="text-[10px] text-neutral-400 mt-1">Drag and drop PDF or VTT files here.</p>
          </div>
        ) : (
          sources.map((s) => (
            <div
              key={s.id}
              onClick={() => setSelectedViewerSource(s)}
              className="group p-2.5 rounded-lg hover:bg-white transition cursor-pointer space-y-1 text-xs"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 truncate flex-1">
                  <StatusDot status={s.status} />
                  <span className="font-medium text-[#141A22] truncate group-hover:text-[#3B4CC0]">
                    {s.title}
                  </span>
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button
                    type="button"
                    title="Re-index Source"
                    disabled={actionSourceId === s.id}
                    onClick={(e) => handleReindexSource(e, s.id)}
                    className="p-1 text-neutral-400 hover:text-neutral-700 rounded transition cursor-pointer"
                  >
                    <RotateCw className={`w-3 h-3 ${actionSourceId === s.id ? "animate-spin" : ""}`} />
                  </button>
                  <button
                    type="button"
                    title="Delete Source"
                    disabled={actionSourceId === s.id}
                    onClick={(e) => handleDeleteSource(e, s.id)}
                    className="p-1 text-neutral-400 hover:text-red-600 rounded transition cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-[10px] text-neutral-400 font-mono pl-3.5">
                <span className="uppercase">{s.type}</span>
                <span>{s.status === "READY" ? `${s.chunkCount} chunks` : s.status.toLowerCase()}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Source Viewer Modal */}
      {selectedViewerSource && (
        <SourceViewerModal
          source={{
            id: selectedViewerSource.id,
            title: selectedViewerSource.title,
            type: selectedViewerSource.type,
            url: selectedViewerSource.url,
            blobUrl: selectedViewerSource.blobUrl,
            rawText: selectedViewerSource.rawText,
            createdAt: selectedViewerSource.createdAt,
          }}
          onClose={() => setSelectedViewerSource(null)}
        />
      )}

      {/* Add Source Modal Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl max-w-xl w-full p-6 shadow-2xl space-y-5 border border-[#E2E7EA]">
            <div className="flex items-center justify-between border-b border-[#E2E7EA] pb-3">
              <h3 className="text-base font-serif-display font-normal text-[#141A22]">Add Knowledge Source</h3>
              <button
                type="button"
                onClick={handleCloseModal}
                className="text-neutral-400 hover:text-neutral-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tab navigation */}
            <div className="flex border-b border-[#E2E7EA] text-xs overflow-x-auto">
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
                    className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-medium transition whitespace-nowrap cursor-pointer ${
                      activeTab === tab.id
                        ? "border-[#3B4CC0] text-[#3B4CC0]"
                        : "border-transparent text-neutral-500 hover:text-[#141A22]"
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
                  placeholder="e.g. Technical Manual / Lecture Video"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-[#E2E7EA] rounded-lg outline-none focus:ring-2 focus:ring-[#3B4CC0]"
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
                    className="w-full text-xs text-neutral-500 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-neutral-100 file:text-neutral-700 hover:file:bg-neutral-200 cursor-pointer"
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
                    className="w-full px-3 py-2 text-xs border border-[#E2E7EA] rounded-lg outline-none focus:ring-2 focus:ring-[#3B4CC0]"
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
                    className="w-full px-3 py-2 text-xs border border-[#E2E7EA] rounded-lg outline-none focus:ring-2 focus:ring-[#3B4CC0]"
                  />
                </div>
              )}

              {/* VTT Tab */}
              {activeTab === "vtt" && (
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Select .vtt File
                  </label>
                  <input
                    type="file"
                    accept=".vtt,.txt"
                    onChange={handleVttUpload}
                    className="w-full text-xs text-neutral-500 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-neutral-100 file:text-neutral-700 hover:file:bg-neutral-200 cursor-pointer"
                  />
                </div>
              )}

              {/* Text Area */}
              {(activeTab === "text" || activeTab === "vtt") && (
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Content Text
                  </label>
                  <textarea
                    required
                    rows={5}
                    placeholder="Paste text or notes..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono border border-[#E2E7EA] rounded-lg outline-none focus:ring-2 focus:ring-[#3B4CC0]"
                  />
                </div>
              )}

              {submitError && (
                <p className="text-xs text-red-600 bg-red-50 p-2 rounded">{submitError}</p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-xs font-medium text-neutral-600 hover:bg-neutral-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#141A22] hover:bg-[#3B4CC0] rounded-lg disabled:opacity-50 cursor-pointer transition"
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

function StatusDot({ status }: { status: Source["status"] }) {
  if (status === "READY") {
    return <span className="w-2 h-2 rounded-full bg-[#1D9E75] shrink-0" title="Ready" />;
  }
  if (status === "FAILED") {
    return <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" title="Failed" />;
  }
  return <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" title="Processing" />;
}
