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
      setTimeout(() => setStage(1), 300),
      setTimeout(() => setStage(2), 1200),
      setTimeout(() => setStage(3), 1800),
    ];
    return () => t.forEach((id) => clearTimeout(id));
  }, [reduced]);

  useEffect(() => {
    if (!isStreaming && stage === 3) {
      const t = setTimeout(() => setOpen(false), 2000);
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

  const spellLabel =
    stage === 0
      ? "🪄 Accio Memories! Expanding multi-query & generating HyDE..."
      : stage === 1
      ? `🔮 Swirling Pensieve Currents... Fusing ${trace.candidates.length} vector memories...`
      : stage === 2
      ? "✨ RRF Rank Fusion Spell... Filtering highest relevance memory wisps..."
      : `⚡ Revelio Insight! ${trace.totalChunks} chunks → ${kept} cited memories`;

  if (trace.candidates.length === 0) {
    return (
      <div className="p-3 bg-vessel rounded-xl border border-rule text-xs text-neutral-500 flex items-center gap-2">
        <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
        <span>No vector candidates matched the memory threshold across {trace.totalChunks} corpus chunks.</span>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#3B4CC0]/30 bg-gradient-to-b from-[#141A22] to-[#1E2638] text-white overflow-hidden text-xs transition-all duration-300 shadow-lg">
      {/* 3D Harry Potter Pensieve Header Bar */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="w-full px-4 py-3 flex items-center justify-between gap-3 bg-[#141A22]/90 hover:bg-[#141A22] font-mono text-white transition cursor-pointer select-none border-b border-[#3B4CC0]/20"
      >
        <span className="flex min-w-0 items-center gap-2.5 font-medium">
          <div className="relative flex items-center justify-center">
            <Wand2 className={`w-4 h-4 text-amber-400 shrink-0 ${stage < 3 ? "animate-bounce" : ""}`} />
            {stage < 3 && (
              <span className="absolute -inset-1 rounded-full bg-amber-400/30 animate-ping" />
            )}
          </div>
          <span className="truncate text-xs font-semibold text-slate-100">{spellLabel}</span>
        </span>

        <span className="flex shrink-0 items-center gap-2 text-[10px]">
          <span className="bg-gradient-to-r from-amber-500/20 to-[#3B4CC0]/40 border border-amber-400/30 text-amber-300 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1 shadow-2xs">
            <Sparkles className="w-3 h-3 text-amber-300 animate-spin" />
            Pensieve RAG
          </span>
          {open ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
        </span>
      </button>

      {/* 3D Memory Basin Visualizer Panel */}
      {open && (
        <div className="p-4 space-y-4 bg-[#141A22]/95 border-t border-[#3B4CC0]/20 backdrop-blur-md animate-in fade-in duration-200">
          {/* 3D Pensieve Fluid Animation Container */}
          <div className="relative w-full h-20 rounded-2xl overflow-hidden bg-gradient-to-r from-[#0B0F17] via-[#1A233A] to-[#0B0F17] border border-[#3B4CC0]/40 flex items-center justify-center shadow-inner">
            {/* Swirling Luminescent Silver Memory Wisps */}
            <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-400 via-indigo-600 to-transparent animate-pulse" />
            
            {/* Animated Wand Stream Particles */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-48 h-12 rounded-full border border-amber-300/30 bg-amber-400/5 blur-xs animate-spin" style={{ animationDuration: "8s" }} />
              <div className="absolute w-36 h-8 rounded-full border border-blue-300/40 bg-blue-500/10 blur-xs animate-spin" style={{ animationDuration: "5s", animationDirection: "reverse" }} />
            </div>

            {/* Glowing Text Overlay */}
            <div className="relative z-10 text-center space-y-0.5">
              <p className="text-[11px] font-serif-display font-medium text-amber-200 tracking-wide flex items-center justify-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                Pensieve Memory Vector Chamber
              </p>
              <p className="text-[10px] font-mono text-slate-300">
                {trace.totalChunks} Corpus Segments Processed · {kept} High-Confidence Wisps Extracted
              </p>
            </div>
          </div>

          {/* Step-Back Concept Pill */}
          {trace.stepBackQuery && (
            <div className="p-3 bg-[#1A233A] border border-[#3B4CC0]/40 rounded-xl space-y-1 text-xs">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold text-amber-400 uppercase tracking-wider">
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span>Step-Back Conceptual Query Spell</span>
              </div>
              <p className="text-xs text-slate-200 font-medium leading-relaxed">
                "{trace.stepBackQuery}"
              </p>
            </div>
          )}

          {/* HyDE Passage Badge */}
          {trace.hydePassage && (
            <div className="p-3 bg-[#1A233A] border border-blue-400/30 rounded-xl space-y-1 text-xs">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold text-blue-300 uppercase tracking-wider">
                <span>HyDE Hypothetical Memory Wisp</span>
              </div>
              <p className="text-xs text-slate-300 italic leading-relaxed">
                "{trace.hydePassage}"
              </p>
            </div>
          )}

          {/* Fused Candidates Memory Wisps */}
          <div className="space-y-2 pt-1">
            <div className="text-[10px] font-mono font-semibold uppercase text-slate-400 tracking-wider flex items-center justify-between">
              <span>Retrieved Memory Candidates</span>
              <span>RRF Relevance Score</span>
            </div>

            {shown.map((c, i) => (
              <div key={i} className="flex items-center gap-2 text-[11px]">
                <span className="w-24 shrink-0 truncate text-slate-200 font-semibold sm:w-32">
                  {c.title}
                </span>

                {c.humanLocator && (
                  <span className="hidden text-[10px] font-mono bg-[#0B0F17] border border-[#3B4CC0]/30 px-1.5 py-0.5 rounded text-amber-300 shrink-0 sm:inline">
                    {c.humanLocator}
                  </span>
                )}

                {c.variant && c.variant !== "ORIGINAL" && (
                  <span
                    className="text-[10px] font-mono bg-indigo-900/60 text-indigo-200 px-1.5 py-0.5 rounded shrink-0 border border-indigo-500/30"
                    title={`Matched against ${c.variant.toLowerCase()} rendering`}
                  >
                    {c.variant === "ENGLISH" ? "en" : "rom"}
                  </span>
                )}

                {c.duplicateOf && (
                  <span
                    className="text-[10px] font-mono bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded shrink-0"
                    title="Duplicate passage deduped"
                  >
                    dup
                  </span>
                )}

                {/* 3D Glowing Silver Bar */}
                <div className="flex-1 h-2.5 bg-[#0B0F17] border border-[#3B4CC0]/30 rounded-full relative overflow-hidden">
                  <div
                    className={`h-full origin-left rounded-full transition-[transform,background-color] duration-500 ${
                      stage >= 2 && c.kept
                        ? "bg-gradient-to-r from-amber-400 to-[#3B4CC0] shadow-xs"
                        : stage >= 2
                        ? "bg-slate-700"
                        : "bg-slate-600"
                    }`}
                    style={{
                      width: `${(c.score / top) * 100}%`,
                      transform: stage >= 1 ? "scaleX(1)" : "scaleX(0)",
                      transitionDelay: `${i * 35}ms`,
                      opacity: stage >= 2 && !c.kept ? 0.3 : 1,
                    }}
                  />
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-amber-400 transition-opacity duration-300 z-10"
                    style={{ left: `${floorPct}%`, opacity: stage >= 2 ? 1 : 0 }}
                    title={`Cutoff: ${trace.floor.toFixed(2)}`}
                  />
                </div>

                <span
                  className={`w-12 text-right font-mono text-[10px] font-semibold ${
                    stage >= 2 && !c.kept ? "text-slate-500 line-through opacity-50" : "text-amber-300"
                  }`}
                >
                  {c.score.toFixed(3)}
                </span>
              </div>
            ))}

            {hidden > 0 && (
              <p className="pt-1 text-[10px] text-slate-400 font-mono text-center">
                +{hidden} more memory wisps below relevance cutoff
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
