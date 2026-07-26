"use client";

import { useState, useEffect, useMemo } from "react";
import { ChevronDown, ChevronUp, Layers, ShieldAlert } from "lucide-react";
import { RetrievalTracePayload } from "@/app/api/chat/route";

export default function RetrievalTrace({
  trace,
  isStreaming = false,
}: {
  trace: RetrievalTracePayload;
  isStreaming?: boolean;
}) {
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const [stage, setStage] = useState(reduced ? 3 : 0);
  const [open, setOpen] = useState(true);

  // Staged reveal animation pipeline
  useEffect(() => {
    if (reduced) return;
    const t = [
      setTimeout(() => setStage(1), 200),
      setTimeout(() => setStage(2), 1100),
      setTimeout(() => setStage(3), 1700),
    ];
    return () => t.forEach((id) => clearTimeout(id));
  }, [reduced]);

  // Auto-collapse 1.2s after streaming completes in Stage 3
  useEffect(() => {
    if (!isStreaming && stage === 3) {
      const t = setTimeout(() => setOpen(false), 1200);
      return () => clearTimeout(t);
    }
  }, [isStreaming, stage]);

  const top = useMemo(
    () => Math.max(...trace.candidates.map((c) => c.score), 0.001),
    [trace]
  );

  const kept = trace.candidates.filter((c) => c.kept).length;
  const shown = trace.candidates.slice(0, 8);
  const hidden = trace.candidates.length - shown.length;
  const floorPct = Math.min(100, (trace.floor / top) * 100);

  const label =
    stage === 0
      ? "embedding your question..."
      : stage === 1
      ? `scoring ${trace.candidates.length} candidates...`
      : stage === 2
      ? "applying relevance cutoff..."
      : `${trace.totalChunks} chunks → ${trace.candidates.length} candidates → ${kept} cited`;

  if (trace.candidates.length === 0) {
    return (
      <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 text-xs text-neutral-500 flex items-center gap-2">
        <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" />
        <span>No vector candidates matched the query threshold across {trace.totalChunks} corpus chunks.</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50/60 overflow-hidden text-xs transition-all duration-200">
      {/* Header Bar */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="w-full px-3 py-2 flex items-center justify-between gap-2 bg-neutral-100/70 hover:bg-neutral-100 font-mono text-neutral-700 transition cursor-pointer select-none sm:px-3.5"
      >
        <span className="flex min-w-0 items-center gap-2 font-medium">
          <Layers className={`w-3.5 h-3.5 shrink-0 ${stage < 3 ? "animate-pulse text-accent" : "text-neutral-500"}`} />
          <span className="truncate">{label}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2 text-[10px] text-neutral-500">
          <span className="hidden sm:inline">cutoff {trace.floor.toFixed(2)}</span>
          {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </span>
      </button>

      {/* Expanded Animated Rows */}
      {open && (
        <div className="p-3 space-y-1 bg-white border-t border-neutral-200/80 animate-in fade-in duration-150 sm:p-3.5">
          {shown.map((c, i) => (
            <div key={i} className="flex items-center gap-2 text-[11px]">
              <span className="w-16 shrink-0 truncate text-neutral-600 font-medium sm:w-24">
                {c.title}
              </span>
              {c.humanLocator && (
                <span className="hidden text-[10px] font-mono bg-neutral-100 px-1 rounded text-neutral-500 shrink-0 sm:inline">
                  {c.humanLocator}
                </span>
              )}
              {c.variant && c.variant !== "ORIGINAL" && (
                <span
                  className="text-[10px] font-mono bg-accent/10 text-accent-fg px-1 rounded shrink-0"
                  title={`Matched against the ${c.variant.toLowerCase()} rendering`}
                >
                  {c.variant === "ENGLISH" ? "en" : "rom"}
                </span>
              )}
              {c.duplicateOf && (
                <span
                  className="text-[10px] font-mono bg-neutral-100 text-neutral-400 px-1 rounded shrink-0"
                  title={`Same passage as a ${c.duplicateOf.toLowerCase()} hit; deduped`}
                >
                  dup
                </span>
              )}
              <div className="flex-1 h-2 bg-neutral-100 rounded-full relative overflow-hidden">
                <div
                  className={`h-full origin-left rounded-full transition-[transform,background-color] duration-500 ${
                    stage >= 2 && c.kept
                      ? "bg-accent"
                      : stage >= 2
                      ? "bg-neutral-300 opacity-60"
                      : "bg-neutral-400"
                  }`}
                  style={{
                    width: `${(c.score / top) * 100}%`,
                    transform: stage >= 1 ? "scaleX(1)" : "scaleX(0)",
                    transitionDelay: `${i * 35}ms`,
                    opacity: stage >= 2 && !c.kept ? 0.4 : 1,
                  }}
                />
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-accent transition-opacity duration-300 z-10"
                  style={{ left: `${floorPct}%`, opacity: stage >= 2 ? 1 : 0 }}
                  title={`Cutoff: ${trace.floor.toFixed(2)}`}
                />
              </div>
              <span
                className={`w-10 text-right font-mono text-[10px] font-semibold ${
                  stage >= 2 && !c.kept ? "text-neutral-400 line-through" : "text-neutral-700"
                }`}
              >
                {c.score.toFixed(3)}
              </span>
            </div>
          ))}
          {hidden > 0 && (
            <p className="pt-1 text-[10px] text-neutral-400 font-mono text-center">
              +{hidden} more candidates below cutoff
            </p>
          )}
        </div>
      )}
    </div>
  );
}
