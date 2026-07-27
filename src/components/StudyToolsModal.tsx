"use client";

import { useState, useEffect } from "react";
import {
  X,
  Layers,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  BookOpen,
  HelpCircle,
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

  // Load Flashcards — this only runs once this component is actually mounted,
  // which the caller (StudioPanel) delays until the user clicks Generate.
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
    <div className="flex flex-col gap-5 text-ink">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-rule pb-3">
        <div className="flex items-center gap-2.5">
          <Layers className="w-4 h-4 text-accent" />
          <div>
            <h2 className="text-sm font-semibold text-ink">
              Study Tools
            </h2>
            <p className="text-[11px] text-neutral-500">
              Generated from your notebook's sources
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1.5 text-neutral-400 hover:text-ink hover:bg-vessel rounded-lg transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-rule text-xs font-medium gap-4">
        <button
          type="button"
          onClick={() => setActiveTab("flashcards")}
          className={`flex items-center gap-2 pb-3 border-b-2 transition cursor-pointer ${
            activeTab === "flashcards"
              ? "border-accent text-accent"
              : "border-transparent text-neutral-500 hover:text-ink"
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Flashcards ({flashcards.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("quiz")}
          className={`flex items-center gap-2 pb-3 border-b-2 transition cursor-pointer ${
            activeTab === "quiz"
              ? "border-accent text-accent"
              : "border-transparent text-neutral-500 hover:text-ink"
          }`}
        >
          <HelpCircle className="w-4 h-4" />
          <span>Quiz ({quizQuestions.length})</span>
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
          {error}
        </div>
      )}

      {/* TAB 1: 3D FLIP FLASHCARDS */}
      {activeTab === "flashcards" && (
        <div className="flex-1 flex flex-col items-center justify-between space-y-5">
          {isLoadingFlashcards ? (
            <div className="w-full space-y-5" aria-label="Generating flashcards">
              <div className="w-full h-64 rounded-3xl bg-rule animate-pulse" />
              <div className="flex items-center justify-between w-full pt-1">
                <div className="h-9 w-24 rounded-xl bg-rule animate-pulse" />
                <div className="h-4 w-16 rounded bg-rule animate-pulse" />
                <div className="h-9 w-20 rounded-xl bg-rule animate-pulse" />
              </div>
            </div>
          ) : flashcards.length === 0 ? (
            <div className="py-12 text-center text-neutral-400 space-y-2">
              <BookOpen className="w-8 h-8 mx-auto text-neutral-300" />
              <p className="text-xs">No flashcards available. Add text sources to generate study cards.</p>
            </div>
          ) : (
            <>
              {/* 3D Flip Card Container — the interaction itself is kept exactly as-is */}
              <div
                onClick={() => setIsFlipped(!isFlipped)}
                className="w-full h-64 cursor-pointer perspective-1000 group select-none"
              >
                <div
                  className={`relative w-full h-full duration-500 rounded-3xl transition-transform transform-style-3d shadow-md ${
                    isFlipped ? "rotate-y-180" : ""
                  }`}
                >
                  {/* Front Side */}
                  <div className="absolute inset-0 w-full h-full bg-vessel border border-rule group-hover:border-accent rounded-3xl p-5 flex flex-col justify-between backface-hidden shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent text-[10px] font-semibold uppercase tracking-wider">
                        {currentCard.topic}
                      </span>
                      <span className="text-[10px] text-neutral-400 font-mono">
                        Click to flip
                      </span>
                    </div>

                    <div className="my-auto text-center space-y-3">
                      <p className="text-sm font-medium text-ink leading-relaxed">
                        "{currentCard.question}"
                      </p>
                    </div>

                    <div className="text-center text-[10px] text-neutral-400">
                      {currentCard.sourceTitle && `Source: ${currentCard.sourceTitle}`}
                    </div>
                  </div>

                  {/* Back Side (Rotated 180deg) */}
                  <div className="absolute inset-0 w-full h-full bg-surface border border-found rounded-3xl p-5 flex flex-col justify-between backface-hidden rotate-y-180 shadow-md">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-1 rounded-full bg-found/10 border border-found/20 text-found text-[10px] font-semibold uppercase tracking-wider">
                        Answer
                      </span>
                      <span className="text-[10px] text-neutral-400 font-mono">
                        Answer revealed
                      </span>
                    </div>

                    <div className="my-auto text-center">
                      <p className="text-xs text-ink leading-relaxed">
                        {currentCard.answer}
                      </p>
                    </div>

                    <div className="text-center text-[10px] text-found font-mono">
                      Grounded in your sources
                    </div>
                  </div>
                </div>
              </div>

              {/* Card Controls */}
              <div className="flex items-center justify-between w-full pt-1">
                <button
                  type="button"
                  onClick={handlePrevCard}
                  className="flex items-center gap-1 px-3 py-2 rounded-xl bg-vessel hover:bg-neutral-100 border border-rule text-xs font-semibold text-ink transition cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </button>

                <span className="text-xs font-mono text-neutral-500">
                  <strong className="text-accent">{currentCardIndex + 1}</strong> / {flashcards.length}
                </span>

                <button
                  type="button"
                  onClick={handleNextCard}
                  className="flex items-center gap-1 px-3 py-2 rounded-xl bg-ink hover:bg-accent text-xs font-semibold text-white transition cursor-pointer shadow-xs"
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
        <div className="flex-1 space-y-5">
          {isLoadingQuiz ? (
            <div className="space-y-4" aria-label="Generating quiz">
              <div className="h-11 w-full rounded-xl bg-rule animate-pulse" />
              {[0, 1, 2].map((i) => (
                <div key={i} className="p-4 rounded-xl bg-vessel/80 border border-rule space-y-3">
                  <div className="h-4 w-3/4 rounded bg-rule animate-pulse" />
                  <div className="grid grid-cols-1 gap-2">
                    <div className="h-10 rounded-lg bg-rule animate-pulse" />
                    <div className="h-10 rounded-lg bg-rule animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : quizQuestions.length === 0 ? (
            <div className="py-12 text-center text-neutral-400 space-y-2">
              <HelpCircle className="w-8 h-8 mx-auto text-neutral-300" />
              <p className="text-xs">No quiz questions available. Add text sources to generate quiz.</p>
            </div>
          ) : (
            <>
              {/* Score Tracker */}
              <div className="flex items-center justify-between p-3.5 bg-vessel rounded-xl border border-rule text-xs">
                <span className="font-semibold text-ink">Progress</span>
                <span className="font-mono text-xs text-accent font-bold">
                  {Object.keys(userAnswers).length}/{quizQuestions.length} · {quizScore}/{quizQuestions.length}
                </span>
              </div>

              {/* Question Cards */}
              {quizQuestions.map((q, qIndex) => {
                const selectedOpt = userAnswers[q.id];
                const isAnswered = selectedOpt !== undefined;

                return (
                  <div
                    key={q.id}
                    className="p-4 rounded-xl bg-vessel/80 border border-rule space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h4 className="text-xs font-semibold text-ink leading-relaxed">
                        {qIndex + 1}. {q.question}
                      </h4>
                      {q.sourceTitle && (
                        <span className="text-[10px] text-neutral-400 font-mono shrink-0">
                          {q.sourceTitle}
                        </span>
                      )}
                    </div>

                    {/* Answer Options — single column: this panel is too narrow
                        for a 2-up grid regardless of viewport width */}
                    <div className="grid grid-cols-1 gap-2">
                      {q.options.map((opt, optIndex) => {
                        let optStyle = "bg-surface border-rule text-ink hover:border-accent";

                        if (isAnswered) {
                          if (optIndex === q.correctIndex) {
                            optStyle = "bg-emerald-50 border-emerald-500 text-emerald-800 font-semibold";
                          } else if (optIndex === selectedOpt) {
                            optStyle = "bg-red-50 border-red-500 text-red-800";
                          } else {
                            optStyle = "bg-surface border-rule text-neutral-400 opacity-50";
                          }
                        }

                        return (
                          <button
                            key={optIndex}
                            type="button"
                            disabled={isAnswered}
                            onClick={() => handleOptionSelect(q.id, optIndex)}
                            className={`p-3 rounded-lg border text-left text-xs transition cursor-pointer flex items-center justify-between ${optStyle}`}
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
                      <div className="p-2.5 rounded-lg bg-surface border border-rule text-[11px] text-neutral-600 space-y-1">
                        <span className="font-semibold text-accent block">Explanation:</span>
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
