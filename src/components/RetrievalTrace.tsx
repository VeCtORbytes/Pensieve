"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Layers, Filter, CheckCircle2, ShieldAlert } from "lucide-react";
import { RetrievalTracePayload } from "@/app/api/chat/route";

interface RetrievalTraceProps {
  trace: RetrievalTracePayload;
  isStreaming?: boolean;
}

export default function RetrievalTrace({ trace, isStreaming = false }: RetrievalTraceProps) {
  const [isExpanded, setIsExpanded] = useState<boolean>(!isStreaming);

  const keptCount = trace.candidates.filter((c) => c.kept).length;
  const candidateCount = trace.candidates.length;

  if (candidateCount === 0) {
    return (
      <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 text-xs text-neutral-500 flex items-center gap-2">
        <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" />
        <span>No vector candidates matched the query threshold across {trace.totalChunks} corpus chunks.</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50/60 overflow-hidden text-xs transition-all duration-200">
      {/* Summary Line Header (Expandable) */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3.5 py-2 flex items-center justify-between bg-neutral-100/70 hover:bg-neutral-100 text-neutral-700 font-mono transition cursor-pointer select-none"
      >
        <div className="flex items-center gap-2 font-medium">
          <Layers className="w-3.5 h-3.5 text-neutral-500" />
          <span>
            {trace.totalChunks} chunks → {candidateCount} candidates →{" "}
            <strong className="text-emerald-700">{keptCount} cited</strong>
          </span>
        </div>

        <div className="flex items-center gap-2 text-neutral-400">
          <span className="text-[10px] text-neutral-500">Floor: {trace.floor}</span>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </div>
      </button>

      {/* Expanded Animated Detailed Breakdown */}
      {isExpanded && (
        <div className="p-3.5 space-y-3 bg-white border-t border-neutral-200/80 animate-in fade-in duration-150">
          {/* Metrics Pill Grid */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 bg-neutral-50 rounded-lg border border-neutral-200/60">
              <div className="text-[10px] uppercase font-semibold text-neutral-400">Total Corpus</div>
              <div className="text-sm font-bold text-neutral-800 font-mono">{trace.totalChunks}</div>
            </div>

            <div className="p-2 bg-neutral-50 rounded-lg border border-neutral-200/60">
              <div className="text-[10px] uppercase font-semibold text-neutral-400">Retrieved</div>
              <div className="text-sm font-bold text-neutral-800 font-mono">{candidateCount}</div>
            </div>

            <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-200">
              <div className="text-[10px] uppercase font-semibold text-emerald-600">Relevance Filter</div>
              <div className="text-sm font-bold text-emerald-800 font-mono">{keptCount} kept</div>
            </div>
          </div>

          {/* Score Threshold Bar Graph */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-[11px] text-neutral-500 font-medium">
              <span className="flex items-center gap-1">
                <Filter className="w-3 h-3 text-neutral-400" /> Vector Similarity Scores
              </span>
              <span className="text-emerald-700 font-mono">Floor Cutoff: {trace.floor}</span>
            </div>

            <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
              {trace.candidates.map((cand, idx) => (
                <div key={idx} className="flex items-center gap-2 text-[11px]">
                  <span className="w-24 truncate text-neutral-600 font-medium">{cand.title}</span>
                  {cand.humanLocator && (
                    <span className="text-[10px] font-mono bg-neutral-100 px-1 rounded text-neutral-500 shrink-0">
                      {cand.humanLocator}
                    </span>
                  )}
                  <div className="flex-1 bg-neutral-100 rounded-full h-2 overflow-hidden relative">
                    <div
                      className={`h-full transition-all duration-300 ${
                        cand.kept ? "bg-emerald-500" : "bg-neutral-300 opacity-60"
                      }`}
                      style={{ width: `${Math.min(100, Math.max(5, cand.score * 100))}%` }}
                    />
                  </div>
                  <span
                    className={`w-10 text-right font-mono text-[10px] font-semibold ${
                      cand.kept ? "text-emerald-700" : "text-neutral-400 line-through"
                    }`}
                  >
                    {cand.score}
                  </span>
                  {cand.kept ? (
                    <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                  ) : (
                    <span className="w-3 h-3 block" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
