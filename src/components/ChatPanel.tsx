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
  StickyNote,
  Check,
} from "lucide-react";
import { useAuth, useUser, SignInButton } from "@clerk/nextjs";
import { CitationPayload, RetrievalTracePayload } from "@/app/api/chat/route";
import SourceViewerModal from "@/components/SourceViewerModal";
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
  citations: any;
  createdAt: string;
}

interface ChatPanelProps {
  notebookId: string;
  sourceCount?: number;
  onOpenSources?: () => void;
  onOpenStudio?: () => void;
  onToggleSources?: () => void;
  onToggleStudio?: () => void;
}

export default function ChatPanel({
  notebookId,
  sourceCount,
  onOpenSources,
  onOpenStudio,
  onToggleSources,
  onToggleStudio,
}: ChatPanelProps) {
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);

  // Variant switcher for chat querying
  const { variant, select, isExplicit } = useReadingVariant(notebookId);

  // Citation viewer modal state
  const [selectedViewerSource, setSelectedViewerSource] = useState<{
    id: string;
    title: string;
    type: string;
    url?: string | null;
    blobUrl?: string | null;
    rawText?: string | null;
    createdAt: string;
    locator?: any;
  } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Load chat history from backend database
  useEffect(() => {
    let isMounted = true;

    async function loadChatHistory() {
      try {
        setIsHistoryLoading(true);
        const res = await fetch(`/api/chat?notebookId=${notebookId}`);
        if (!res.ok) throw new Error("Failed to load conversation history");

        const data: { messages: DBMessage[] } = await res.json();
        if (isMounted) {
          const formatted: MessageItem[] = (data.messages || []).map((msg) => ({
            id: msg.id,
            role: msg.role as "user" | "assistant",
            content: msg.content,
            citations: Array.isArray(msg.citations)
              ? (msg.citations as CitationPayload[])
              : null,
            trace: null,
          }));
          setMessages(formatted);
        }
      } catch (err) {
        console.error("Error loading chat history:", err);
      } finally {
        if (isMounted) setIsHistoryLoading(false);
      }
    }

    loadChatHistory();

    return () => {
      isMounted = false;
    };
  }, [notebookId]);

  const handleSend = async (textToSend?: string) => {
    const text = textToSend || input;
    if (!text.trim() || isLoading) return;

    const userMsgId = Date.now().toString();
    const newUserMsg: MessageItem = {
      id: userMsgId,
      role: "user",
      content: text,
    };

    const newMessages = [...messages, newUserMsg];
    setMessages(newMessages);
    if (!textToSend) setInput("");
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
      console.error("Chat error:", err);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? {
                ...msg,
                content:
                  msg.content ||
                  `Sorry, an error occurred while processing your request: ${
                    err.message || "Unknown error"
                  }`,
              }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleCitationClick = useCallback((c: CitationPayload) => {
    setSelectedViewerSource({
      id: c.sourceId,
      title: c.title,
      type: c.type,
      createdAt: new Date().toISOString(),
      locator: c.locator,
    });
  }, []);

  const toggleSourcesHandler = onToggleSources || onOpenSources;
  const toggleStudioHandler = onToggleStudio || onOpenStudio;

  return (
    <div className="flex flex-1 flex-col h-full bg-white relative">
      {/* Subheader / Toolbar for mobile & desktop */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-rule bg-vessel text-xs">
        <div className="flex items-center gap-2">
          {toggleSourcesHandler && (
            <button
              type="button"
              onClick={toggleSourcesHandler}
              className="md:hidden p-1.5 text-neutral-600 hover:bg-neutral-200 rounded-lg transition"
              title="Toggle Sources"
            >
              <PanelLeft className="w-4 h-4" />
            </button>
          )}
          <span className="font-semibold text-ink">Notebook Assistant</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Query Language Switcher */}
          <div className="flex items-center gap-1.5">
            <Languages className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
            <div className="flex bg-white p-0.5 rounded-full border border-rule text-xs font-medium">
              {languageOptions.map((opt) => {
                const active = opt.kind === variant;
                return (
                  <button
                    key={opt.kind}
                    type="button"
                    onClick={() => select(opt.kind)}
                    className={`px-2 py-0.5 rounded-full transition cursor-pointer text-[11px] ${
                      active
                        ? "bg-ink text-white font-semibold shadow-2xs"
                        : "text-neutral-500 hover:text-ink"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {toggleStudioHandler && (
            <button
              type="button"
              onClick={toggleStudioHandler}
              className="md:hidden p-1.5 text-neutral-600 hover:bg-neutral-200 rounded-lg transition"
              title="Toggle Studio"
            >
              <Layers className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        {isHistoryLoading ? (
          <div className="flex flex-col items-center justify-center h-full space-y-3 py-12 text-neutral-400">
            <Loader2 className="w-6 h-6 animate-spin text-accent" />
            <p className="text-xs font-medium">Loading conversation history...</p>
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
              notebookId={notebookId}
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
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2 bg-vessel p-1.5 rounded-2xl border border-rule focus-within:border-accent focus-within:ring-1 focus-within:ring-accent transition shadow-2xs"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question about your sources..."
              className="flex-1 bg-transparent px-3 py-2 text-xs text-ink placeholder:text-neutral-400 outline-none"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="p-2.5 rounded-xl bg-ink text-white hover:bg-accent disabled:opacity-40 transition cursor-pointer shrink-0"
            >
              <Send className="w-4 h-4" />
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
 * Memoized Chat Message Bubble supporting User Profile Image fallback and Pin to Note.
 */
const ChatMessageBubble = memo(function ChatMessageBubble({
  message: m,
  isLoading,
  notebookId,
  userImageUrl,
  onCitationClick,
}: {
  message: MessageItem;
  isLoading: boolean;
  notebookId: string;
  userImageUrl?: string | null;
  onCitationClick: (c: CitationPayload) => void;
}) {
  const isUser = m.role === "user";
  const [imageError, setImageError] = useState(false);
  const [pinned, setPinned] = useState(false);

  async function handlePinToNote() {
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notebookId,
          title: `Insight: ${m.content.slice(0, 30)}...`,
          content: m.content,
        }),
      });
      if (res.ok) {
        setPinned(true);
        setTimeout(() => setPinned(false), 2500);
      }
    } catch (err) {
      console.error("Failed to pin to note:", err);
    }
  }

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

        {/* Pin to Note & Citation Chips */}
        {!isUser && m.content && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <button
              type="button"
              onClick={handlePinToNote}
              className="flex items-center gap-1 text-[11px] font-semibold text-neutral-500 hover:text-amber-600 transition cursor-pointer"
            >
              {pinned ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-600 font-bold">Pinned to Notes!</span>
                </>
              ) : (
                <>
                  <StickyNote className="w-3.5 h-3.5 text-amber-500" />
                  <span>Pin to Note</span>
                </>
              )}
            </button>

            {m.citations && m.citations.length > 0 && (
              <div className="flex items-center gap-1 text-[11px] font-semibold text-neutral-500">
                <BookOpen className="w-3 h-3 text-found" />
                <span>Citations ({m.citations.length})</span>
              </div>
            )}
          </div>
        )}

        {!isUser && m.citations && m.citations.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {m.citations.map((c, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onCitationClick(c)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-vessel hover:bg-neutral-100 border border-rule text-[11px] font-medium text-ink transition cursor-pointer shadow-2xs group"
              >
                <FileText className="w-3 h-3 text-accent group-hover:scale-110 transition" />
                <span className="truncate max-w-[140px]">{c.title}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

function renderProseWithInlineCitations(
  content: string,
  citations?: CitationPayload[] | null,
  onCitationClick?: (c: CitationPayload) => void
) {
  if (!citations || citations.length === 0) {
    return <div className="whitespace-pre-wrap">{content}</div>;
  }

  const parts = content.split(/(\[\d+\])/g);

  return (
    <div className="whitespace-pre-wrap">
      {parts.map((part, index) => {
        const match = part.match(/^\[(\d+)\]$/);
        if (match) {
          const citationNum = parseInt(match[1], 10);
          const citation = citations[citationNum - 1];

          if (citation) {
            return (
              <button
                key={index}
                type="button"
                onClick={() => onCitationClick && onCitationClick(citation)}
                title={`View Source: ${citation.title}`}
                className="inline-flex items-center justify-center mx-0.5 px-1.5 py-0.5 rounded bg-emerald-100 hover:bg-emerald-200 text-found font-mono text-[10px] font-semibold transition cursor-pointer border border-emerald-300"
              >
                [{citationNum}]
              </button>
            );
          }
        }
        return <span key={index}>{part}</span>;
      })}
    </div>
  );
}
