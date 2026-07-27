"use client";

import { useState, useEffect } from "react";
import {
  X,
  Scissors,
  Cpu,
  Database,
  Search,
  Bot,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  ArrowRight,
  Layers,
  Waypoints,
} from "lucide-react";

const PIPELINE_STEPS = [
  {
    id: 1,
    title: "Document Extraction & Chunking",
    subtitle: "Raw Document → Sliced Locators",
    icon: Scissors,
    color: "text-blue-600 bg-blue-50 border-blue-200",
    description: "Raw PDFs, YouTube transcripts, and articles are parsed and sliced into 500-character overlapping chunks with exact page/timestamp locators.",
  },
  {
    id: 2,
    title: "Dense Vector Embedding",
    subtitle: "Text Chunks → 1,536D Floating-Point Vectors",
    icon: Cpu,
    color: "text-purple-600 bg-purple-50 border-purple-200",
    description: "OpenAI text-embedding-3-small converts each text chunk into a high-dimensional vector space representing deep semantic meaning.",
  },
  {
    id: 3,
    title: "Qdrant Vector DB Indexing",
    subtitle: "HNSW Graph Indexing & Payload Storage",
    icon: Database,
    color: "text-emerald-600 bg-emerald-50 border-emerald-200",
    description: "Vectors are indexed into Qdrant Cloud HNSW graph nodes alongside metadata payloads (source title, type, locators) for sub-50ms search.",
  },
  {
    id: 4,
    title: "Cosine Similarity Vector Search",
    subtitle: "User Prompt → Top-K Vector Matches",
    icon: Search,
    color: "text-amber-600 bg-amber-50 border-amber-200",
    description: "The user prompt is embedded into vector space and compared against stored point vectors using Cosine similarity matching.",
  },
  {
    id: 5,
    title: "Grounded Answer Generation & Citation",
    subtitle: "Context Chunks → Fact-Grounded Stream",
    icon: Bot,
    color: "text-indigo-600 bg-indigo-50 border-indigo-200",
    description: "Retrieved chunks are passed to OpenAI gpt-4o-mini with a strict anti-hallucination system prompt to stream answers with exact bracket locators [1], [2].",
  },
];

