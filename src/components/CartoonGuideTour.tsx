"use client";

import { useState, useEffect } from "react";
import { Sparkles, X, ChevronRight, ChevronLeft, Check } from "lucide-react";

export interface TourStep {
  id: number;
  page: "home" | "notebook";
  targetSelector?: string;
  position: "top" | "bottom" | "left" | "right" | "center";
  title: string;
  text: string;
  badge: string;
}

const tourSteps: TourStep[] = [
  {
    id: 1,
    page: "home",
    position: "top",
    badge: "Step 1: Get Started",
    title: "Create Your First Notebook! 🚀",
    text: "Type a title (like 'Physics Notes' or 'Market Research') and click Create Notebook to build your AI knowledge space!",
  },
  {
    id: 2,
    page: "notebook",
    position: "right",
    badge: "Step 2: Add Knowledge",
    title: "Upload Your Sources! 📥",
    text: "Drag & drop PDFs, paste web links, YouTube videos, or text files. Pensieve indexes them into smart vector chunks!",
  },
  {
    id: 3,
    page: "notebook",
    position: "bottom",
    badge: "Step 3: Ask & Verify",
    title: "Chat with Grounded Citations! 💬",
    text: "Ask questions in any language. Every answer links inline citation chips [1] that jump directly to exact text & video timestamps!",
  },
  {
    id: 4,
    page: "notebook",
    position: "left",
    badge: "Step 4: AI Tools & Notes",
    title: "Studio Briefings & Scratchpad! ⚡",
    text: "Open the Studio panel to generate Executive Briefings, Multi-Language Flashcards, Mind Maps, and pin key insights to your Notes!",
  },
];

export default function CartoonGuideTour({ page }: { page: "home" | "notebook" }) {
  const [activeStepIndex, setActiveStepIndex] = useState<number | null>(null);
  const [dismissedPages, setDismissedPages] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Find initial step for this page
    const firstStepForPage = tourSteps.findIndex((s) => s.page === page);
    if (firstStepForPage !== -1 && !dismissedPages[page]) {
      setActiveStepIndex(firstStepForPage);
    }
  }, [page, dismissedPages]);

  if (activeStepIndex === null) {
    return (
      <button
        type="button"
        onClick={() => {
          const stepIdx = tourSteps.findIndex((s) => s.page === page);
          setActiveStepIndex(stepIdx !== -1 ? stepIdx : 0);
        }}
        title="Show Cartoon AI Guide"
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full bg-white text-black font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] border-2 border-black hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer group animate-bounce"
      >
        <Sparkles className="w-4 h-4 text-amber-500" />
        <span className="text-xs">AI Guide Speech Bubble</span>
      </button>
    );
  }

  const step = tourSteps[activeStepIndex];
  const currentIndex = activeStepIndex;

  function handleNext() {
    const nextIdx = currentIndex + 1;
    if (nextIdx < tourSteps.length && tourSteps[nextIdx].page === page) {
      setActiveStepIndex(nextIdx);
    } else {
      setActiveStepIndex(null);
    }
  }

  function handlePrev() {
    if (currentIndex > 0) {
      setActiveStepIndex(currentIndex - 1);
    }
  }

  function handleDismiss() {
    setDismissedPages((prev) => ({ ...prev, [page]: true }));
    setActiveStepIndex(null);
  }

  return (
    <div className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-50 max-w-sm w-full p-2 animate-in zoom-in-95 duration-200">
      {/* Cartoon Speech Bubble Outer Container with Comic Shadow & Pointer Tail */}
      <div className="relative bg-white border-3 border-black rounded-[2rem] p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] text-black">
        {/* Comic Speech Bubble Tail */}
        <div className="absolute -bottom-3 right-10 w-6 h-6 bg-white border-r-3 border-b-3 border-black transform rotate-45" />

        {/* Header Badge & Close Button */}
        <div className="flex items-center justify-between gap-2 pb-2.5 border-b-2 border-black/10">
          <div className="flex items-center gap-2">
            <span className="bg-amber-300 text-black border-2 border-black text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              {step.badge}
            </span>
            <span className="text-[10px] font-mono font-bold text-neutral-500">
              {currentIndex + 1}/{tourSteps.length}
            </span>
          </div>

          <button
            type="button"
            onClick={handleDismiss}
            className="p-1 rounded-full hover:bg-neutral-100 text-black border border-transparent hover:border-black transition cursor-pointer"
            title="Close Guide"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Bubble Title & Content */}
        <div className="py-3 space-y-1.5">
          <h4 className="text-sm font-extrabold font-serif-display text-black flex items-center gap-1.5">
            <span>{step.title}</span>
          </h4>

          <p className="text-xs font-medium text-neutral-800 leading-relaxed">
            {step.text}
          </p>
        </div>

        {/* Cartoon Speech Bubble Footer Navigation */}
        <div className="flex items-center justify-between pt-3 border-t-2 border-black/10">
          <button
            type="button"
            disabled={currentIndex === 0}
            onClick={handlePrev}
            className="px-3 py-1.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 border-2 border-black text-xs font-bold text-black disabled:opacity-30 transition cursor-pointer flex items-center gap-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Back
          </button>

          <button
            type="button"
            onClick={handleNext}
            className="px-4 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-500 border-2 border-black text-xs font-bold text-black transition cursor-pointer flex items-center gap-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px]"
          >
            {currentIndex === tourSteps.length - 1 ? (
              <>
                <span>Got it!</span>
                <Check className="w-3.5 h-3.5" />
              </>
            ) : (
              <>
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
