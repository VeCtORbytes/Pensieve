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
      <div className="p-3 bg-[#111622] rounded-xl border border-[#222B3D] text-xs text-[#8B949E] flex items-center gap-2">
        <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" />
        <span>No vector candidates matched the query threshold across {trace.totalChunks} corpus chunks.</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#222B3D] bg-[#111622]/80 overflow-hidden text-xs transition-all duration-200 shadow-md">
      {/* Header Bar */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="w-full px-3.5 py-2.5 flex items-center justify-between gap-2 bg-[#090D14]/90 hover:bg-[#111622] font-mono text-[#E6EDF3] transition cursor-pointer select-none"
      >
        <span className="flex min-w-0 items-center gap-2 font-medium">
          <Layers className={`w-3.5 h-3.5 shrink-0 ${stage < 3 ? "animate-pulse text-[#8B5CF6]" : "text-[#38BDF8]"}`} />
          <span className="truncate">{label}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2 text-[10px] text-[#8B949E]">
          <span className="hidden sm:inline bg-[#8B5CF6]/10 px-2 py-0.5 rounded border border-[#8B5CF6]/30 text-[#8B5CF6] font-semibold">
            RRF Fused
          </span>
          {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </span>
      </button>

      {/* Expanded Inspector Panel */}
      {open && (
        <div className="p-3.5 space-y-3 bg-[#090D14] border-t border-[#222B3D] animate-in fade-in duration-150">
          {/* Step-Back Concept Pill */}
          {trace.stepBackQuery && (
            <div className="p-2.5 bg-[#111622] border border-[#8B5CF6]/30 rounded-xl space-y-1 text-xs">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold text-[#8B5CF6] uppercase tracking-wider">
                <Wand2 className="w-3 h-3 text-[#8B5CF6]" />
                <span>Step-Back Conceptual Query</span>
              </div>
              <p className="text-xs text-[#E6EDF3] font-medium leading-relaxed">
                "{trace.stepBackQuery}"
              </p>
            </div>
          )}

          {/* HyDE Passage Badge */}
          {trace.hydePassage && (
            <div className="p-2.5 bg-[#111622] border border-[#38BDF8]/30 rounded-xl space-y-1 text-xs">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold text-[#38BDF8] uppercase tracking-wider">
                <Sparkles className="w-3 h-3 text-[#38BDF8]" />
                <span>HyDE Hypothetical Passage</span>
              </div>
              <p className="text-xs text-[#8B949E] italic leading-relaxed">
                "{trace.hydePassage}"
              </p>
            </div>
          )}

          {/* Fused Candidates List */}
          <div className="space-y-1.5 pt-1">
            {shown.map((c, i) => (
              <div key={i} className="flex items-center gap-2 text-[11px]">
                <span className="w-20 shrink-0 truncate text-[#E6EDF3] font-medium sm:w-28">
                  {c.title}
                </span>
                {c.humanLocator && (
                  <span className="hidden text-[10px] font-mono bg-[#111622] border border-[#222B3D] px-1.5 py-0.5 rounded text-[#8B949E] shrink-0 sm:inline">
                    {c.humanLocator}
                  </span>
                )}
                {c.variant && c.variant !== "ORIGINAL" && (
                  <span
                    className="text-[10px] font-mono bg-[#8B5CF6]/20 text-[#8B5CF6] px-1.5 py-0.5 rounded shrink-0 border border-[#8B5CF6]/30"
                    title={`Matched against the ${c.variant.toLowerCase()} rendering`}
                  >
                    {c.variant === "ENGLISH" ? "en" : "rom"}
                  </span>
                )}
                {c.duplicateOf && (
                  <span
                    className="text-[10px] font-mono bg-[#111622] text-[#8B949E] px-1.5 py-0.5 rounded shrink-0"
                    title={`Same passage as a ${c.duplicateOf.toLowerCase()} hit; deduped`}
                  >
                    dup
                  </span>
                )}
                <div className="flex-1 h-2 bg-[#111622] border border-[#222B3D] rounded-full relative overflow-hidden">
                  <div
                    className={`h-full origin-left rounded-full transition-[transform,background-color] duration-500 ${
                      stage >= 2 && c.kept
                        ? "bg-gradient-to-r from-[#8B5CF6] to-[#38BDF8]"
                        : stage >= 2
                        ? "bg-[#222B3D]"
                        : "bg-[#37435B]"
                    }`}
                    style={{
                      width: `${(c.score / top) * 100}%`,
                      transform: stage >= 1 ? "scaleX(1)" : "scaleX(0)",
                      transitionDelay: `${i * 35}ms`,
                      opacity: stage >= 2 && !c.kept ? 0.4 : 1,
                    }}
                  />
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-[#8B5CF6] transition-opacity duration-300 z-10"
                    style={{ left: `${floorPct}%`, opacity: stage >= 2 ? 1 : 0 }}
                    title={`Cutoff: ${trace.floor.toFixed(2)}`}
                  />
                </div>
                <span
                  className={`w-12 text-right font-mono text-[10px] font-semibold ${
                    stage >= 2 && !c.kept ? "text-[#8B949E] line-through opacity-50" : "text-[#38BDF8]"
                  }`}
                >
                  {c.score.toFixed(3)}
                </span>
              </div>
            ))}
            {hidden > 0 && (
              <p className="pt-1 text-[10px] text-[#8B949E] font-mono text-center">
                +{hidden} more candidates below cutoff
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
