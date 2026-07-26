"use client";

import { useState, useEffect, useMemo } from "react";
import { ChevronDown, ChevronUp, Layers, ShieldAlert, Sparkles, Wand2 } from "lucide-react";
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

  useEffect(() => {
    if (reduced) return;
    const t = [
      setTimeout(() => setStage(1), 200),
      setTimeout(() => setStage(2), 1100),
      setTimeout(() => setStage(3), 1700),
    ];
    return () => t.forEach((id) => clearTimeout(id));
  }, [reduced]);

  useEffect(() => {
    if (!isStreaming && stage === 3) {
      const t = setTimeout(() => setOpen(false), 1400);
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
      ? "expanding multi-query & generating HyDE..."
      : stage === 1
      ? `fusing parallel vector hits (${trace.candidates.length} candidates)...`
      : stage === 2
      ? "applying RRF reciprocal rank fusion..."
      : `${trace.totalChunks} chunks → ${trace.candidates.length} candidates → ${kept} cited`;

  if (trace.candidates.length === 0) {
    return (
      <div className="p-3 bg-[#F5F7F8] rounded-xl border border-[#E2E7EA] text-xs text-neutral-500 flex items-center gap-2">
        <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
        <span>No vector candidates matched the query threshold across {trace.totalChunks} corpus chunks.</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#E2E7EA] bg-white overflow-hidden text-xs transition-all duration-200 shadow-2xs">
      {/* Header Bar */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="w-full px-3.5 py-2.5 flex items-center justify-between gap-2 bg-[#F5F7F8] hover:bg-neutral-100 font-mono text-[#141A22] transition cursor-pointer select-none"
      >
        <span className="flex min-w-0 items-center gap-2 font-medium">
          <Layers className={`w-3.5 h-3.5 shrink-0 ${stage < 3 ? "animate-pulse text-[#3B4CC0]" : "text-[#1D9E75]"}`} />
          <span className="truncate">{label}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2 text-[10px] text-neutral-500">
          <span className="hidden sm:inline bg-[#3B4CC0]/10 px-2 py-0.5 rounded border border-[#3B4CC0]/20 text-[#3B4CC0] font-semibold">
            RRF Fused
          </span>
          {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </span>
      </button>

      {/* Expanded Inspector Panel */}
      {open && (
        <div className="p-3.5 space-y-3 bg-white border-t border-[#E2E7EA] animate-in fade-in duration-150">
          {/* Step-Back Concept Pill */}
          {trace.stepBackQuery && (
            <div className="p-2.5 bg-[#F5F7F8] border border-[#3B4CC0]/20 rounded-xl space-y-1 text-xs">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold text-[#3B4CC0] uppercase tracking-wider">
                <Wand2 className="w-3 h-3 text-[#3B4CC0]" />
                <span>Step-Back Conceptual Query</span>
              </div>
              <p className="text-xs text-[#141A22] font-medium leading-relaxed">
                "{trace.stepBackQuery}"
              </p>
            </div>
          )}

          {/* HyDE Passage Badge */}
          {trace.hydePassage && (
            <div className="p-2.5 bg-[#F5F7F8] border border-[#0969DA]/20 rounded-xl space-y-1 text-xs">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold text-[#0969DA] uppercase tracking-wider">
                <Sparkles className="w-3 h-3 text-[#0969DA]" />
                <span>HyDE Hypothetical Passage</span>
              </div>
              <p className="text-xs text-neutral-600 italic leading-relaxed">
                "{trace.hydePassage}"
              </p>
            </div>
          )}

          {/* Fused Candidates List */}
          <div className="space-y-1.5 pt-1">
            {shown.map((c, i) => (
              <div key={i} className="flex items-center gap-2 text-[11px]">
                <span className="w-20 shrink-0 truncate text-[#141A22] font-medium sm:w-28">
                  {c.title}
                </span>
                {c.humanLocator && (
                  <span className="hidden text-[10px] font-mono bg-[#F5F7F8] border border-[#E2E7EA] px-1.5 py-0.5 rounded text-neutral-500 shrink-0 sm:inline">
                    {c.humanLocator}
                  </span>
                )}
                {c.variant && c.variant !== "ORIGINAL" && (
                  <span
                    className="text-[10px] font-mono bg-[#3B4CC0]/10 text-[#3B4CC0] px-1.5 py-0.5 rounded shrink-0 border border-[#3B4CC0]/20"
                    title={`Matched against the ${c.variant.toLowerCase()} rendering`}
                  >
                    {c.variant === "ENGLISH" ? "en" : "rom"}
                  </span>
                )}
                {c.duplicateOf && (
                  <span
                    className="text-[10px] font-mono bg-[#F5F7F8] text-neutral-400 px-1.5 py-0.5 rounded shrink-0"
                    title={`Same passage as a ${c.duplicateOf.toLowerCase()} hit; deduped`}
                  >
                    dup
                  </span>
                )}
                <div className="flex-1 h-2 bg-[#F5F7F8] border border-[#E2E7EA] rounded-full relative overflow-hidden">
                  <div
                    className={`h-full origin-left rounded-full transition-[transform,background-color] duration-500 ${
                      stage >= 2 && c.kept
                        ? "bg-[#3B4CC0]"
                        : stage >= 2
                        ? "bg-neutral-200"
                        : "bg-neutral-300"
                    }`}
                    style={{
                      width: `${(c.score / top) * 100}%`,
                      transform: stage >= 1 ? "scaleX(1)" : "scaleX(0)",
                      transitionDelay: `${i * 35}ms`,
                      opacity: stage >= 2 && !c.kept ? 0.4 : 1,
                    }}
                  />
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-[#3B4CC0] transition-opacity duration-300 z-10"
                    style={{ left: `${floorPct}%`, opacity: stage >= 2 ? 1 : 0 }}
                    title={`Cutoff: ${trace.floor.toFixed(2)}`}
                  />
                </div>
                <span
                  className={`w-12 text-right font-mono text-[10px] font-semibold ${
                    stage >= 2 && !c.kept ? "text-neutral-400 line-through opacity-50" : "text-[#141A22]"
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
        </div>
      )}
    </div>
  );
}
