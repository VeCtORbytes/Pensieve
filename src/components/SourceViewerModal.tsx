"use client";

import { useState, useEffect, useRef } from "react";
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
} from "lucide-react";
import { Locator } from "@/lib/locator";

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
  locator?: Locator | null;
  initialPage?: number;
  initialTimestamp?: number;
  onClose: () => void;
}

export default function SourceViewerModal({
  source,
  locator,
  initialPage = 1,
  initialTimestamp = 0,
  onClose,
}: SourceViewerProps) {
  const targetPage = locator?.page || initialPage;
  const targetTimestamp = locator?.startSec ?? initialTimestamp;

  const [currentPage, setCurrentPage] = useState<number>(targetPage);
  const [startTime, setStartTime] = useState<number>(targetTimestamp);
  const [activeViewTab, setActiveViewTab] = useState<"viewer" | "text">("viewer");

  const markRef = useRef<HTMLElement>(null);

  // Auto-scroll highlighted text into view
  useEffect(() => {
    if (markRef.current) {
      setTimeout(() => {
        markRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 200);
    }
  }, [locator, activeViewTab]);

  // Extract YouTube Video ID
  const youtubeVideoId = getYouTubeVideoId(source.url || source.rawText);

  // PDF URL (prioritize stored blobUrl Data URL, then url, then rawText if Base64)
  const pdfUrl = source.blobUrl || source.url || (source.rawText?.startsWith("data:application/pdf") ? source.rawText : null);

  const fullText = source.rawText || "No text content available.";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 sm:p-6 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-4xl w-full h-[85vh] flex flex-col shadow-2xl overflow-hidden border border-neutral-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 bg-white">
          <div className="flex items-center gap-3">
            <TypeBadge type={source.type} />
            <div>
              <h3 className="text-sm font-semibold text-neutral-900 truncate max-w-md">
                {source.title}
              </h3>
              {source.url && (
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-neutral-400 hover:text-neutral-700 flex items-center gap-1 mt-0.5 truncate max-w-sm"
                >
                  <span className="truncate">{source.url}</span>
                  <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
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
                {pdfUrl ? (
                  <iframe
                    key={`pdf-${currentPage}`}
                    src={`${pdfUrl}#page=${currentPage}`}
                    className="w-full h-full border-0 rounded-xl shadow-xs bg-white"
                    title={source.title}
                  />
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
                  {source.rawText ? (
                    source.rawText.split("\n\n").map((chunkStr, idx) => (
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
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
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

              {locator && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center gap-2">
                  <Highlighter className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Target citation highlighted in text below.</span>
                </div>
              )}

              <div className="p-6 bg-white rounded-xl border border-neutral-200 shadow-xs font-sans text-xs text-neutral-800 leading-relaxed whitespace-pre-wrap">
                {renderExactHighlightedContent(fullText, locator, markRef)}
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
