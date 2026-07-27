"use client";

import { useState, useEffect } from "react";
import { Sparkles, HelpCircle, X, ChevronRight, ChevronLeft, Lightbulb, BookOpen, Layers, MessageSquare } from "lucide-react";

interface GuideStep {
  id: number;
  badge: string;
  title: string;
  dialogue: string;
  icon: any;
  actionText?: string;
}

const guideSteps: GuideStep[] = [
  {
    id: 1,
    badge: "Welcome to Pensieve",
    title: "Your AI Notebook & Study Assistant",
    dialogue: "Upload your PDFs, web articles, or YouTube video links on the left panel to ground AI responses in your exact content.",
    icon: BookOpen,
  },
  {
    id: 2,
    badge: "Grounded Citations",
    title: "Click Any Citation [1]",
    dialogue: "Every answer contains inline citation chips. Click any chip to open the source viewer with exact highlighted page lines & video timestamps!",
    icon: MessageSquare,
  },
  {
    id: 3,
    badge: "Studio Suite & Notes",
    title: "Briefings, Quizzes & Scratchpad",
    dialogue: "Open the Studio panel on the right to generate Executive Briefings, Multi-Language Flashcards, Mind Maps, and write Notes!",
    icon: Layers,
  },
];

export default function AnimatedGuideDialog() {
  const [isOpen, setIsOpen] = useState(true);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [typedText, setTypedText] = useState("");
  const [isTyping, setIsTyping] = useState(true);

  const step = guideSteps[currentStepIndex];

  // Typewriter effect for dialogue box
  useEffect(() => {
    if (!isOpen) return;
    setIsTyping(true);
    setTypedText("");
    let i = 0;
    const fullText = step.dialogue;

    const timer = setInterval(() => {
      if (i < fullText.length) {
        setTypedText(fullText.slice(0, i + 1));
        i++;
      } else {
        setIsTyping(false);
        clearInterval(timer);
      }
    }, 20);

    return () => clearInterval(timer);
  }, [currentStepIndex, isOpen]);

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        title="Open AI Guide Dialogue"
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-3.5 py-2 rounded-full bg-[#141A22] text-white shadow-xl hover:bg-[#3B4CC0] transition cursor-pointer border border-[#3B4CC0]/40 group animate-in fade-in duration-200"
      >
        <Sparkles className="w-4 h-4 text-amber-400 animate-spin" />
        <span className="text-xs font-semibold">Pensieve Guide</span>
      </button>
    );
  }

  const IconComponent = step.icon;

  return (
    <div className="relative mx-4 mt-3 mb-1 animate-in fade-in slide-in-from-top-3 duration-300">
      <div className="relative overflow-hidden rounded-2xl border border-[#3B4CC0]/30 bg-gradient-to-r from-[#141A22] via-[#1E2638] to-[#141A22] text-white p-4 shadow-xl">
        {/* Swirling Background Sparkle Effects */}
        <div className="absolute -top-12 -right-12 w-40 h-40 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          {/* Animated Avatar & Dialogue Speech Box */}
          <div className="flex items-start gap-3.5 flex-1 min-w-0">
            {/* Animated Avatar Icon */}
            <div className="relative shrink-0 mt-0.5">
              <div className="p-2.5 rounded-2xl bg-amber-400/10 border border-amber-400/30 text-amber-300 shadow-inner">
                <IconComponent className="w-5 h-5 animate-pulse text-amber-300" />
              </div>
              <span className="absolute -inset-1 rounded-2xl bg-amber-400/20 animate-ping pointer-events-none" />
            </div>

            {/* Speech Dialogue Box */}
            <div className="space-y-1 min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-semibold uppercase tracking-wider bg-amber-400/20 text-amber-300 px-2 py-0.5 rounded border border-amber-400/30">
                  {step.badge}
                </span>
                <h4 className="text-xs font-semibold text-slate-100 truncate">
                  {step.title}
                </h4>
              </div>

              {/* Animated Typewriter Text */}
              <p className="text-xs text-slate-200 leading-relaxed font-sans min-h-[36px]">
                {typedText}
                {isTyping && <span className="inline-block w-1.5 h-3.5 ml-1 bg-amber-400 animate-pulse align-middle" />}
              </p>
            </div>
          </div>

          {/* Stepper Navigation & Dismiss Controls */}
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center border-t sm:border-t-0 border-[#3B4CC0]/20 pt-2 sm:pt-0 w-full sm:w-auto justify-between sm:justify-end">
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentStepIndex === 0}
                onClick={() => setCurrentStepIndex((prev) => Math.max(0, prev - 1))}
                className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 disabled:opacity-30 text-slate-300 transition cursor-pointer"
                title="Previous Tip"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="text-[10px] font-mono text-slate-400 px-2">
                {currentStepIndex + 1} / {guideSteps.length}
              </span>

              <button
                type="button"
                disabled={currentStepIndex === guideSteps.length - 1}
                onClick={() => setCurrentStepIndex((prev) => Math.min(guideSteps.length - 1, prev + 1))}
                className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 disabled:opacity-30 text-slate-300 transition cursor-pointer"
                title="Next Tip"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition cursor-pointer"
              title="Dismiss Guide"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