export default function IngestionPipelineVisualizer({
  onClose,
}: {
  onClose: () => void;
}) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isPlaying, setIsPlaying] = useState(true);
  const [simulatedVector, setSimulatedVector] = useState<number[]>([]);

  // Generate random simulated vector floats
  useEffect(() => {
    const randomVec = Array.from({ length: 16 }, () => +(Math.random() * 2 - 1).toFixed(4));
    setSimulatedVector(randomVec);
  }, [currentStep]);

  // Auto-play step animation
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev % PIPELINE_STEPS.length) + 1);
    }, 4500);
    return () => clearInterval(interval);
  }, [isPlaying]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl border border-rule text-ink flex flex-col max-h-[90vh] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-rule pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-accent/10 border border-accent/20 text-accent">
              <Waypoints className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-ink">
                Pipeline Visualizer
              </h2>
              <p className="text-[11px] text-neutral-500">
                Step-by-step walkthrough of ingestion, vectorization, and retrieval
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsPlaying(!isPlaying)}
              title={isPlaying ? "Pause Auto Animation" : "Play Auto Animation"}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-vessel hover:bg-neutral-100 border border-rule text-xs font-semibold text-ink transition cursor-pointer"
            >
              {isPlaying ? (
                <>
                  <Pause className="w-3.5 h-3.5 text-amber-600" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Auto Play</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              title="Reset Animation"
              className="p-2 text-neutral-400 hover:text-ink hover:bg-vessel rounded-xl transition cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-neutral-400 hover:text-ink hover:bg-vessel rounded-xl transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Step Progress Nodes */}
        <div className="grid grid-cols-5 gap-2 pt-4 pb-2 border-b border-rule">
          {PIPELINE_STEPS.map((step) => {
            const isActive = currentStep === step.id;
            const isCompleted = currentStep > step.id;
            const StepIcon = step.icon;

            return (
              <button
                key={step.id}
                type="button"
                onClick={() => {
                  setCurrentStep(step.id);
                  setIsPlaying(false);
                }}
                className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between space-y-2 relative overflow-hidden ${
                  isActive
                    ? "bg-white border-accent shadow-md ring-2 ring-accent/20"
                    : isCompleted
                    ? "bg-vessel border-found/40 text-neutral-600"
                    : "bg-vessel border-rule text-neutral-400"
                }`}
              >
                {isActive && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-accent" />
                )}

                <div className="flex items-center justify-between">
                  <div className={`p-1.5 rounded-lg border text-xs ${step.color}`}>
                    <StepIcon className="w-3.5 h-3.5" />
                  </div>
                  {isCompleted ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-found" />
                  ) : (
                    <span className="text-[10px] font-mono text-neutral-400">Step {step.id}</span>
                  )}
                </div>

                <div>
                  <h4 className="text-[11px] font-semibold truncate leading-tight">
                    {step.title.split(" ")[0]} {step.title.split(" ")[1]}
                  </h4>
                </div>
              </button>
            );
          })}
        </div>

        {/* Interactive Dynamic Stage Graphic Canvas */}
        <div className="flex-1 my-4 p-6 bg-vessel rounded-2xl border border-rule flex flex-col justify-between overflow-y-auto space-y-4 relative">
          {/* Header Info */}
          <div className="flex items-start justify-between gap-4 border-b border-rule pb-3">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white border border-rule text-[10px] font-semibold text-accent uppercase tracking-wider">
                Stage {currentStep} of 5
              </div>
              <h3 className="text-sm font-semibold text-ink mt-1">
                {PIPELINE_STEPS[currentStep - 1].title}
              </h3>
              <p className="text-xs text-neutral-500 mt-0.5 leading-relaxed">
                {PIPELINE_STEPS[currentStep - 1].description}
              </p>
            </div>
          </div>

          {/* STAGE 1 ANIMATION GRAPHIC */}
          {currentStep === 1 && (
            <div className="space-y-4 py-2 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between text-xs font-mono text-neutral-500">
                <span>Raw Source PDF Document</span>
                <Scissors className="w-4 h-4 text-blue-600 animate-bounce" />
                <span>Indexed 500-Character Chunks</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-white rounded-xl border border-blue-200 shadow-xs space-y-1.5">
                  <span className="text-[10px] font-mono font-semibold bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200">
                    Chunk #1 · Page 1
                  </span>
                  <p className="text-[11px] text-neutral-600 font-mono line-clamp-3">
                    "Quantum computing harnesses superposition and entanglement to execute parallel calculations..."
                  </p>
                </div>
                <div className="p-3 bg-white rounded-xl border border-blue-200 shadow-xs space-y-1.5">
                  <span className="text-[10px] font-mono font-semibold bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200">
                    Chunk #2 · Page 2
                  </span>
                  <p className="text-[11px] text-neutral-600 font-mono line-clamp-3">
                    "Qubits exist in combinations of 0 and 1 simultaneously, enabling exponential speedups..."
                  </p>
                </div>
                <div className="p-3 bg-white rounded-xl border border-blue-200 shadow-xs space-y-1.5">
                  <span className="text-[10px] font-mono font-semibold bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200">
                    Chunk #3 · Page 3
                  </span>
                  <p className="text-[11px] text-neutral-600 font-mono line-clamp-3">
                    "Applications include cryptography, material discovery, and financial portfolio optimization..."
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STAGE 2 ANIMATION GRAPHIC */}
          {currentStep === 2 && (
            <div className="space-y-4 py-2 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between text-xs font-mono text-neutral-500">
                <span>Text Chunk</span>
                <ArrowRight className="w-4 h-4 text-purple-600" />
                <span className="text-purple-600 font-bold">OpenAI text-embedding-3-small</span>
                <ArrowRight className="w-4 h-4 text-purple-600" />
                <span>1,536-Dimensional Dense Array</span>
              </div>

              <div className="p-4 bg-white rounded-2xl border border-purple-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-purple-700 flex items-center gap-1.5">
                    <Cpu className="w-4 h-4 text-purple-600 animate-spin" />
                    Simulated Vector Matrix Array [1536]
                  </span>
                  <span className="font-mono text-[10px] text-neutral-400">Dimensions: 1536 x 32-bit float</span>
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5 font-mono text-[10px] text-center">
                  {simulatedVector.map((val, idx) => (
                    <div
                      key={idx}
                      className="p-1.5 bg-purple-50 text-purple-800 rounded border border-purple-200 animate-pulse"
                      style={{ animationDelay: `${idx * 80}ms` }}
                    >
                      {val > 0 ? `+${val}` : val}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STAGE 3 ANIMATION GRAPHIC */}
          {currentStep === 3 && (
            <div className="space-y-4 py-2 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between text-xs font-mono text-neutral-500">
                <span>Dense Embeddings</span>
                <Database className="w-4 h-4 text-emerald-600 animate-pulse" />
                <span>Qdrant Cloud Collection: notebook_chunks</span>
              </div>

              <div className="p-4 bg-white rounded-2xl border border-emerald-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between text-xs border-b border-emerald-100 pb-2">
                  <span className="font-semibold text-emerald-700 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-emerald-600" />
                    HNSW Vector Graph Nodes
                  </span>
                  <span className="font-mono text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-semibold">
                    Indexed Payload: notebookId
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                  <div className="p-2.5 bg-vessel rounded-xl border border-emerald-200 flex items-center justify-between">
                    <span className="text-neutral-700">Point ID: #q18f2a</span>
                    <span className="text-found font-semibold">Payload Attached ✓</span>
                  </div>
                  <div className="p-2.5 bg-vessel rounded-xl border border-emerald-200 flex items-center justify-between">
                    <span className="text-neutral-700">Point ID: #q94b1c</span>
                    <span className="text-found font-semibold">Payload Attached ✓</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STAGE 4 ANIMATION GRAPHIC */}
          {currentStep === 4 && (
            <div className="space-y-4 py-2 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between text-xs font-mono text-neutral-500">
                <span>User Prompt Vector</span>
                <Search className="w-4 h-4 text-amber-600 animate-bounce" />
                <span>Cosine Distance Matrix</span>
              </div>

              <div className="p-4 bg-white rounded-2xl border border-amber-200 shadow-xs space-y-2 text-xs">
                <div className="flex items-center justify-between font-medium text-amber-800">
                  <span>Candidate Chunk Match</span>
                  <span>Cosine Similarity Score</span>
                </div>

                {[
                  { title: "Quantum Superposition & Qubits", score: 0.8842, match: true },
                  { title: "Entanglement Principles", score: 0.7615, match: true },
                  { title: "Classical Binary Bits Comparison", score: 0.5412, match: false },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 bg-vessel rounded-xl border border-rule flex items-center justify-between"
                  >
                    <span className="font-medium text-ink truncate max-w-xs">{item.title}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-neutral-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-500 rounded-full"
                          style={{ width: `${item.score * 100}%` }}
                        />
                      </div>
                      <span className="font-mono text-xs font-bold text-amber-600">
                        {item.score.toFixed(4)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STAGE 5 ANIMATION GRAPHIC */}
          {currentStep === 5 && (
            <div className="space-y-4 py-2 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between text-xs font-mono text-neutral-500">
                <span>Top-6 Filtered Chunks</span>
                <Bot className="w-4 h-4 text-indigo-600" />
                <span>OpenAI gpt-4o-mini Fact Stream</span>
              </div>

              <div className="p-4 bg-white rounded-2xl border border-indigo-200 shadow-xs space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-indigo-700">
                  <Bot className="w-4 h-4 text-indigo-600" />
                  <span>Streamed Fact-Grounded Output</span>
                </div>
                <p className="text-xs text-ink leading-relaxed font-sans font-medium bg-vessel p-3 rounded-xl border border-rule">
                  Quantum computing harnesses quantum bits or qubits <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold text-found bg-found/10 border border-found/30">[1]</span>. Key principles include superposition and entanglement <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold text-found bg-found/10 border border-found/30">[2]</span>.
                </p>
              </div>
            </div>
          )}

          {/* Navigation Bar */}
          <div className="flex items-center justify-between pt-2 border-t border-rule">
            <button
              type="button"
              disabled={currentStep === 1}
              onClick={() => {
                setCurrentStep((prev) => Math.max(1, prev - 1));
                setIsPlaying(false);
              }}
              className="px-4 py-2 rounded-xl bg-white border border-rule hover:border-accent text-xs font-semibold text-ink transition disabled:opacity-40 cursor-pointer shadow-xs"
            >
              Back
            </button>

            <span className="text-xs font-mono text-neutral-500">
              Step <strong className="text-accent">{currentStep}</strong> of 5
            </span>

            <button
              type="button"
              onClick={() => {
                setCurrentStep((prev) => (prev % PIPELINE_STEPS.length) + 1);
                setIsPlaying(false);
              }}
              className="flex items-center gap-1 px-4 py-2 rounded-xl bg-ink hover:bg-accent text-xs font-semibold text-white transition cursor-pointer shadow-xs"
            >
              <span>{currentStep === 5 ? "Replay" : "Next Step"}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
