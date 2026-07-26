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
import { CitationPayload } from "@/app/api/chat/route";

interface MessageItem {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: CitationPayload[] | null;
}

interface DBMessage {
  id: string;
  notebookId: string;
  role: "user" | "assistant" | "system";
  content: string;
  citations?: CitationPayload[] | null;
  createdAt: string;
}

export default function ChatPanel({ notebookId }: { notebookId: string }) {
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [selectedCitation, setSelectedCitation] = useState<CitationPayload | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

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

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notebookId,
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to generate response");
      }

      // Read Citations from Response Header
      const rawCitationsHeader = res.headers.get("X-Citations");
      if (rawCitationsHeader) {
        try {
          citations = JSON.parse(decodeURIComponent(rawCitationsHeader));
        } catch (e) {
          console.error("Failed to decode X-Citations header:", e);
        }
      }

      // Add initial assistant placeholder
      setMessages((prev) => [
        ...prev,
        {
          id: assistantMsgId,
          role: "assistant",
          content: "",
          citations,
        },
      ]);

      // Stream text chunk by chunk
      if (res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let accumulatedText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          accumulatedText += chunk;

          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? { ...msg, content: accumulatedText, citations }
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
      <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 bg-white">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-neutral-900 text-white flex items-center justify-center shadow-xs">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-neutral-900">Notebook AI Assistant</h2>
            <p className="text-[11px] text-neutral-400">RAG Chat with real-time citations</p>
          </div>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
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
                className={`flex gap-3 max-w-3xl ${isUser ? "ml-auto flex-row-reverse" : ""}`}
              >
                {/* Avatar */}
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-semibold ${
                    isUser
                      ? "bg-neutral-900 text-white"
                      : "bg-emerald-600 text-white shadow-xs"
                  }`}
                >
                  {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                {/* Message Content */}
                <div className={`space-y-2 max-w-[85%] ${isUser ? "items-end" : ""}`}>
                  <div
                    className={`p-4 rounded-2xl text-xs leading-relaxed ${
                      isUser
                        ? "bg-neutral-900 text-white rounded-tr-none"
                        : "bg-neutral-100/80 text-neutral-800 rounded-tl-none border border-neutral-200/60"
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{m.content}</div>
                  </div>

                  {/* Citation Chips under Assistant Answer */}
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
                            onClick={() => setSelectedCitation(c)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium bg-white hover:bg-neutral-50 border border-neutral-200 rounded-lg shadow-xs text-neutral-700 hover:border-neutral-400 transition cursor-pointer"
                          >
                            <span className="font-semibold text-emerald-700 bg-emerald-50 px-1 rounded">
                              [{c.number}]
                            </span>
                            <span className="max-w-[140px] truncate">{c.title}</span>
                            <span className="text-[10px] text-neutral-400">
                              (chunk {c.chunkIndex})
                            </span>
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
            <span>Searching sources & generating answer...</span>
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
            placeholder="Ask a question about your notebook sources..."
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

      {/* Citation Detail Modal */}
      {selectedCitation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
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
                    Chunk Index #{selectedCitation.chunkIndex} • Similarity Score:{" "}
                    {(selectedCitation.score * 100).toFixed(1)}%
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

            <div className="flex justify-end pt-2">
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
    </div>
  );
}
