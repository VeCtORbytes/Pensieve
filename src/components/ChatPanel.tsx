"use client";

import { useState, useEffect, useRef, useCallback, memo } from "react";
import {
  Bot,
  User,
  Send,
  Loader2,
  ArrowRight,
  BookOpen,
  X,
  FileText,
  MessageSquare,
  Languages,
  PanelLeft,
  Layers,
  Download,
} from "lucide-react";
import { useAuth, useUser, SignInButton } from "@clerk/nextjs";
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
  onOpenStudio,
}: {
  notebookId: string;
  sourceCount?: number;
  onOpenSources?: () => void;
  onOpenStudio?: () => void;
}) {
  const { isSignedIn } = useAuth();
  const { user } = useUser();
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
        throw new Error(errorData.error || "Failed to reach the server");
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
    let mdContent = `# Chat export\n\n`;
    messages.forEach((m) => {
      const roleName = m.role === "user" ? "User" : "Assistant";
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
    <div className="flex flex-col h-full bg-white text-ink relative overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule bg-white px-4 py-3 md:px-6 md:py-4">
        <div className="flex min-w-0 items-center gap-2.5">
          {onOpenSources && (
            <button
              type="button"
              onClick={onOpenSources}
              aria-label={`Show sources${sourceCount ? ` (${sourceCount})` : ""}`}
              className="flex shrink-0 items-center gap-1 rounded-xl border border-rule px-2.5 py-1.5 text-[11px] font-medium text-neutral-600 transition hover:bg-vessel md:hidden"
            >
              <PanelLeft className="h-3.5 w-3.5" />
              {sourceCount ?? ""}
            </button>
          )}

          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-white shadow-xs">
            <Bot className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-ink">
              Chat
            </h2>
            <p className="hidden text-[11px] text-neutral-400 sm:block">
              Answers grounded only in your sources
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onOpenStudio && (
            <button
              type="button"
              onClick={onOpenStudio}
              aria-label="Show studio"
              className="flex shrink-0 items-center gap-1 rounded-xl border border-rule px-2.5 py-1.5 text-[11px] font-medium text-neutral-600 transition hover:bg-vessel lg:hidden"
            >
              <Layers className="h-3.5 w-3.5" />
            </button>
          )}

          {/* Chat Export Control */}
          {messages.length > 0 && (
            <button
              type="button"
              onClick={handleExportChatMarkdown}
              title="Export as Markdown"
              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-vessel hover:bg-neutral-100 border border-rule text-accent rounded-xl transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export</span>
            </button>
          )}

          <div className="flex min-w-0 items-center gap-1.5">
            <Languages className="hidden h-3.5 w-3.5 shrink-0 text-neutral-400 sm:block" />
            <div className="flex max-w-full overflow-x-auto rounded-full bg-vessel border border-rule p-0.5 text-[11px] font-medium">
              <button
                type="button"
                onClick={reset}
                title="Answer in whatever language the question is asked in"
                aria-pressed={!isExplicit}
                className={`shrink-0 rounded-full px-2.5 py-1 transition ${
                  !isExplicit
                    ? "bg-white text-ink font-semibold shadow-xs"
                    : "text-neutral-500 hover:text-ink"
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
                    className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 transition ${
                      active
                        ? "bg-white text-ink font-semibold shadow-xs"
                        : "text-neutral-500 hover:text-ink"
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
          <div className="space-y-6" aria-label="Loading conversation history">
            {[
              { align: "left", width: "w-2/3" },
              { align: "right", width: "w-1/2" },
              { align: "left", width: "w-3/4" },
            ].map((row, i) => (
              <div
                key={i}
                className={`flex gap-2.5 md:gap-3 ${row.align === "right" ? "ml-auto flex-row-reverse max-w-3xl" : "max-w-3xl"}`}
              >
                <div className="h-7 w-7 shrink-0 rounded-full bg-rule animate-pulse" />
                <div className={`h-16 ${row.width} rounded-xl bg-rule animate-pulse`} />
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full max-w-md mx-auto text-center space-y-4 py-12">
            <div className="w-12 h-12 rounded-2xl bg-vessel border border-rule flex items-center justify-center text-neutral-400">
              <MessageSquare className="w-6 h-6 text-accent" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-ink">Start a Conversation</h3>
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
                  className="w-full text-left p-3 text-xs text-ink bg-vessel hover:bg-neutral-100 rounded-xl border border-rule transition flex items-center justify-between group cursor-pointer"
                >
                  <span>{promptText}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-neutral-400 group-hover:text-accent transition" />
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
              userImageUrl={user?.imageUrl}
              onCitationClick={handleCitationClick}
            />
          ))
        )}

        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-neutral-500 italic">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
            <span>Retrieving sources and generating a response...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <div className="p-4 border-t border-rule bg-white">
        {!isSignedIn ? (
          <div className="flex items-center justify-between gap-3 p-3 bg-vessel border border-rule rounded-2xl text-xs">
            <span className="text-ink font-medium">
              Sign in to start chatting with this notebook.
            </span>
            <SignInButton mode="modal">
              <button
                type="button"
                className="px-4 py-2 bg-ink hover:bg-accent text-white font-semibold rounded-xl shadow-sm transition cursor-pointer text-xs shrink-0"
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
              placeholder="Ask a question about your sources..."
              className="w-full pl-4 pr-12 py-3 text-xs bg-vessel border border-rule rounded-2xl outline-none focus:ring-2 focus:ring-accent focus:bg-white text-ink placeholder:text-neutral-400 transition"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="absolute right-2 p-2.5 bg-ink text-white rounded-xl hover:bg-accent disabled:opacity-40 transition cursor-pointer shadow-sm"
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
 * Memoized Chat Message Bubble supporting User Profile Image fallback.
 */
const ChatMessageBubble = memo(function ChatMessageBubble({
  message: m,
  isLoading,
  userImageUrl,
  onCitationClick,
}: {
  message: MessageItem;
  isLoading: boolean;
  userImageUrl?: string | null;
  onCitationClick: (c: CitationPayload) => void;
}) {
  const isUser = m.role === "user";
  const [imageError, setImageError] = useState(false);

  return (
    <div
      className={`flex max-w-3xl gap-2.5 md:gap-3 ${
        isUser ? "ml-auto flex-row-reverse" : ""
      }`}
    >
      {/* Avatar */}
      <div
        className={`flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold overflow-hidden border-2 border-rule shadow-2xs ${
          isUser
            ? "bg-accent/10 text-accent border-accent/30"
            : "bg-[#141A22] text-white"
        }`}
      >
        {isUser ? (
          userImageUrl && !imageError ? (
            <img
              src={userImageUrl}
              alt="User Avatar"
              className="h-full w-full object-cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <User className="h-5 w-5" />
          )
        ) : (
          <Bot className="h-5 w-5" />
        )}
      </div>

      <div className={`min-w-0 max-w-[85%] space-y-3 ${isUser ? "items-end" : ""}`}>
        {!isUser && m.trace && (
          <RetrievalTrace trace={m.trace} isStreaming={isLoading && !m.content} />
        )}

        {m.content && (
          <div
            className={`overflow-hidden break-words rounded-xl p-3.5 text-xs leading-relaxed md:p-4 shadow-xs ${
              isUser
                ? "rounded-tr-none bg-ink text-white font-medium"
                : "rounded-tl-none border border-rule bg-vessel text-ink"
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
              <BookOpen className="w-3 h-3 text-found" />
              <span>Citations ({m.citations.length})</span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {m.citations.map((c) => (
                <button
                  key={c.number}
                  type="button"
                  onClick={() => onCitationClick(c)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium bg-white hover:bg-neutral-50 border border-rule rounded-lg shadow-xs text-ink hover:border-accent transition cursor-pointer"
                >
                  <span className="font-semibold text-found bg-found/10 px-1 rounded border border-found/20">
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

/**
 * Renders citation markers as clickable chips and inline Markdown formatting.
 */
function renderProseWithInlineCitations(
  content: string,
  citations: CitationPayload[] | null | undefined,
  onCitationClick: (c: CitationPayload) => void
) {
  const citationMap = new Map<number, CitationPayload>();
  (citations || []).forEach((c) => citationMap.set(c.number, c));

  const regex = /\[(\d+)\]|\*\*(.+?)\*\*|\*(.+?)\*/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(content)) !== null) {
    const beforeText = content.substring(lastIndex, match.index);
    if (beforeText) parts.push(beforeText);

    const [, citationNum, bold, italic] = match;

    if (citationNum !== undefined) {
      const num = parseInt(citationNum, 10);
      const cit = citationMap.get(num);
      if (cit) {
        parts.push(
          <button
            key={key++}
            type="button"
            onClick={() => onCitationClick(cit)}
            title={`${cit.title} (${cit.humanLocator || ""})`}
            className="inline-flex items-center justify-center mx-0.5 px-1.5 py-0.2 text-[10px] font-bold text-found bg-found/10 hover:bg-found/20 rounded border border-found/30 transition cursor-pointer"
          >
            [{num}]
          </button>
        );
      } else {
        parts.push(match[0]);
      }
    } else if (bold !== undefined) {
      parts.push(<strong key={key++} className="font-semibold">{bold}</strong>);
    } else if (italic !== undefined) {
      parts.push(<em key={key++}>{italic}</em>);
    }

    lastIndex = regex.lastIndex;
  }

  const remainingText = content.substring(lastIndex);
  if (remainingText) parts.push(remainingText);

  return <div className="whitespace-pre-wrap leading-relaxed">{parts}</div>;
}
