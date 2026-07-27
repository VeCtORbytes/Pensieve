"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import {
  X,
  ExternalLink,
  FileText,
  Video,
  File,
  Link2,
  ChevronLeft,
  ChevronRight,
  Play,
  Languages,
  Loader2,
  AlertTriangle,
  Copy,
  Check,
} from "lucide-react";
import { Locator, SegmentSpan, VariantKind } from "@/lib/locator";
import { spanForSegmentRange, parseSegmentSpans } from "@/lib/segments";
import { useReadingVariant } from "@/hooks/useReadingVariant";

type VariantOption = {
  kind: VariantKind;
  label: string;
  status: "READY" | "PENDING" | "GENERATING" | "FAILED";
  available: boolean;
};

const languageOptions: { kind: VariantKind; label: string }[] = [
  { kind: "ORIGINAL", label: "Original" },
  { kind: "ENGLISH", label: "English" },
  { kind: "ROMANIZED", label: "Romanized" },
];

export interface SourceViewerProps {
  source: {
    id: string;
    title: string;
    type: string;
    url?: string | null;
    blobUrl?: string | null;
    rawText?: string | null;
    createdAt: string;
  };
  notebookId: string;
  locator?: Locator | null;
  onClose: () => void;
}

export default function SourceViewerModal({
  source,
  notebookId,
  locator,
  onClose,
}: SourceViewerProps) {
  const [activeViewTab, setActiveViewTab] = useState<"viewer" | "text">("viewer");
  const [currentPage, setCurrentPage] = useState(locator?.page || 1);
  const markRef = useRef<HTMLElement>(null);
  const [copied, setCopied] = useState(false);

  const { variant, select } = useReadingVariant(notebookId);

  const [availableVariants, setAvailableVariants] = useState<
    Record<string, { status: string; text?: string; spans?: any }>
  >({});
  const [variantLoading, setVariantLoading] = useState(false);
  const [variantError, setVariantError] = useState<string | null>(null);

  // The source list/command palette only carry lightweight fields (no blobUrl/
  // rawText, to keep polling cheap), so fetch the full row here when neither was
  // provided. The citation-click path always supplies rawText (the cited excerpt)
  // and intentionally skips this fetch to keep showing just that excerpt.
  const [fetchedSource, setFetchedSource] = useState<{
    url?: string | null;
    blobUrl?: string | null;
    rawText?: string | null;
  } | null>(null);

  useEffect(() => {
    if (source.rawText != null || source.blobUrl != null) return;
    let isMounted = true;

    fetch(`/api/sources/${source.id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data) setFetchedSource(data);
      })
      .catch((err) => console.error("Failed to load full source content:", err));

    return () => {
      isMounted = false;
    };
  }, [source.id, source.rawText, source.blobUrl]);

  const effectiveUrl = fetchedSource?.url ?? source.url;
  const effectiveBlobUrl = fetchedSource?.blobUrl ?? source.blobUrl;

  useEffect(() => {
    let isMounted = true;
    async function loadVariantAvailability() {
      try {
        const res = await fetch(`/api/sources/${source.id}/variants`);
        if (res.ok && isMounted) {
          const data = await res.json();
          setAvailableVariants(data.variants || {});
        }
      } catch (err) {
        console.error("Failed loading variants list:", err);
      }
    }
    loadVariantAvailability();
    return () => {
      isMounted = false;
    };
  }, [source.id]);

  useEffect(() => {
    let isMounted = true;
    if (variant === "ORIGINAL") {
      setVariantError(null);
      setVariantLoading(false);
      return;
    }

    async function fetchOrGenerateVariant() {
      try {
        setVariantLoading(true);
        setVariantError(null);

        const res = await fetch(`/api/sources/${source.id}/variants`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ variant }),
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Failed to load variant");
        }

        const data = await res.json();
        if (isMounted) {
          setAvailableVariants((prev) => ({
            ...prev,
            [variant]: { status: "READY", text: data.text, spans: data.spans },
          }));
        }
      } catch (err: any) {
        if (isMounted) setVariantError(err.message);
      } finally {
        if (isMounted) setVariantLoading(false);
      }
    }

    fetchOrGenerateVariant();
    return () => {
      isMounted = false;
    };
  }, [variant, source.id]);

  const options: VariantOption[] = useMemo(() => {
    return languageOptions.map((opt) => {
      const info = availableVariants[opt.kind];
      const status = (info?.status as VariantOption["status"]) || "PENDING";
      return {
        kind: opt.kind,
        label: opt.label,
        status,
        available: status === "READY" || opt.kind === "ORIGINAL",
      };
    });
  }, [availableVariants]);

  const rawText = (fetchedSource?.rawText ?? source.rawText) || "";
  const activeVariantText = availableVariants[variant]?.text || null;
  const displayText = variant === "ORIGINAL" ? rawText : activeVariantText || rawText;

  const effectiveLocator = useMemo(() => {
    if (!locator) return null;
    return locator;
  }, [locator]);

  const activeSpan: SegmentSpan | null = useMemo(() => {
    if (!effectiveLocator) return null;

    // The ORIGINAL variant's char offsets are already on the locator itself —
    // no need for a segment-spans fetch (which never happens for ORIGINAL; that
    // request is only ever made for the ENGLISH/ROMANIZED variants below).
    if (variant === "ORIGINAL") {
      return [effectiveLocator.charStart, effectiveLocator.charEnd];
    }

    const start = effectiveLocator.segStart;
    const end = effectiveLocator.segEnd;
    if (start === undefined || end === undefined) return null;
    const parsedSpans = parseSegmentSpans(availableVariants[variant]?.spans);
    return spanForSegmentRange(parsedSpans, start, end);
  }, [displayText, availableVariants, variant, effectiveLocator]);

  useEffect(() => {
    if (markRef.current) {
      setTimeout(() => {
        markRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 200);
    }
  }, [effectiveLocator, activeViewTab, variant]);

  const showSwitcher = options.length > 1;
  const needsTallViewer = source.type === "PDF" || source.type === "YOUTUBE";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handleCopyText() {
    if (!displayText) return;
    navigator.clipboard.writeText(displayText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={source.title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs animate-in fade-in duration-150 sm:p-6"
    >
      <div
        className={`flex h-full w-full flex-col overflow-hidden bg-white shadow-2xl sm:max-w-4xl sm:rounded-3xl sm:border sm:border-rule ${
          needsTallViewer ? "sm:h-[88vh]" : "sm:h-auto sm:max-h-[85vh]"
        }`}
      >
        {/* Modal Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule bg-white px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-3">
            <TypeBadge type={source.type} />
            <div className="min-w-0">
              <h3 className="max-w-full truncate text-sm font-semibold text-ink sm:max-w-md">
                {source.title}
              </h3>
              {effectiveUrl && (
                <a
                  href={effectiveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-neutral-500 hover:text-accent flex items-center gap-1 mt-0.5 truncate max-w-sm"
                >
                  <span className="truncate">{effectiveUrl}</span>
                  <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Copy Extracted Text Button */}
            {displayText && (
              <button
                type="button"
                onClick={handleCopyText}
                title="Copy Extracted Text"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-vessel hover:bg-neutral-100 border border-rule text-xs font-semibold text-ink transition cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-found" />
                    <span className="text-found">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-accent" />
                    <span className="hidden sm:inline">Copy Text</span>
                  </>
                )}
              </button>
            )}

            {showSwitcher && (
              <div className="flex items-center gap-1.5">
                <Languages className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                <div className="flex bg-vessel p-0.5 rounded-full border border-rule text-xs font-medium">
                  {options.map((option) => {
                    const active = option.kind === variant;
                    return (
                      <button
                        key={option.kind}
                        type="button"
                        onClick={() => select(option.kind)}
                        className={`px-2.5 py-1.5 rounded-full transition cursor-pointer flex items-center gap-1 ${
                          active
                            ? "bg-white text-ink font-semibold shadow-xs"
                            : "text-neutral-500 hover:text-ink"
                        }`}
                      >
                        {active && variantLoading && (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        )}
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {(source.type === "PDF" || source.type === "YOUTUBE") && (
              <div className="flex bg-vessel p-0.5 rounded-full border border-rule text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setActiveViewTab("viewer")}
                  className={`px-3 py-1.5 rounded-full transition cursor-pointer ${
                    activeViewTab === "viewer"
                      ? "bg-white text-ink font-semibold shadow-xs"
                      : "text-neutral-500 hover:text-ink"
                  }`}
                >
                  {source.type === "PDF" ? "PDF View" : "Player"}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveViewTab("text")}
                  className={`px-3 py-1.5 rounded-full transition cursor-pointer ${
                    activeViewTab === "text"
                      ? "bg-white text-ink font-semibold shadow-xs"
                      : "text-neutral-500 hover:text-ink"
                  }`}
                >
                  Extracted Text
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-neutral-400 hover:text-ink hover:bg-vessel rounded-xl transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-hidden bg-white flex flex-col">
          {/* 1. PDF VIEWER */}
          {source.type === "PDF" && activeViewTab === "viewer" && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-6 py-2.5 bg-vessel border-b border-rule text-xs">
                <span className="text-neutral-500 font-medium">
                  Document Viewer (Page {currentPage})
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p: number) => Math.max(1, p - 1))}
                    className="p-1 text-neutral-600 hover:bg-white rounded disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="font-mono text-xs font-semibold">{currentPage}</span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p: number) => p + 1)}
                    className="p-1 text-neutral-600 hover:bg-white rounded cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex-1 bg-vessel relative flex items-center justify-center p-4">
                {effectiveBlobUrl || effectiveUrl ? (
                  <object
                    data={`${effectiveBlobUrl || effectiveUrl}#page=${currentPage}`}
                    type="application/pdf"
                    className="w-full h-full rounded-xl border border-rule shadow-inner bg-white"
                  >
                    <iframe
                      src={`${effectiveBlobUrl || effectiveUrl}#page=${currentPage}`}
                      className="w-full h-full rounded-xl border border-rule"
                    />
                  </object>
                ) : (
                  <div className="text-center text-neutral-400 space-y-2">
                    <AlertTriangle className="w-8 h-8 mx-auto text-amber-500" />
                    <p className="text-xs">PDF preview object not available.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 2. YOUTUBE VIDEO PLAYER */}
          {source.type === "YOUTUBE" && activeViewTab === "viewer" && (
            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 overflow-hidden">
              <div className="md:col-span-2 bg-black flex items-center justify-center relative">
                {effectiveUrl ? (
                  <iframe
                    src={getYouTubeEmbedUrl(effectiveUrl, locator?.startSec)}
                    className="w-full h-full min-h-[300px]"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <div className="text-white text-xs">No video URL available</div>
                )}
              </div>

              <div className="border-l border-rule bg-white flex flex-col overflow-hidden">
                <div className="p-3 border-b border-rule text-xs font-semibold text-ink flex items-center gap-1.5">
                  <Play className="w-3.5 h-3.5 text-red-600" />
                  Interactive Transcript
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-2 text-xs">
                  {displayText ? (
                    displayText.split("\n\n").map((chunkStr, idx) => (
                      <p key={idx} className="text-neutral-600 text-xs leading-relaxed border-b border-rule pb-2">
                        {chunkStr}
                      </p>
                    ))
                  ) : (
                    <p className="text-neutral-400 text-xs italic">No transcript available.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 3. TEXT / EXTRACTED TEXT VIEWER */}
          {((source.type !== "PDF" && source.type !== "YOUTUBE") || activeViewTab === "text") && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4 sm:p-6 bg-white">
              {variantError && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-900 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>Could not load this language: {variantError}</span>
                </div>
              )}

              {activeSpan ? (
                <div className="prose max-w-none text-xs sm:text-sm font-sans leading-relaxed text-ink whitespace-pre-wrap">
                  {displayText.substring(0, activeSpan[0])}
                  <mark
                    ref={markRef}
                    className="bg-emerald-100 text-ink border-b-2 border-found px-1 py-0.5 rounded transition-all duration-300"
                  >
                    {displayText.substring(activeSpan[0], activeSpan[1])}
                  </mark>
                  {displayText.substring(activeSpan[1])}
                </div>
              ) : (
                <div className="prose max-w-none text-xs sm:text-sm font-sans leading-relaxed text-ink whitespace-pre-wrap">
                  {displayText}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TypeBadge({ type }: { type: string }) {
  let color = "bg-neutral-100 text-neutral-700 border-neutral-200";
  let Icon = FileText;

  if (type === "PDF") {
    color = "bg-red-50 text-red-700 border-red-200";
    Icon = File;
  } else if (type === "YOUTUBE") {
    color = "bg-red-50 text-red-700 border-red-200";
    Icon = Video;
  } else if (type === "WEBSITE") {
    color = "bg-blue-50 text-blue-700 border-blue-200";
    Icon = Link2;
  }

  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold ${color}`}>
      <Icon className="w-3.5 h-3.5" />
      <span>{type}</span>
    </div>
  );
}

function getYouTubeEmbedUrl(urlStr: string, startSec?: number): string {
  try {
    let videoId = "";
    if (urlStr.includes("v=")) {
      videoId = urlStr.split("v=")[1].split("&")[0];
    } else if (urlStr.includes("youtu.be/")) {
      videoId = urlStr.split("youtu.be/")[1].split("?")[0];
    }

    return `https://www.youtube.com/embed/${videoId}?autoplay=1${startSec ? `&start=${startSec}` : ""}`;
  } catch (e) {
    return urlStr;
  }
}
