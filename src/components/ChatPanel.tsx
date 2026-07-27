"use client";

import { useState, useEffect, useRef, useCallback, memo } from "react";
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
  Languages,
  PanelLeft,
  Download,
} from "lucide-react";
import { useAuth, SignInButton } from "@clerk/nextjs";
import { CitationPayload, RetrievalTracePayload } from "@/app/api/chat/route";
import SourceViewerModal from "@/components/SourceViewerModal";
import RetrievalTrace from "@/components/RetrievalTrace";
import { VariantKind } from "@/lib/locator";
import { useReadingVariant } from "@/hooks/useReadingVariant";

type LanguageOption = { kind: VariantKind; label: string };

const languageOptions: LanguageOption[] = [
  { kind: "ORIGINAL", label: "Original" },
  { kind: "ENGLISH", label: "English" },
  { kind: "ROMANIZED", label: "Romanized" },
];

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
  role: string;
  content: string;
  citations?: any;
  trace?: any;
  createdAt: string;
}

export default function ChatPanel({
  notebookId,
  sourceCount,
  onOpenSources,
}: {
  notebookId: string;
  sourceCount?: number;
  onOpenSources?: () => void;
}) {
  const { isSignedIn } = useAuth();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [selectedViewerSource, setSelectedViewerSource] = useState<any | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { variant, isExplicit, select, reset } = useReadingVariant(notebookId);

  // Fetch past messages on mount
  useEffect(() => {
    async function fetchHistory() {
      try {
        setIsLoadingHistory(true);
        const res = await fetch(`/api/chat?notebookId=${notebookId}`);
        if (res.ok) {
          const data: DBMessage[] = await res.json();
          const mapped: MessageItem[] = data.map((m) => ({
            id: m.id,
            role: m.role as "user" | "assistant",
            content: m.content,
            citations: m.citations ? (m.citations as CitationPayload[]) : null,
            trace: m.trace ? (m.trace as RetrievalTracePayload) : null,
          }));
          setMessages(mapped);
        }
      } catch (err) {
        console.error("Failed to load chat history:", err);
      } finally {
        setIsLoadingHistory(false);
      }
    }

    fetchHistory();
  }, [notebookId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  async function handleSend(customText?: string) {
    const textToSend = customText || input;
    if (!textToSend.trim() || isLoading) return;

    const userMessage: MessageItem = {
      id: Date.now().toString(),
      role: "user",
      content: textToSend.trim(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    if (!customText) setInput("");
    setIsLoading(true);

    const assistantMsgId = (Date.now() + 1).toString();
    const placeholderAssistant: MessageItem = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      citations: [],
      trace: null,
    };

    setMessages([...newMessages, placeholderAssistant]);

    try {
      const bodyPayload: any = {
        notebookId,
        messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
      };
      if (isExplicit && variant) {
        bodyPayload.variant = variant;
      }

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to reach Pensieve API");
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error("No reader stream available");

      let accumulatedContent = "";
      let parsedCitations: CitationPayload[] = [];
      let parsedTrace: RetrievalTracePayload | null = null;
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          // Data stream protocol: "2:" carries out-of-band JSON parts (trace,
          // citations); "0:" carries a plain-text token. The server never sends
          // "CITATIONS:"/"TRACE:" prefixes — those belonged to an older protocol.
          if (trimmed.startsWith("2:")) {
            try {
              const parts = JSON.parse(trimmed.substring(2));
              for (const part of parts) {
                if (part.type === "trace") parsedTrace = part.data;
                else if (part.type === "citations") parsedCitations = part.data;
              }
            } catch (e) {
              console.error("Failed parsing data stream part:", e);
            }
          } else if (trimmed.startsWith("0:")) {
            try {
              const textChunk = JSON.parse(trimmed.substring(2));
              accumulatedContent += textChunk;
            } catch (e) {
              accumulatedContent += trimmed.substring(2);
            }
          }
        }

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? {
                  ...msg,
                  content: accumulatedContent,
                  citations: parsedCitations,
                  trace: parsedTrace,
                }
              : msg
          )
        );
      }
    } catch (err: any) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? {
                ...msg,
                content: `Sorry, I encountered an error answering your prompt: ${
                  err.message || "Unknown error"
                }`,
              }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  }

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    handleSend();
  }

  function handleExportChatMarkdown() {
    if (messages.length === 0) return;
    let mdContent = `# Pensieve Chat Research Thread\n\n`;
    messages.forEach((m) => {
      const roleName = m.role === "user" ? "User" : "Pensieve Assistant";
      mdContent += `### ${roleName}\n${m.content}\n\n`;
      if (m.citations && m.citations.length > 0) {
        mdContent += `**Citations:**\n`;
        m.citations.forEach((c) => {
          mdContent += `- [${c.number}] ${c.title} (${c.humanLocator || ""})\n`;
        });
        mdContent += `\n`;
      }
    });

    const blob = new Blob([mdContent], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Pensieve-Research-Thread-${notebookId}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  const handleCitationClick = useCallback((citation: CitationPayload) => {
    // PDF/YouTube need the actual document (blobUrl) or video (url) fetched to
    // open at the right page/timestamp — passing the excerpt as rawText would
    // make SourceViewerModal think it already has everything and skip that
    // fetch, so leave rawText unset for those and let the on-demand fetch fill
    // in blobUrl/url/rawText from the full row instead.
    const isDocumentType = citation.type === "PDF" || citation.type === "YOUTUBE";
    setSelectedViewerSource({
      id: citation.sourceId,
      title: citation.title,
      type: citation.type,
      url: null,
      blobUrl: null,
      rawText: isDocumentType ? null : citation.text,
      locator: citation.locator ?? null,
      createdAt: new Date().toISOString(),
    });
  }, []);

  return (
    <div className="flex flex-col h-full bg-white text-[#141A22] relative overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E7EA] bg-white px-4 py-3 md:px-6 md:py-4">
        <div className="flex min-w-0 items-center gap-2.5">
          {onOpenSources && (
            <button
              type="button"
              onClick={onOpenSources}
              aria-label={`Show sources${sourceCount ? ` (${sourceCount})` : ""}`}
              className="flex shrink-0 items-center gap-1 rounded-xl border border-[#E2E7EA] px-2.5 py-1.5 text-[11px] font-medium text-neutral-600 transition hover:bg-[#F5F7F8] md:hidden"
            >
              <PanelLeft className="h-3.5 w-3.5" />
              {sourceCount ?? ""}
            </button>
          )}

          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#3B4CC0] text-white shadow-xs">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-[#141A22]">
              Pensieve AI Assistant
            </h2>
            <p className="hidden text-[11px] text-neutral-400 sm:block">
              Answers grounded only in your sources
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Chat Export Control */}
          {messages.length > 0 && (
            <button
              type="button"
              onClick={handleExportChatMarkdown}
              title="Export Research Thread as Markdown"
              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-[#F5F7F8] hover:bg-neutral-100 border border-[#E2E7EA] text-[#3B4CC0] rounded-xl transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export Thread</span>
            </button>
          )}

          <div className="flex min-w-0 items-center gap-1.5">
            <Languages className="hidden h-3.5 w-3.5 shrink-0 text-neutral-400 sm:block" />
            <div className="flex max-w-full overflow-x-auto rounded-xl bg-[#F5F7F8] border border-[#E2E7EA] p-0.5 text-[11px] font-medium">
              <button
                type="button"
                onClick={reset}
                title="Answer in whatever language the question is asked in"
                aria-pressed={!isExplicit}
                className={`shrink-0 rounded-lg px-2.5 py-1 transition ${
                  !isExplicit
                    ? "bg-white text-[#141A22] font-semibold shadow-xs"
                    : "text-neutral-500 hover:text-[#141A22]"
                }`}
              >
                Auto
              </button>
              {languageOptions.map((option: LanguageOption) => {
                const active = isExplicit && option.kind === variant;
                return (
                  <button
                    key={option.kind}
                    type="button"
                    onClick={() => select(option.kind)}
                    title={`Read sources and get answers in ${option.label}`}
                    aria-pressed={active}
                    className={`shrink-0 whitespace-nowrap rounded-lg px-2.5 py-1 transition ${
                      active
                        ? "bg-white text-[#141A22] font-semibold shadow-xs"
                        : "text-neutral-500 hover:text-[#141A22]"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
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
            <div className="w-12 h-12 rounded-2xl bg-[#F5F7F8] border border-[#E2E7EA] flex items-center justify-center text-neutral-400">
              <MessageSquare className="w-6 h-6 text-[#3B4CC0]" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[#141A22]">Start a Conversation</h3>
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
                  className="w-full text-left p-3 text-xs text-[#141A22] bg-[#F5F7F8] hover:bg-neutral-100 rounded-xl border border-[#E2E7EA] transition flex items-center justify-between group cursor-pointer"
                >
                  <span>{promptText}</span>
                  <Sparkles className="w-3.5 h-3.5 text-neutral-400 group-hover:text-[#3B4CC0] transition" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <ChatMessageBubble
              key={m.id}
              message={m}
              isLoading={isLoading}
              onCitationClick={handleCitationClick}
            />
          ))
        )}

        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-neutral-500 italic">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#3B4CC0]" />
            <span>Pensieve is retrieving sources & streaming response...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <div className="p-4 border-t border-[#E2E7EA] bg-white">
        {!isSignedIn ? (
          <div className="flex items-center justify-between gap-3 p-3 bg-[#F5F7F8] border border-[#E2E7EA] rounded-2xl text-xs">
            <span className="text-[#141A22] font-medium">
              Sign in to ask questions and chat with this memory vessel.
            </span>
            <SignInButton mode="modal">
              <button
                type="button"
                className="px-4 py-2 bg-[#141A22] hover:bg-[#3B4CC0] text-white font-semibold rounded-xl shadow-sm transition cursor-pointer text-xs shrink-0"
              >
                Sign In to Chat
              </button>
            </SignInButton>
          </div>
        ) : (
          <form onSubmit={handleFormSubmit} className="relative flex items-center">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Pensieve a question about your notebook sources..."
              className="w-full pl-4 pr-12 py-3 text-xs bg-[#F5F7F8] border border-[#E2E7EA] rounded-2xl outline-none focus:ring-2 focus:ring-[#3B4CC0] focus:bg-white text-[#141A22] placeholder:text-neutral-400 transition"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="absolute right-2 p-2.5 bg-[#141A22] text-white rounded-xl hover:bg-[#3B4CC0] disabled:opacity-40 transition cursor-pointer shadow-sm"
            >
              {isLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
            </button>
          </form>
        )}
      </div>

      {/* Source Viewer Modal */}
      {selectedViewerSource && (
        <SourceViewerModal
          source={{
            id: selectedViewerSource.id,
            title: selectedViewerSource.title,
            type: selectedViewerSource.type,
            url: selectedViewerSource.url,
            blobUrl: selectedViewerSource.blobUrl,
            rawText: selectedViewerSource.rawText,
            createdAt: selectedViewerSource.createdAt,
          }}
          notebookId={notebookId}
          locator={selectedViewerSource.locator}
          onClose={() => setSelectedViewerSource(null)}
        />
      )}
    </div>
  );
}

/**
 * Memoized so a streaming answer only re-renders its own bubble — without this,
 * every setMessages call during streaming re-ran the citation-regex parser
 * (renderProseWithInlineCitations) over every past message in the thread too.
 */
const ChatMessageBubble = memo(function ChatMessageBubble({
  message: m,
  isLoading,
  onCitationClick,
}: {
  message: MessageItem;
  isLoading: boolean;
  onCitationClick: (c: CitationPayload) => void;
}) {
  const isUser = m.role === "user";

  return (
    <div
      className={`flex max-w-3xl gap-2.5 md:gap-3 ${
        isUser ? "ml-auto flex-row-reverse" : ""
      }`}
    >
      {/* Avatar */}
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-semibold ${
          isUser
            ? "bg-[#141A22] text-white shadow-xs"
            : "bg-[#3B4CC0] text-white shadow-xs"
        }`}
      >
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>

      <div className={`min-w-0 max-w-[85%] space-y-3 ${isUser ? "items-end" : ""}`}>
        {!isUser && m.trace && (
          <RetrievalTrace trace={m.trace} isStreaming={isLoading && !m.content} />
        )}

        {m.content && (
          <div
            className={`overflow-hidden break-words rounded-2xl p-3.5 text-xs leading-relaxed md:p-4 shadow-2xs ${
              isUser
                ? "rounded-tr-none bg-[#141A22] text-white font-medium"
                : "rounded-tl-none border border-[#E2E7EA] bg-[#F5F7F8] text-[#141A22]"
            }`}
          >
            {isUser ? (
              <div className="whitespace-pre-wrap">{m.content}</div>
            ) : (
              renderProseWithInlineCitations(m.content, m.citations, onCitationClick)
            )}
          </div>
        )}

        {/* Citation Chips under Assistant Answer */}
        {!isUser && m.citations && m.citations.length > 0 && (
          <div className="pt-1 space-y-1.5">
            <div className="flex items-center gap-1 text-[11px] font-semibold text-neutral-500">
              <BookOpen className="w-3 h-3 text-[#1D9E75]" />
              <span>Citations ({m.citations.length})</span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {m.citations.map((c) => (
                <button
                  key={c.number}
                  type="button"
                  onClick={() => onCitationClick(c)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium bg-white hover:bg-neutral-50 border border-[#E2E7EA] rounded-xl shadow-2xs text-[#141A22] hover:border-[#3B4CC0] transition cursor-pointer"
                >
                  <span className="font-semibold text-[#1D9E75] bg-[#1D9E75]/10 px-1 rounded border border-[#1D9E75]/20">
                    [{c.number}]
                  </span>
                  <span className="max-w-[130px] truncate">{c.title}</span>
                  {c.humanLocator && (
                    <span className="text-[10px] font-mono text-neutral-400">
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
});

function renderProseWithInlineCitations(
  content: string,
  citations: CitationPayload[] | null | undefined,
  onCitationClick: (c: CitationPayload) => void
) {
  if (!citations || citations.length === 0) {
    return <div className="whitespace-pre-wrap">{content}</div>;
  }

  const citationMap = new Map<number, CitationPayload>();
  citations.forEach((c) => citationMap.set(c.number, c));

  const regex = /\[(\d+)\]/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    const num = parseInt(match[1], 10);
    const beforeText = content.substring(lastIndex, match.index);
    if (beforeText) parts.push(beforeText);

    const cit = citationMap.get(num);
    if (cit) {
      parts.push(
        <button
          key={`${match.index}-${num}`}
          type="button"
          onClick={() => onCitationClick(cit)}
          title={`${cit.title} (${cit.humanLocator || ""})`}
          className="inline-flex items-center justify-center mx-0.5 px-1.5 py-0.2 text-[10px] font-bold text-[#1D9E75] bg-[#1D9E75]/10 hover:bg-[#1D9E75]/20 rounded border border-[#1D9E75]/30 transition cursor-pointer"
        >
          [{num}]
        </button>
      );
    } else {
      parts.push(match[0]);
    }

    lastIndex = regex.lastIndex;
  }

  const remainingText = content.substring(lastIndex);
  if (remainingText) parts.push(remainingText);

  return <div className="whitespace-pre-wrap leading-relaxed">{parts}</div>;
}
