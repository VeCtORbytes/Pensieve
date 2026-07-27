import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { qdrant, NOTEBOOK_COLLECTION_NAME, ensureCollection } from "@/lib/qdrant";
import { generateEmbeddings } from "@/lib/embeddings";
import { Locator, VariantKind } from "@/lib/locator";
import { locatorLabel } from "@/lib/formatLocator";
import { selectForContext } from "@/lib/retrieval";
import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";

export const maxDuration = 60;

export interface CandidateTrace {
  score: number;
  kept: boolean;
  title: string;
  humanLocator: string;
  variant?: VariantKind;
}

export interface RetrievalTracePayload {
  totalChunks: number;
  candidates: CandidateTrace[];
  floor: number;
  readingVariant?: VariantKind;
  stepBackQuery?: string;
  hydePassage?: string;
  rewrittenQuery?: string;
}

export interface CitationPayload {
  number: number;
  sourceId: string;
  title: string;
  chunkIndex: number;
  text: string;
  score: number;
  locator?: Locator | null;
  humanLocator?: string;
  variant?: VariantKind;
}

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const notebookId = searchParams.get("notebookId");

  if (!notebookId) {
    return NextResponse.json({ error: "notebookId parameter is required" }, { status: 400 });
  }

  const messages = await db.message.findMany({
    where: { notebookId },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(messages);
}

export async function POST(req: NextRequest) {
  const t0 = performance.now();

  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Authentication required to chat" }, { status: 401 });
    }

    const { messages, notebookId } = await req.json();

    if (!notebookId || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "notebookId and messages array are required" },
        { status: 400 }
      );
    }

    const lastMessage = messages[messages.length - 1];
    const userPrompt = typeof lastMessage.content === "string" ? lastMessage.content : "";

    if (!userPrompt.trim()) {
      return NextResponse.json({ error: "Message content cannot be empty" }, { status: 400 });
    }

    await ensureCollection();

    // 1. Direct Ultra Fast Single Embedding (~80ms)
    const tEmbed0 = performance.now();
    const [queryVector] = await generateEmbeddings([userPrompt]);
    const embeddingMs = +(performance.now() - tEmbed0).toFixed(2);

    // 2. Direct Qdrant Vector Search (~30ms)
    const tSearch0 = performance.now();
    const hits = await qdrant.search(NOTEBOOK_COLLECTION_NAME, {
      vector: queryVector,
      filter: {
        must: [{ key: "notebookId", match: { value: notebookId } }],
      },
      limit: 12,
      with_payload: true,
    });
    const searchMs = +(performance.now() - tSearch0).toFixed(2);

    // 3. Score Filter & Diversity Selection (Max 6 chunks, max 2 per source)
    const filteredHits = hits.filter((h) => h.score >= 0.18);
    const selectedPoints = selectForContext(filteredHits, 6, 2);

    // 4. Format Citations directly from point payloads (Zero DB Lookup!)
    const citations: CitationPayload[] = selectedPoints.map((p, idx) => {
      const payload = p.payload || {};
      const sId = (payload.sourceId as string) || "";
      const loc = (payload.locator as Locator) || null;
      const title = (payload.title as string) || (payload.sourceTitle as string) || "Notebook Source";
      const type = (payload.type as string) || (payload.sourceType as string) || "TEXT";
      const label = locatorLabel(type, loc);

      return {
        number: idx + 1,
        sourceId: sId,
        title,
        chunkIndex: (payload.chunkIndex as number) ?? idx,
        text: (payload.text as string) || "",
        score: +p.score.toFixed(3),
        locator: loc || undefined,
        humanLocator: label || `Chunk #${(payload.chunkIndex as number) ?? idx}`,
        variant: "ORIGINAL",
      };
    });

    const contextString = citations.length > 0
      ? citations
          .map(
            (c) =>
              `[${c.number}] Source: "${c.title}" ${c.humanLocator ? `(${c.humanLocator})` : ""}\nContent: ${c.text}`
          )
          .join("\n\n")
      : "No relevant context sources available.";

    const isGreetingOrMeta = /^(hi|hello|hey|greetings|who are you|what is this|what can you do|help)\b/i.test(
      userPrompt.trim()
    );

    const systemPrompt = `You are Pensieve AI Notebook, a grounded research assistant.
${
  isGreetingOrMeta
    ? "The user is greeting you or asking about capabilities. Respond warmly, introduce yourself as Pensieve AI Notebook, and explain that you answer questions grounded strictly in their ingested documents with exact page and timestamp citations."
    : "Answer the user's question accurately using ONLY the numbered context sources below. When stating facts from context, cite the source using brackets like [1], [2]. If the provided sources do not contain enough information to answer the question, state clearly that the sources do not cover it and stop. Do NOT invent information or use general knowledge."
}

=== NUMBERED CONTEXT SOURCES ===
${contextString}
=================================`;

    const trace = {
      totalChunks: hits.length,
      candidates: hits.map((p) => ({
        score: +p.score.toFixed(3),
        kept: selectedPoints.includes(p),
        title: (p.payload?.title as string) || "Source",
        humanLocator: locatorLabel((p.payload?.type as string) || "TEXT", p.payload?.locator as Locator),
      })),
      floor: 0.18,
      readingVariant: "ORIGINAL" as VariantKind,
    };

    const preLlmOverheadMs = +(performance.now() - t0).toFixed(2);
    console.log(`[FAST-PATH RAG] Pre-LLM Retrieval Overhead: ${preLlmOverheadMs}ms (Embedding: ${embeddingMs}ms, Search: ${searchMs}ms)`);

    // Stream LLM Response
    const result = streamText({
      model: openai("gpt-4o-mini"),
      system: systemPrompt,
      messages: messages.map((m: any) => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content as string,
      })),
      async onFinish({ text }) {
        // Non-blocking database persistence in background
        try {
          await db.message.createMany({
            data: [
              { notebookId, role: "user", content: userPrompt },
              { notebookId, role: "assistant", content: text, citations: citations as any },
            ],
          });
        } catch (dbErr) {
          console.error("Failed async persistence:", dbErr);
        }
      },
    });

    const encoder = new TextEncoder();
    let isFirstTokenCaptured = false;

    const customStream = new ReadableStream({
      async start(controller) {
        controller.enqueue(
          encoder.encode(`2:${JSON.stringify([{ type: "trace", data: trace }])}\n`)
        );
        controller.enqueue(
          encoder.encode(`2:${JSON.stringify([{ type: "citations", data: citations }])}\n`)
        );

        for await (const textChunk of result.textStream) {
          if (!isFirstTokenCaptured) {
            const ttftMs = +(performance.now() - t0).toFixed(2);
            console.log(`[FAST-PATH RAG] Time to First Token (TTFT): ${ttftMs}ms`);
            isFirstTokenCaptured = true;
          }
          controller.enqueue(encoder.encode(`0:${JSON.stringify(textChunk)}\n`));
        }

        const totalMs = +(performance.now() - t0).toFixed(2);
        console.log(`[FAST-PATH RAG] Stream Completed Total Latency: ${totalMs}ms`);
        controller.close();
      },
    });

    return new Response(customStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error: any) {
    console.error("Fast RAG API error:", error);
    return NextResponse.json({ error: error.message || "Failed to process chat" }, { status: 500 });
  }
}
