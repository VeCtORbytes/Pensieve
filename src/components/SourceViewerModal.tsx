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
  Highlighter,
  Languages,
  Loader2,
  AlertTriangle,
  Copy,
  Check,
  Download,
} from "lucide-react";
import { Locator, SegmentSpan, VariantKind } from "@/lib/locator";
import { spanForSegmentRange } from "@/lib/segments";
import { useReadingVariant } from "@/hooks/useReadingVariant";

type VariantOption = {
  kind: VariantKind;
  label: string;
  status: "READY" | "PENDING" | "GENERATING" | "FAILED";
  available: boolean;
};

export interface SourceViewerProps {
  source: {
    id: string;
    title: string;
    type: string; // "PDF" | "TEXT" | "WEBSITE" | "YOUTUBE" | "TRANSCRIPT"
    url?: string | null;
    blobUrl?: string | null;
    rawText?: string | null;
    createdAt?: string;
  };
  /** Enables the reading-language switcher, shared with the chat panel. */
  notebookId?: string;
  locator?: Locator | null;
  /** Variant the locator's character offsets belong to, when known. */
  locatorVariant?: VariantKind;
  initialPage?: number;
  initialTimestamp?: number;
  onClose: () => void;
}

export default function SourceViewerModal({
  source,
  notebookId,
  locator,
  locatorVariant,
  initialPage = 1,
  initialTimestamp = 0,
  onClose,
}: SourceViewerProps) {
  const targetPage = locator?.page || initialPage;
  const targetTimestamp = locator?.startSec ?? initialTimestamp;

  const [currentPage, setCurrentPage] = useState<number>(targetPage);
  const [startTime, setStartTime] = useState<number>(targetTimestamp);
  const [activeViewTab, setActiveViewTab] = useState<"viewer" | "text">("viewer");

  const { variant, select: selectVariant } = useReadingVariant(notebookId ?? "");
  const [options, setOptions] = useState<VariantOption[]>([]);
  const [variantText, setVariantText] = useState<string | null>(null);
  const [variantSpans, setVariantSpans] = useState<SegmentSpan[] | null>(null);
  const [variantLoading, setVariantLoading] = useState(false);
  const [variantError, setVariantError] = useState<string | null>(null);

  const markRef = useRef<HTMLElement>(null);

  // Which renderings this source can offer.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`/api/sources/${source.id}/variants`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data?.variants)) setOptions(data.variants);
      } catch {
        /* switcher stays hidden */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [source.id]);

  // Load the selected rendering. ORIGINAL uses stored rawText directly (0ms latency);
  // ENGLISH and ROMANIZED are fetched/generated on first request.
  useEffect(() => {
    let cancelled = false;

    if (variant === "ORIGINAL" && source.rawText) {
      setVariantText(source.rawText);
      setVariantSpans(null);
      setVariantLoading(false);
      setVariantError(null);
      return;
    }

    (async () => {
      setVariantLoading(true);
      setVariantError(null);

      try {
        const res = await fetch(`/api/sources/${source.id}/variants`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: variant }),
        });
        const data = await res.json();

        if (cancelled) return;

        if (!res.ok) {
          setVariantText(source.rawText ?? null);
          setVariantSpans(null);
          setVariantError(variant === "ORIGINAL" ? null : data?.error || "Could not load");
          return;
        }

        setVariantText(typeof data?.rawText === "string" ? data.rawText : source.rawText ?? null);
        setVariantSpans(Array.isArray(data?.spans) ? data.spans : null);
      } catch (err: any) {
        if (!cancelled) {
          setVariantText(source.rawText ?? null);
          setVariantSpans(null);
          setVariantError(variant === "ORIGINAL" ? null : err?.message || "Could not load");
        }
      } finally {
        if (!cancelled) setVariantLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [source.id, source.rawText, variant]);

  // Extract YouTube Video ID
  const youtubeVideoId = getYouTubeVideoId(source.url || source.rawText);

  // Convert Base64 Data URL or remote URL into browser-native Blob URL for PDF rendering
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (source.type !== "PDF") return;

    const rawPdf =
      source.blobUrl ||
      source.url ||
      (source.rawText?.startsWith("data:application/pdf") ? source.rawText : null);

    if (!rawPdf) {
      setPdfBlobUrl(null);
      return;
    }

    if (rawPdf.startsWith("data:application/pdf")) {
      try {
        const base64Data = rawPdf.split(",")[1];
        if (base64Data) {
          const binaryStr = atob(base64Data);
          const len = binaryStr.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }
          const blob = new Blob([bytes], { type: "application/pdf" });
          const createdUrl = URL.createObjectURL(blob);
          setPdfBlobUrl(createdUrl);

          return () => {
            URL.revokeObjectURL(createdUrl);
          };
        }
      } catch (err) {
        console.error("Failed to create PDF blob URL:", err);
        setPdfBlobUrl(rawPdf);
      }
    } else {
      setPdfBlobUrl(rawPdf);
    }
  }, [source]);

  const displayText = variantText ?? source.rawText ?? "";
  const fullText = displayText || "No text content available.";

  /**
   * Re-anchors the citation into whichever rendering is on screen.
   *
   * A citation's character offsets belong to the variant it was retrieved from,
   * so they cannot be used directly against a different translation. The segment
   * ordinals survive translation, so they are mapped through this variant's spans
   * instead. When ordinals are unavailable, the raw offsets are only trusted if
   * we are looking at the very variant they came from.
   */
  const effectiveLocator = useMemo<Locator | null>(() => {
    if (!locator) return null;

    if (variantSpans && locator.segStart !== undefined && locator.segEnd !== undefined) {
      const span = spanForSegmentRange(variantSpans, locator.segStart, locator.segEnd);
      if (span) return { ...locator, charStart: span[0], charEnd: span[1] };
    }

    if (locatorVariant && locatorVariant !== variant) return null;
    return locator;
  }, [locator, variantSpans, variant, locatorVariant]);

  // Auto-scroll highlighted text into view
  useEffect(() => {
    if (markRef.current) {
      setTimeout(() => {
        markRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 200);
    }
  }, [effectiveLocator, activeViewTab, variant]);

  const showSwitcher = options.length > 1;

  // PDF and video need a tall frame; text should size to its content so short
  // sources do not open into a mostly-empty sheet.
  const needsTallViewer = source.type === "PDF" || source.type === "YOUTUBE";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const [copied, setCopied] = useState(false);

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md animate-in fade-in duration-150 sm:p-6"
    >
      <div
        className={`flex h-full w-full flex-col overflow-hidden bg-[#111622] text-[#E6EDF3] shadow-2xl sm:max-w-4xl sm:rounded-3xl sm:border sm:border-[#222B3D] ${
          needsTallViewer ? "sm:h-[88vh]" : "sm:h-auto sm:max-h-[85vh]"
        }`}
      >
        {/* Modal Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#222B3D] bg-[#090D14] px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-3">
            <TypeBadge type={source.type} />
            <div className="min-w-0">
              <h3 className="max-w-full truncate text-sm font-semibold text-[#E6EDF3] sm:max-w-md">
                {source.title}
              </h3>
              {source.url && (
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-[#8B949E] hover:text-[#38BDF8] flex items-center gap-1 mt-0.5 truncate max-w-sm"
                >
                  <span className="truncate">{source.url}</span>
                  <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Copy Extracted Text Action Button */}
            {displayText && (
              <button
                type="button"
                onClick={handleCopyText}
                title="Copy Extracted Text"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#192030] hover:bg-[#222B3D] border border-[#222B3D] text-xs font-semibold text-[#E6EDF3] transition cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-[#38BDF8]" />
                    <span className="hidden sm:inline">Copy Text</span>
                  </>
                )}
              </button>
            )}
            {showSwitcher && (
              <div className="flex items-center gap-1.5">
                <Languages className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                <div className="flex bg-neutral-100 p-0.5 rounded-lg text-xs font-medium">
                  {options.map((option) => {
                    const active = option.kind === variant;
                    return (
                      <button
                        key={option.kind}
                        type="button"
                        onClick={() => selectVariant(option.kind)}
                        title={
                          option.available
                            ? option.label
                            : `${option.label} — generated on first use`
                        }
                        className={`px-2.5 py-1.5 rounded-md transition cursor-pointer flex items-center gap-1 ${
                          active
                            ? "bg-white text-neutral-900 shadow-xs"
                            : "text-neutral-500 hover:text-neutral-900"
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
              <div className="flex bg-neutral-100 p-0.5 rounded-lg text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setActiveViewTab("viewer")}
                  className={`px-3 py-1.5 rounded-md transition cursor-pointer ${
                    activeViewTab === "viewer"
                      ? "bg-white text-neutral-900 shadow-xs"
                      : "text-neutral-500 hover:text-neutral-900"
                  }`}
                >
                  {source.type === "PDF" ? "PDF View" : "Player"}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveViewTab("text")}
                  className={`px-3 py-1.5 rounded-md transition cursor-pointer ${
                    activeViewTab === "text"
                      ? "bg-white text-neutral-900 shadow-xs"
                      : "text-neutral-500 hover:text-neutral-900"
                  }`}
                >
                  Extracted Text
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-hidden bg-neutral-50/50 flex flex-col">
          {/* 1. PDF VIEWER */}
          {source.type === "PDF" && activeViewTab === "viewer" && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-6 py-2.5 bg-white border-b border-neutral-200 text-xs">
                <span className="text-neutral-500 font-medium">
                  Document Viewer (Page {currentPage})
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="p-1 text-neutral-600 hover:bg-neutral-100 rounded disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="font-semibold text-neutral-800">Page {currentPage}</span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => p + 1)}
                    className="p-1 text-neutral-600 hover:bg-neutral-100 rounded cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex-1 bg-neutral-100 p-4 overflow-hidden">
                {pdfBlobUrl ? (
                  <object
                    key={`pdf-${currentPage}`}
                    data={`${pdfBlobUrl}#page=${currentPage}`}
                    type="application/pdf"
                    className="w-full h-full border-0 rounded-xl shadow-xs bg-white"
                  >
                    <iframe
                      src={`${pdfBlobUrl}#page=${currentPage}`}
                      className="w-full h-full border-0 rounded-xl bg-white"
                      title={source.title}
                    />
                  </object>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-neutral-400 space-y-2">
                    <File className="w-10 h-10 text-neutral-300" />
                    <p className="text-xs">PDF preview unavailable. View extracted text tab above.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 2. YOUTUBE VIEWER */}
          {source.type === "YOUTUBE" && activeViewTab === "viewer" && (
            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 overflow-hidden">
              <div className="md:col-span-2 bg-black flex flex-col justify-center items-center p-4">
                {youtubeVideoId ? (
                  <div className="w-full aspect-video rounded-xl overflow-hidden shadow-2xl">
                    <iframe
                      key={`yt-${startTime}`}
                      src={`https://www.youtube.com/embed/${youtubeVideoId}?autoplay=1&start=${startTime}`}
                      className="w-full h-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      title={source.title}
                    />
                  </div>
                ) : (
                  <div className="text-center text-neutral-400 space-y-2">
                    <Video className="w-12 h-12 mx-auto text-neutral-600" />
                    <p className="text-xs">Could not load YouTube player.</p>
                  </div>
                )}
              </div>

              {/* Transcript Timestamps Sidebar */}
              <div className="border-l border-neutral-200 bg-white flex flex-col overflow-hidden">
                <div className="p-3 border-b border-neutral-100 text-xs font-semibold text-neutral-700 flex items-center gap-1.5">
                  <Play className="w-3.5 h-3.5 text-red-600" />
                  Interactive Transcript
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-2 text-xs">
                  {variantLoading && !displayText ? (
                    <p className="text-neutral-400 text-xs italic flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Preparing this language...
                    </p>
                  ) : displayText ? (
                    displayText.split("\n\n").map((chunkStr, idx) => (
                      <p key={idx} className="text-neutral-600 text-xs leading-relaxed border-b border-neutral-100 pb-2">
                        {chunkStr}
                      </p>
                    ))
                  ) : (
                    <p className="text-neutral-400 text-xs italic">No transcript content available.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 3. TEXT / VTT / WEBSITE / EXTRACTED TEXT VIEWER WITH EXACT LOCATOR HIGHLIGHT & AUTO-SCROLL */}
          {((source.type !== "PDF" && source.type !== "YOUTUBE") || activeViewTab === "text") && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4 sm:p-6">
              {source.type === "WEBSITE" && source.url && (
                <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl flex items-center justify-between text-xs text-blue-900">
                  <span className="truncate">Source URL: {source.url}</span>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 font-semibold hover:underline shrink-0"
                  >
                    Visit Website <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}

              {variantError && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-900 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>Could not load this language: {variantError}</span>
                </div>
              )}

              {locator && effectiveLocator && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center gap-2">
                  <Highlighter className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Target citation highlighted in text below.</span>
                </div>
              )}

              {locator && !effectiveLocator && (
                <div className="p-2.5 bg-neutral-100 border border-neutral-200 rounded-xl text-xs text-neutral-600 flex items-center gap-2">
                  <Highlighter className="w-4 h-4 text-neutral-400 shrink-0" />
                  <span>
                    This citation cannot be pinpointed in this language. Re-index the
                    source to enable cross-language highlighting.
                  </span>
                </div>
              )}

              <div className="p-6 bg-white rounded-xl border border-neutral-200 shadow-xs font-sans text-xs text-neutral-800 leading-relaxed whitespace-pre-wrap">
                {variantLoading && !displayText ? (
                  <span className="flex items-center gap-2 text-neutral-400 italic">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Preparing this language...
                  </span>
                ) : (
                  renderExactHighlightedContent(fullText, effectiveLocator, markRef)
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Highlights exact character slice: rawText.slice(locator.charStart, locator.charEnd)
 */
function renderExactHighlightedContent(
  fullText: string,
  locator?: Locator | null,
  ref?: React.RefObject<HTMLElement>
) {
  if (
    locator?.charStart !== undefined &&
    locator?.charEnd !== undefined &&
    locator.charStart >= 0 &&
    locator.charEnd <= fullText.length &&
    locator.charStart < locator.charEnd
  ) {
    const before = fullText.slice(0, locator.charStart);
    const matched = fullText.slice(locator.charStart, locator.charEnd);
    const after = fullText.slice(locator.charEnd);

    return (
      <>
        {before}
        <mark
          ref={ref as any}
          className="bg-amber-200 text-amber-950 font-semibold px-1 py-0.5 rounded shadow-xs border border-amber-300 inline"
        >
          {matched}
        </mark>
        {after}
      </>
    );
  }

  return fullText;
}

function TypeBadge({ type }: { type: string }) {
  let icon = <FileText className="w-3.5 h-3.5" />;
  let style = "bg-neutral-100 text-neutral-700 border-neutral-200";

  if (type === "PDF") {
    icon = <File className="w-3.5 h-3.5 text-red-600" />;
    style = "bg-red-50 text-red-700 border-red-200";
  } else if (type === "YOUTUBE") {
    icon = <Video className="w-3.5 h-3.5 text-red-600" />;
    style = "bg-red-50 text-red-700 border-red-200";
  } else if (type === "WEBSITE") {
    icon = <Link2 className="w-3.5 h-3.5 text-blue-600" />;
    style = "bg-blue-50 text-blue-700 border-blue-200";
  }

  return (
    <span
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold uppercase tracking-wider border ${style}`}
    >
      {icon}
      {type}
    </span>
  );
}

function getYouTubeVideoId(urlStr?: string | null): string | null {
  if (!urlStr) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = urlStr.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}
