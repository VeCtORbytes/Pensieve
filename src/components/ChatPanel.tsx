"use client";

import { useState, useEffect, useRef } from "react";
import {
  Bot,
  User,
  Send,
  Loader2,
  Sparkles,
  BookOpen,
  X,
  FileText,
  MessageSquare,
} from "lucide-react";
import { CitationPayload, RetrievalTracePayload } from "@/app/api/chat/route";
import SourceViewerModal from "@/components/SourceViewerModal";
import RetrievalTrace from "@/components/RetrievalTrace";
import { VariantKind } from "@/lib/locator";
import { useReadingVariant } from "@/hooks/useReadingVariant";
import { Languages, PanelLeft } from "lucide-react";

type LanguageOption = { kind: VariantKind; label: string };

interface MessageItem {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: CitationPayload[] | null;
  trace?: RetrievalTracePayload | null;
}

interface DBMessage {
  id: string;
  notebookId: string;
  role: "user" | "assistant" | "system";
  content: string;
  citations?: CitationPayload[] | null;
  createdAt: string;
}

export default function ChatPanel({
  notebookId,
  sourceCount,
  onOpenSources,
}: {
  notebookId: string;
  /** Shown on the mobile sources trigger. */
  sourceCount?: number;
  /** Provided by the workspace to open the rail drawer below `md`. */
  onOpenSources?: () => void;
}) {
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [selectedCitation, setSelectedCitation] = useState<CitationPayload | null>(null);
  const [targetViewerSource, setTargetViewerSource] = useState<any | null>(null);
  const [isLoadingSourceModal, setIsLoadingSourceModal] = useState(false);

  // Reading language, shared with the source viewer. Answers come back in it.
  // Until the reader picks one, the server infers it from the question.
  const { variant, isExplicit, select: selectVariant, reset: resetVariant } =
    useReadingVariant(notebookId);
  const [languageOptions, setLanguageOptions] = useState<LanguageOption[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Only offer a language switcher when the notebook actually has a non-English
  // source to switch between.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`/api/notebooks/${notebookId}/languages`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data?.options) && data.options.length > 1) {
          setLanguageOptions(data.options);
        }
      } catch {
        /* switcher stays hidden */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [notebookId]);

  function handleCitationClick(citation: CitationPayload) {
    setSelectedCitation(citation);

    // Set target viewer source IMMEDIATELY so modal opens at 0ms latency
    setTargetViewerSource({
      id: citation.sourceId,
      title: citation.title,
      type: citation.locator?.page ? "PDF" : citation.locator?.startSec !== undefined ? "YOUTUBE" : "TEXT",
      rawText: citation.text,
      blobUrl: null,
      url: citation.locator?.startSec !== undefined ? `https://www.youtube.com/watch?v=preview` : undefined,
    });

    // Enrich full source details in background without blocking modal launch
    fetch(`/api/sources?notebookId=${notebookId}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((sources) => {
        const found = sources.find((s: any) => s.id === citation.sourceId);
        if (found) {
          setTargetViewerSource(found);
        }
      })
      .catch((err) => console.error("Background source fetch error:", err));
  }

  // Load chat history from PostgreSQL
  useEffect(() => {
    async function loadHistory() {
      try {
        setIsLoadingHistory(true);
        const res = await fetch(`/api/chat?notebookId=${notebookId}`);
        if (res.ok) {
          const dbMsgs: DBMessage[] = await res.json();
          if (dbMsgs.length > 0) {
            const formatted: MessageItem[] = dbMsgs
              .filter((m) => m.role === "user" || m.role === "assistant")
              .map((m) => ({
                id: m.id,
                role: m.role as "user" | "assistant",
                content: m.content,
                citations: m.citations || null,
              }));
            setMessages(formatted);
          }
        }
      } catch (err) {
        console.error("Failed to load chat history:", err);
      } finally {
        setIsLoadingHistory(false);
      }
    }
    loadHistory();
  }, [notebookId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  async function handleSend(promptText?: string) {
    const textToSend = promptText || input;
    if (!textToSend.trim() || isLoading) return;

    const userMsgId = `user-${Date.now()}`;
    const userMsg: MessageItem = {
      id: userMsgId,
      role: "user",
      content: textToSend.trim(),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    const assistantMsgId = `assistant-${Date.now()}`;
    let citations: CitationPayload[] | null = null;
    let trace: RetrievalTracePayload | null = null;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notebookId,
          // Omitted unless the reader chose a language, so the server can match
          // the question's language instead.
          variant: isExplicit ? variant : undefined,
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to generate response");
      }

      setMessages((prev) => [
        ...prev,
        {
          id: assistantMsgId,
          role: "assistant",
          content: "",
          citations: null,
          trace: null,
        },
      ]);

      if (res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let accumulatedText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.trim()) continue;

            if (line.startsWith("2:")) {
              try {
                const dataArray = JSON.parse(line.slice(2));
                if (Array.isArray(dataArray)) {
                  for (const item of dataArray) {
                    if (item.type === "trace") trace = item.data;
                    if (item.type === "citations") citations = item.data;
                  }
                }
              } catch (e) {
                console.warn("Failed to parse stream data line:", line, e);
              }
            } else if (line.startsWith('0:"')) {
              try {
                const textChunk = JSON.parse(line.slice(2));
                accumulatedText += textChunk;
              } catch (e) {
                accumulatedText += line.slice(2);
              }
            } else {
              accumulatedText += line;
            }

            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMsgId
                  ? { ...msg, content: accumulatedText, citations, trace }
                  : msg
              )
            );
          }
        }

        if (buffer.trim()) {
          accumulatedText += buffer;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? { ...msg, content: accumulatedText, citations, trace }
                : msg
            )
          );
        }
      }
    } catch (err: any) {
      console.error("Error sending message:", err);
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "assistant",
          content: `⚠️ Error: ${err.message || "Failed to respond."}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    handleSend();
  }

  return (
    <div className="flex flex-col h-full bg-white relative overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 bg-white px-4 py-3 md:px-6 md:py-4">
        <div className="flex min-w-0 items-center gap-2.5">
          {onOpenSources && (
            <button
              type="button"
              onClick={onOpenSources}
              aria-label={`Show sources${sourceCount ? ` (${sourceCount})` : ""}`}
              className="flex shrink-0 items-center gap-1 rounded-lg border border-neutral-200 px-2 py-1.5 text-[11px] font-medium text-neutral-600 transition hover:bg-neutral-50 md:hidden"
            >
              <PanelLeft className="h-3.5 w-3.5" />
              {sourceCount ?? ""}
            </button>
          )}

          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink text-white shadow-xs">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-neutral-900">
              Pensieve AI Assistant
            </h2>
            <p className="hidden text-[11px] text-neutral-400 sm:block">
              Answers drawn only from your sources
            </p>
          </div>
        </div>

        {languageOptions.length > 1 && (
          <div className="flex min-w-0 items-center gap-1.5">
            <Languages className="hidden h-3.5 w-3.5 shrink-0 text-neutral-400 sm:block" />
            <div className="flex max-w-full overflow-x-auto rounded-lg bg-neutral-100 p-0.5 text-[11px] font-medium">
              {/* Auto follows the language of each question. */}
              <button
                type="button"
                onClick={resetVariant}
                title="Answer in whatever language the question is asked in"
                aria-pressed={!isExplicit}
                className={`shrink-0 rounded-md px-2.5 py-1 transition ${
                  !isExplicit
                    ? "bg-white text-neutral-900 shadow-xs"
                    : "text-neutral-500 hover:text-neutral-900"
                }`}
              >
                Auto
              </button>
              {languageOptions.map((option) => {
                const active = isExplicit && option.kind === variant;
                return (
                  <button
                    key={option.kind}
                    type="button"
                    onClick={() => selectVariant(option.kind)}
                    title={`Read sources and get answers in ${option.label}`}
                    aria-pressed={active}
                    className={`shrink-0 whitespace-nowrap rounded-md px-2.5 py-1 transition ${
                      active
                        ? "bg-white text-neutral-900 shadow-xs"
                        : "text-neutral-500 hover:text-neutral-900"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 space-y-6 overflow-y-auto p-4 md:p-6">
        {isLoadingHistory ? (
          <div className="flex items-center justify-center h-full text-neutral-400 gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-xs font-medium">Loading conversation history...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full max-w-md mx-auto text-center space-y-4 py-12">
            <div className="w-12 h-12 rounded-2xl bg-neutral-100 flex items-center justify-center text-neutral-400">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-neutral-800">Start a Conversation</h3>
              <p className="text-xs text-neutral-400 mt-1">
                Ask questions about your uploaded documents, websites, PDFs, or YouTube videos.
              </p>
            </div>

            <div className="w-full space-y-2 pt-2">
              <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-400 text-left">
                Suggested Prompts
              </p>
              {[
                "Summarize the key takeaways from my sources.",
                "What are the main arguments or topics presented?",
                "List key insights and recommendations.",
              ].map((promptText, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSend(promptText)}
                  className="w-full text-left p-3 text-xs text-neutral-700 bg-neutral-50 hover:bg-neutral-100 rounded-xl border border-neutral-200/80 transition flex items-center justify-between group cursor-pointer"
                >
                  <span>{promptText}</span>
                  <Sparkles className="w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-900 transition" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => {
            const isUser = m.role === "user";

            return (
              <div
                key={m.id}
                className={`flex max-w-3xl gap-2.5 md:gap-3 ${
                  isUser ? "ml-auto flex-row-reverse" : ""
                }`}
              >
                {/* Avatar */}
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-semibold ${
                    isUser ? "bg-ink text-white" : "bg-accent text-white shadow-xs"
                  }`}
                >
                  {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                {/* min-w-0 lets the bubble shrink and wrap on narrow screens;
                    max-w keeps it sized to its content instead of stretching. */}
                <div
                  className={`min-w-0 max-w-[85%] space-y-3 ${isUser ? "items-end" : ""}`}
                >
                  {/* Retrieval Trace Component above assistant answer */}
                  {!isUser && m.trace && (
                    <RetrievalTrace trace={m.trace} isStreaming={isLoading && !m.content} />
                  )}

                  {m.content && (
                    <div
                      className={`overflow-hidden break-words rounded-2xl p-3.5 text-xs leading-relaxed md:p-4 ${
                        isUser
                          ? "rounded-tr-none bg-ink text-white"
                          : "rounded-tl-none border border-neutral-200/60 bg-neutral-100/80 text-neutral-800"
                      }`}
                    >
                      {isUser ? (
                        <div className="whitespace-pre-wrap">{m.content}</div>
                      ) : (
                        renderProseWithInlineCitations(m.content, m.citations, (c) => handleCitationClick(c))
                      )}
                    </div>
                  )}

                  {/* Citation Chips under Assistant Answer: filename.pdf · p.4 */}
                  {!isUser && m.citations && m.citations.length > 0 && (
                    <div className="pt-1 space-y-1.5">
                      <div className="flex items-center gap-1 text-[11px] font-semibold text-neutral-400">
                        <BookOpen className="w-3 h-3 text-neutral-500" />
                        <span>Citations ({m.citations.length})</span>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {m.citations.map((c) => (
                          <button
                            key={c.number}
                            type="button"
                            onClick={() => handleCitationClick(c)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium bg-white hover:bg-neutral-50 border border-neutral-200 rounded-lg shadow-xs text-neutral-700 hover:border-neutral-400 transition cursor-pointer"
                          >
                            <span className="font-semibold text-emerald-700 bg-emerald-50 px-1 rounded">
                              [{c.number}]
                            </span>
                            <span className="max-w-[130px] truncate">{c.title}</span>
                            {c.humanLocator && (
                              <span className="text-[10px] font-mono text-neutral-500">
                                · {c.humanLocator}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-neutral-400 italic">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-neutral-500" />
            <span>Pensieve is retrieving sources & streaming response...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <div className="p-4 border-t border-neutral-200 bg-white">
        <form onSubmit={handleFormSubmit} className="relative flex items-center">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Pensieve a question about your notebook sources..."
            className="w-full pl-4 pr-12 py-3 text-xs bg-neutral-50 border border-neutral-200 rounded-xl outline-none focus:ring-2 focus:ring-neutral-900 focus:bg-white transition"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="absolute right-2 p-2 bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 disabled:opacity-40 transition cursor-pointer"
          >
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
          </button>
        </form>
      </div>

      {/* Citation Detail Modal. Hidden while the full source viewer is open so
          the two overlays never stack. */}
      {/*
        Citation clicks go straight to the full source viewer. This preview is
        suppressed while the source is being fetched (otherwise it flashes for the
        duration of the request) and once the viewer is open, so the two overlays
        never stack. It remains as the graceful fallback when the source fails to
        load, where its "Jump to Source Document" button retries.
      */}
      {selectedCitation && !targetViewerSource && !isLoadingSourceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-neutral-200">
            <div className="flex items-start justify-between border-b border-neutral-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 text-xs font-bold bg-emerald-100 text-emerald-800 rounded">
                  [{selectedCitation.number}]
                </span>
                <div>
                  <h4 className="text-sm font-semibold text-neutral-900 truncate max-w-[300px]">
                    {selectedCitation.title}
                  </h4>
                  <p className="text-[11px] text-neutral-400">
                    Location: <span className="font-semibold text-neutral-700">{selectedCitation.humanLocator || "Exact Chunk"}</span> • Score: {selectedCitation.score}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCitation(null)}
                className="text-neutral-400 hover:text-neutral-600 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider flex items-center gap-1">
                <FileText className="w-3 h-3" /> Cited Context Snippet
              </p>
              <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200/80 text-xs text-neutral-700 font-mono leading-relaxed max-h-60 overflow-y-auto whitespace-pre-wrap">
                {selectedCitation.text}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => handleCitationClick(selectedCitation)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-800 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition cursor-pointer"
              >
                {isLoadingSourceModal ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <BookOpen className="w-3.5 h-3.5" />
                )}
                Jump to Source Document
              </button>

              <button
                type="button"
                onClick={() => setSelectedCitation(null)}
                className="px-4 py-2 text-xs font-medium bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Source Viewer Modal Target from Citation */}
      {targetViewerSource && (
        <SourceViewerModal
          source={{
            id: targetViewerSource.id,
            title: targetViewerSource.title,
            type: targetViewerSource.type,
            url: targetViewerSource.url,
            blobUrl: targetViewerSource.blobUrl,
            rawText: targetViewerSource.rawText,
            createdAt: targetViewerSource.createdAt,
          }}
          notebookId={notebookId}
          locator={selectedCitation?.locator || null}
          locatorVariant={selectedCitation?.variant}
          onClose={() => {
            // Clear the citation too, or closing the viewer would re-reveal the
            // preview the reader already dismissed by drilling in.
            setTargetViewerSource(null);
            setSelectedCitation(null);
          }}
        />
      )}
    </div>
  );
}

/**
 * Parses bracket citation markers like [1], [2] inside assistant prose text and renders them as clickable superscript buttons
 */
function renderProseWithInlineCitations(
  content: string,
  citations?: CitationPayload[] | null,
  onCitationClick?: (citation: CitationPayload) => void
) {
  if (!citations || citations.length === 0) {
    return <div className="whitespace-pre-wrap">{content}</div>;
  }

  const parts = content.split(/(\[\d+\])/g);

  return (
    <div className="whitespace-pre-wrap">
      {parts.map((part, idx) => {
        const match = part.match(/^\[(\d+)\]$/);
        if (match) {
          const num = parseInt(match[1]);
          const foundCitation = citations.find((c) => c.number === num);
          if (foundCitation) {
            return (
              <button
                key={idx}
                type="button"
                onClick={() => onCitationClick && onCitationClick(foundCitation)}
                className="inline-flex items-center mx-0.5 px-1 py-0.5 text-[10px] font-mono font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 rounded border border-emerald-300 transition cursor-pointer align-super"
                title={`Citation [${num}]: ${foundCitation.title}`}
              >
                [{num}]
              </button>
            );
          }
        }
        return <span key={idx}>{part}</span>;
      })}
    </div>
  );
}
