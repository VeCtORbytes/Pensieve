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
  status: "QUEUED" | "EXTRACTING" | "TRANSLATING" | "EMBEDDING" | "READY" | "FAILED";
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
        const data: Source[] = await res.json();
        setSources((prev) => {
          if (
            prev.length === data.length &&
            prev.every(
              (s, i) =>
                data[i] &&
                s.id === data[i].id &&
                s.status === data[i].status &&
                s.chunkCount === data[i].chunkCount
            )
          ) {
            return prev;
          }
          return data;
        });
      }
    } catch (err) {
      console.error("Failed to fetch sources:", err);
    }
  }, [notebookId]);

  useEffect(() => {
    fetchSources();

    const hasActiveProcessing = sources.some((s) =>
      ["QUEUED", "EXTRACTING", "TRANSLATING", "EMBEDDING"].includes(s.status)
    );

    if (!hasActiveProcessing) return;

    const interval = setInterval(fetchSources, 3000);
    return () => clearInterval(interval);
  }, [fetchSources, sources]);

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
      className={`flex flex-col h-full bg-vessel relative transition ${
        isDraggingOver ? "ring-2 ring-inset ring-accent bg-blue-50/40" : ""
      }`}
    >
      {/* Drag Over Overlay */}
      {isDraggingOver && (
        <div className="absolute inset-0 z-30 bg-accent/10 backdrop-blur-2xs flex flex-col items-center justify-center text-center p-4">
          <Upload className="w-8 h-8 text-accent animate-bounce mb-2" />
          <p className="text-xs font-semibold text-accent">Drop files here to ingest into Pensieve</p>
        </div>
      )}

      {/* Quiet Rail Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-rule">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-ink/60">
          Sources ({sources.length})
        </span>
        <button
          type="button"
          onClick={() => {
            resetForm();
            setIsModalOpen(true);
          }}
          className="p-1.5 text-xs text-ink hover:bg-rule rounded-lg transition cursor-pointer"
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
                  <span className="font-medium text-ink truncate group-hover:text-accent">
                    {s.title}
                  </span>
                </div>

                {/* Always visible on touch, where there is no hover to reveal them. */}
                <div className="flex items-center gap-1 transition md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100">
                  <button
                    type="button"
                    title="Re-index source"
                    aria-label={`Re-index ${s.title}`}
                    disabled={actionSourceId === s.id}
                    onClick={(e) => handleReindexSource(e, s.id)}
                    className="p-1 text-neutral-400 hover:text-neutral-700 rounded transition cursor-pointer"
                  >
                    <RotateCw className={`w-3 h-3 ${actionSourceId === s.id ? "animate-spin" : ""}`} />
                  </button>
                  <button
                    type="button"
                    title="Delete source"
                    aria-label={`Delete ${s.title}`}
                    disabled={actionSourceId === s.id}
                    onClick={(e) => handleDeleteSource(e, s.id)}
                    className="p-1 text-neutral-400 hover:text-red-600 rounded transition cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 text-[10px] text-neutral-400 font-mono pl-3.5">
                <span className="uppercase">{s.type}</span>
                <span className="shrink-0">
                  {s.status === "READY"
                    ? `${s.chunkCount} ${s.chunkCount === 1 ? "chunk" : "chunks"}`
                    : s.status.toLowerCase()}
                </span>
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
          notebookId={notebookId}
          onClose={() => setSelectedViewerSource(null)}
        />
      )}

      {/* Add Source Modal Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl max-w-xl w-full p-6 shadow-2xl space-y-5 border border-rule">
            <div className="flex items-center justify-between border-b border-rule pb-3">
              <h3 className="text-base font-serif-display font-normal text-ink">Add Knowledge Source</h3>
              <button
                type="button"
                onClick={handleCloseModal}
                className="text-neutral-400 hover:text-neutral-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tab navigation */}
            <div className="flex border-b border-rule text-xs overflow-x-auto">
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
                        ? "border-accent text-accent"
                        : "border-transparent text-neutral-500 hover:text-ink"
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
                  className="w-full px-3 py-2 text-xs border border-rule rounded-lg outline-none focus:ring-2 focus:ring-accent"
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
                    className="w-full px-3 py-2 text-xs border border-rule rounded-lg outline-none focus:ring-2 focus:ring-accent"
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
                    className="w-full px-3 py-2 text-xs border border-rule rounded-lg outline-none focus:ring-2 focus:ring-accent"
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
                    className="w-full px-3 py-2 text-xs font-mono border border-rule rounded-lg outline-none focus:ring-2 focus:ring-accent"
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
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-ink hover:bg-accent rounded-lg disabled:opacity-50 cursor-pointer transition"
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
    return <span className="w-2 h-2 rounded-full bg-accent shrink-0" title="Ready" />;
  }
  if (status === "FAILED") {
    return <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" title="Failed" />;
  }
  return <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" title="Processing" />;
}
