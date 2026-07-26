"use client";

import { useState, useEffect } from "react";
import {
  X,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Loader2,
  BookOpen,
  Layers,
  HelpCircle,
  Wand2,
} from "lucide-react";

export interface Flashcard {
  id: string;
  question: string;
  answer: string;
  topic: string;
  sourceTitle?: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  sourceTitle?: string;
}

export default function StudyToolsModal({
  notebookId,
  onClose,
}: {
  notebookId: string;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"flashcards" | "quiz">("flashcards");

  // Flashcards state
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isLoadingFlashcards, setIsLoadingFlashcards] = useState(true);

  // Quiz state
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [userAnswers, setUserAnswers] = useState<Record<string, number>>({});
  const [isLoadingQuiz, setIsLoadingQuiz] = useState(true);

  const [error, setError] = useState<string | null>(null);

  // Load Flashcards
  useEffect(() => {
    async function loadFlashcards() {
      try {
        setIsLoadingFlashcards(true);
        setError(null);
        const res = await fetch("/api/study-tools", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notebookId, tool: "flashcards" }),
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Failed to generate flashcards");
        }

        const data = await res.json();
        setFlashcards(data.flashcards || []);
      } catch (err: any) {
        setError(err.message || "Failed to load flashcards");
      } finally {
        setIsLoadingFlashcards(false);
      }
    }

    loadFlashcards();
  }, [notebookId]);

  // Load Quiz
  useEffect(() => {
    async function loadQuiz() {
      try {
        setIsLoadingQuiz(true);
        const res = await fetch("/api/study-tools", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notebookId, tool: "quiz" }),
        });

        if (res.ok) {
          const data = await res.json();
          setQuizQuestions(data.questions || []);
        }
      } catch (err) {
        console.error("Failed to load quiz:", err);
      } finally {
        setIsLoadingQuiz(false);
      }
    }

    loadQuiz();
  }, [notebookId]);

  const currentCard = flashcards[currentCardIndex];

  function handleNextCard() {
    setIsFlipped(false);
    setCurrentCardIndex((prev) => (prev + 1) % flashcards.length);
  }

  function handlePrevCard() {
    setIsFlipped(false);
    setCurrentCardIndex((prev) => (prev - 1 + flashcards.length) % flashcards.length);
  }

  function handleOptionSelect(questionId: string, optionIndex: number) {
    if (userAnswers[questionId] !== undefined) return;
    setUserAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
  }

  const quizScore = quizQuestions.reduce((score, q) => {
    return userAnswers[q.id] === q.correctIndex ? score + 1 : score;
  }, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl space-y-6 border border-[#E2E7EA] text-[#141A22] flex flex-col max-h-[90vh] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#E2E7EA] pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#3B4CC0]/10 border border-[#3B4CC0]/20 text-[#3B4CC0]">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-xl font-serif-display font-normal text-[#141A22]">
                AI Study Tools
              </h2>
              <p className="text-[11px] text-neutral-500">
                Synthesized directly from your memory vessel's sources
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-[#141A22] hover:bg-[#F5F7F8] rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[#E2E7EA] text-xs font-medium gap-4">
          <button
            type="button"
            onClick={() => setActiveTab("flashcards")}
            className={`flex items-center gap-2 pb-3 border-b-2 transition cursor-pointer ${
              activeTab === "flashcards"
                ? "border-[#3B4CC0] text-[#3B4CC0]"
                : "border-transparent text-neutral-500 hover:text-[#141A22]"
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Interactive 3D Flashcards ({flashcards.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("quiz")}
            className={`flex items-center gap-2 pb-3 border-b-2 transition cursor-pointer ${
              activeTab === "quiz"
                ? "border-[#3B4CC0] text-[#3B4CC0]"
                : "border-transparent text-neutral-500 hover:text-[#141A22]"
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            <span>Self-Test Quiz ({quizQuestions.length})</span>
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
            {error}
          </div>
        )}

        {/* TAB 1: 3D FLIP FLASHCARDS */}
        {activeTab === "flashcards" && (
          <div className="flex-1 flex flex-col items-center justify-between space-y-6 overflow-y-auto py-2">
            {isLoadingFlashcards ? (
              <div className="py-20 flex flex-col items-center justify-center space-y-3 text-neutral-400">
                <Loader2 className="w-8 h-8 animate-spin text-[#3B4CC0]" />
                <p className="text-xs">Synthesizing 10 Study Flashcards from sources...</p>
              </div>
            ) : flashcards.length === 0 ? (
              <div className="py-16 text-center text-neutral-400 space-y-2">
                <BookOpen className="w-10 h-10 mx-auto text-neutral-300" />
                <p className="text-xs">No flashcards available. Add text sources to generate study cards.</p>
              </div>
            ) : (
              <>
                {/* 3D Flip Card Container */}
                <div
                  onClick={() => setIsFlipped(!isFlipped)}
                  className="w-full max-w-lg h-72 cursor-pointer perspective-1000 group select-none"
                >
                  <div
                    className={`relative w-full h-full duration-500 rounded-3xl transition-transform transform-style-3d shadow-xl ${
                      isFlipped ? "rotate-y-180" : ""
                    }`}
                  >
                    {/* Front Side */}
                    <div className="absolute inset-0 w-full h-full bg-[#F5F7F8] border border-[#E2E7EA] group-hover:border-[#3B4CC0] rounded-3xl p-8 flex flex-col justify-between backface-hidden shadow-xs">
                      <div className="flex items-center justify-between">
                        <span className="px-3 py-1 rounded-full bg-[#3B4CC0]/10 border border-[#3B4CC0]/20 text-[#3B4CC0] text-[10px] font-semibold uppercase tracking-wider">
                          {currentCard.topic}
                        </span>
                        <span className="text-[10px] text-neutral-400 font-mono">
                          Click card to flip 🪄
                        </span>
                      </div>

                      <div className="my-auto text-center space-y-3">
                        <p className="text-base font-serif-display font-normal text-[#141A22] leading-relaxed">
                          "{currentCard.question}"
                        </p>
                      </div>

                      <div className="text-center text-[10px] text-neutral-400">
                        {currentCard.sourceTitle && `Source: ${currentCard.sourceTitle}`}
                      </div>
                    </div>

                    {/* Back Side (Rotated 180deg) */}
                    <div className="absolute inset-0 w-full h-full bg-white border border-[#1D9E75] rounded-3xl p-8 flex flex-col justify-between backface-hidden rotate-y-180 shadow-2xl">
                      <div className="flex items-center justify-between">
                        <span className="px-3 py-1 rounded-full bg-[#1D9E75]/10 border border-[#1D9E75]/20 text-[#1D9E75] text-[10px] font-semibold uppercase tracking-wider">
                          Answer
                        </span>
                        <span className="text-[10px] text-neutral-400 font-mono">
                          Answer revealed
                        </span>
                      </div>

                      <div className="my-auto text-center">
                        <p className="text-xs text-[#141A22] leading-relaxed font-sans font-normal">
                          {currentCard.answer}
                        </p>
                      </div>

                      <div className="text-center text-[10px] text-[#1D9E75] font-mono">
                        ✓ Grounded Answer
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Controls */}
                <div className="flex items-center justify-between w-full max-w-lg pt-2">
                  <button
                    type="button"
                    onClick={handlePrevCard}
                    className="flex items-center gap-1 px-4 py-2 rounded-xl bg-[#F5F7F8] hover:bg-neutral-100 border border-[#E2E7EA] text-xs font-semibold text-[#141A22] transition cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </button>

                  <span className="text-xs font-mono text-neutral-500">
                    Card <strong className="text-[#3B4CC0]">{currentCardIndex + 1}</strong> of {flashcards.length}
                  </span>

                  <button
                    type="button"
                    onClick={handleNextCard}
                    className="flex items-center gap-1 px-4 py-2 rounded-xl bg-[#141A22] hover:bg-[#3B4CC0] text-xs font-semibold text-white transition cursor-pointer shadow-sm"
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* TAB 2: SELF-TEST QUIZ */}
        {activeTab === "quiz" && (
          <div className="flex-1 overflow-y-auto space-y-6 pr-1">
            {isLoadingQuiz ? (
              <div className="py-20 flex flex-col items-center justify-center space-y-3 text-neutral-400">
                <Loader2 className="w-8 h-8 animate-spin text-[#3B4CC0]" />
                <p className="text-xs">Generating Interactive Multiple-Choice Quiz...</p>
              </div>
            ) : quizQuestions.length === 0 ? (
              <div className="py-16 text-center text-neutral-400 space-y-2">
                <HelpCircle className="w-10 h-10 mx-auto text-neutral-300" />
                <p className="text-xs">No quiz questions available. Add text sources to generate quiz.</p>
              </div>
            ) : (
              <>
                {/* Score Tracker */}
                <div className="flex items-center justify-between p-4 bg-[#F5F7F8] rounded-2xl border border-[#E2E7EA] text-xs">
                  <div className="flex items-center gap-2">
                    <Wand2 className="w-4 h-4 text-[#3B4CC0]" />
                    <span className="font-semibold text-[#141A22]">Quiz Score Progress</span>
                  </div>
                  <div className="font-mono text-xs text-[#3B4CC0] font-bold">
                    {Object.keys(userAnswers).length} / {quizQuestions.length} Answered · Score: {quizScore}/{quizQuestions.length}
                  </div>
                </div>

                {/* Question Cards */}
                {quizQuestions.map((q, qIndex) => {
                  const selectedOpt = userAnswers[q.id];
                  const isAnswered = selectedOpt !== undefined;

                  return (
                    <div
                      key={q.id}
                      className="p-5 rounded-2xl bg-[#F5F7F8]/80 border border-[#E2E7EA] space-y-3.5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <h4 className="text-xs font-semibold text-[#141A22] leading-relaxed">
                          {qIndex + 1}. {q.question}
                        </h4>
                        {q.sourceTitle && (
                          <span className="text-[10px] text-neutral-400 font-mono shrink-0">
                            {q.sourceTitle}
                          </span>
                        )}
                      </div>

                      {/* 4 Answer Options */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {q.options.map((opt, optIndex) => {
                          let optStyle = "bg-white border-[#E2E7EA] text-[#141A22] hover:border-[#3B4CC0]";

                          if (isAnswered) {
                            if (optIndex === q.correctIndex) {
                              optStyle = "bg-emerald-50 border-emerald-500 text-emerald-800 font-semibold";
                            } else if (optIndex === selectedOpt) {
                              optStyle = "bg-red-50 border-red-500 text-red-800";
                            } else {
                              optStyle = "bg-white border-[#E2E7EA] text-neutral-400 opacity-50";
                            }
                          }

                          return (
                            <button
                              key={optIndex}
                              type="button"
                              disabled={isAnswered}
                              onClick={() => handleOptionSelect(q.id, optIndex)}
                              className={`p-3 rounded-xl border text-left text-xs transition cursor-pointer flex items-center justify-between ${optStyle}`}
                            >
                              <span>{opt}</span>
                              {isAnswered && optIndex === q.correctIndex && (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 ml-2" />
                              )}
                              {isAnswered && optIndex === selectedOpt && optIndex !== q.correctIndex && (
                                <XCircle className="w-4 h-4 text-red-600 shrink-0 ml-2" />
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {/* Explanation Feedback */}
                      {isAnswered && (
                        <div className="p-3 rounded-xl bg-white border border-[#E2E7EA] text-[11px] text-neutral-600 space-y-1">
                          <span className="font-semibold text-[#3B4CC0] block">Explanation:</span>
                          <p>{q.explanation}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}
      </div>

      <style jsx global>{`
        .perspective-1000 {
          perspective: 1000px;
        }
        .transform-style-3d {
          transform-style: preserve-3d;
        }
        .backface-hidden {
          backface-visibility: hidden;
        }
        .rotate-y-180 {
          transform: rotateY(180deg);
        }
      `}</style>
    </div>
  );
}
