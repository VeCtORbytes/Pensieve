import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { qdrant, NOTEBOOK_COLLECTION_NAME } from "@/lib/qdrant";
import { generateEmbeddings } from "@/lib/embeddings";
import { Locator } from "@/lib/locator";
import { locatorLabel } from "@/lib/formatLocator";
import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";

export const maxDuration = 60;

export interface CandidateTrace {
  score: number;
  kept: boolean;
  title: string;
  humanLocator: string;
}

export interface RetrievalTracePayload {
  totalChunks: number;
  candidates: CandidateTrace[];
  floor: number;
}

export interface CitationPayload {
  number: number;
  sourceId: string;
  title: string;
  chunkIndex: number;
  text: string;
  score: number;
  locator?: Locator;
  humanLocator?: string;
}

export async function GET(req: NextRequest) {
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
  try {
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

    // 1. Calculate Total Chunks across notebook sources in PostgreSQL
    const sourceAgg = await db.source.aggregate({
      where: { notebookId },
      _sum: { chunkCount: true },
    });
    const totalChunks = sourceAgg._sum.chunkCount || 0;

    let citations: CitationPayload[] = [];
    let contextString = "No relevant context sources available.";
    let trace: RetrievalTracePayload = {
      totalChunks,
      candidates: [],
      floor: 0,
    };

    try {
      // 2. Generate Query Embedding
      const [queryVector] = await generateEmbeddings([userPrompt]);

      // 3. Search Qdrant candidates (top 20) with self-healing payload index check
      let searchResult;
      try {
        searchResult = await qdrant.search(NOTEBOOK_COLLECTION_NAME, {
          vector: queryVector,
          filter: {
            must: [
              {
                key: "notebookId",
                match: { value: notebookId },
              },
            ],
          },
          limit: 20,
        });
      } catch (err: any) {
        if (err?.data?.status?.error?.includes("Index required")) {
          console.warn("Payload index missing on Qdrant, creating index for notebookId...");
          await qdrant.createPayloadIndex(NOTEBOOK_COLLECTION_NAME, {
            field_name: "notebookId",
            field_schema: "keyword",
          });
          searchResult = await qdrant.search(NOTEBOOK_COLLECTION_NAME, {
            vector: queryVector,
            filter: {
              must: [
                {
                  key: "notebookId",
                  match: { value: notebookId },
                },
              ],
            },
            limit: 20,
          });
        } else {
          throw err;
        }
      }

      if (searchResult && searchResult.length > 0) {
        // 4. Score Floor Filtering (Floor = max(ABSOLUTE_FLOOR, topScore * 0.7))
        const ABSOLUTE_FLOOR = 0.28;
        const topScore = searchResult[0].score || 0;
        const floor = Math.max(ABSOLUTE_FLOOR, +(topScore * 0.7).toFixed(3));

        const candidatePoints = searchResult.filter((p) => p.score >= floor);

        // 5. Diversity Selection (Max 2 per source, NO backfill loop!)
        const selectedPoints: typeof searchResult = [];
        const sourceCounts = new Map<string, number>();

        for (const point of candidatePoints) {
          const sId = (point.payload?.sourceId as string) || "unknown";
          const count = sourceCounts.get(sId) || 0;
          if (count < 2) {
            selectedPoints.push(point);
            sourceCounts.set(sId, count + 1);
            if (selectedPoints.length >= 6) break;
          }
        }

        // Fetch Source Titles & Types
        const sourceIds = Array.from(
          new Set(searchResult.map((p) => (p.payload?.sourceId as string) || ""))
        ).filter(Boolean);

        const sourceRecords = await db.source.findMany({
          where: { id: { in: sourceIds } },
          select: { id: true, title: true, type: true },
        });

        const titleMap = new Map<string, { title: string; type: string }>();
        sourceRecords.forEach((s) => titleMap.set(s.id, { title: s.title, type: s.type }));

        // 6. Build Trace Payload
        trace = {
          totalChunks,
          candidates: searchResult.map((p) => {
            const sId = (p.payload?.sourceId as string) || "";
            const meta = titleMap.get(sId) || { title: "Source", type: "TEXT" };
            const loc = (p.payload?.locator as Locator) || null;
            return {
              score: +p.score.toFixed(3),
              kept: selectedPoints.includes(p),
              title: meta.title,
              humanLocator: locatorLabel(meta.type, loc),
            };
          }),
          floor,
        };

        // 7. Format Citations
        citations = selectedPoints.map((p, idx) => {
          const sId = (p.payload?.sourceId as string) || "";
          const meta = titleMap.get(sId) || { title: "Untitled Source", type: "TEXT" };
          const loc = (p.payload?.locator as Locator) || null;
          const label = locatorLabel(meta.type, loc);

          return {
            number: idx + 1,
            sourceId: sId,
            title: meta.title,
            chunkIndex: (p.payload?.chunkIndex as number) ?? 0,
            text: (p.payload?.text as string) || "",
            score: +p.score.toFixed(3),
            locator: loc || undefined,
            humanLocator: label || `Chunk #${(p.payload?.chunkIndex as number) ?? idx}`,
          };
        });

        if (citations.length > 0) {
          contextString = citations
            .map(
              (c) =>
                `[${c.number}] Source: "${c.title}" ${c.humanLocator ? `(${c.humanLocator})` : ""}\nContent: ${c.text}`
            )
            .join("\n\n");
        }
      }
    } catch (retrievalErr) {
      console.error("Vector retrieval error (proceeding without context):", retrievalErr);
    }

    // Save User Message to PostgreSQL
    await db.message.create({
      data: {
        notebookId,
        role: "user",
        content: userPrompt,
      },
    });

    // Strict Refusal Grounding Prompt
    const systemPrompt = `You are Pensieve AI Notebook, an expert grounded research assistant.
Answer the user's question using ONLY the numbered context sources below.
When stating facts from context, cite the source using brackets like [1], [2].
If the provided sources do not contain enough information to answer the question, state clearly that the sources do not cover it and stop. Do NOT invent information or use general knowledge.

=== NUMBERED CONTEXT SOURCES ===
${contextString}
=================================`;

    // 8. Stream Response using ReadableStream data protocol (data-trace, data-citations, then text deltas)
    const result = streamText({
      model: openai("gpt-4o-mini"),
      system: systemPrompt,
      messages: messages.map((m: any) => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content as string,
      })),
      async onFinish({ text }) {
        try {
          await db.message.create({
            data: {
              notebookId,
              role: "assistant",
              content: text,
              citations: citations as any,
            },
          });
        } catch (dbErr) {
          console.error("Failed to save assistant message to DB:", dbErr);
        }
      },
    });

    const encoder = new TextEncoder();
    const customStream = new ReadableStream({
      async start(controller) {
        // Enqueue data-trace and data-citations data parts
        controller.enqueue(
          encoder.encode(`2:${JSON.stringify([{ type: "trace", data: trace }])}\n`)
        );
        controller.enqueue(
          encoder.encode(`2:${JSON.stringify([{ type: "citations", data: citations }])}\n`)
        );

        // Enqueue text stream chunks
        for await (const textChunk of result.textStream) {
          controller.enqueue(encoder.encode(`0:${JSON.stringify(textChunk)}\n`));
        }

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
    console.error("Chat API error:", error);
    return NextResponse.json({ error: error.message || "Failed to process chat" }, { status: 500 });
  }
}
