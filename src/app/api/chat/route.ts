import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { qdrant, NOTEBOOK_COLLECTION_NAME } from "@/lib/qdrant";
import { generateEmbeddings } from "@/lib/embeddings";
import { Locator } from "@/lib/locator";
import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";

export const maxDuration = 60;

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

    // 1. Generate Embedding for User Prompt
    let citations: CitationPayload[] = [];
    let contextString = "No relevant context sources available.";

    try {
      const [queryVector] = await generateEmbeddings([userPrompt]);

      // 2. Retrieve Top 20 Candidates from Qdrant with self-healing index retry
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
        // 3. Deduplicate / Diversity Reranking (Max 2 chunks per source, top 6 total)
        const selectedPoints: typeof searchResult = [];
        const sourceCounts = new Map<string, number>();

        for (const point of searchResult) {
          const sId = (point.payload?.sourceId as string) || "unknown";
          const count = sourceCounts.get(sId) || 0;
          if (count < 2) {
            selectedPoints.push(point);
            sourceCounts.set(sId, count + 1);
            if (selectedPoints.length >= 6) break;
          }
        }

        if (selectedPoints.length < 6) {
          for (const point of searchResult) {
            if (!selectedPoints.includes(point)) {
              selectedPoints.push(point);
              if (selectedPoints.length >= 6) break;
            }
          }
        }

        // 4. Fetch Source Titles from PostgreSQL
        const sourceIds = Array.from(
          new Set(selectedPoints.map((p) => (p.payload?.sourceId as string) || ""))
        ).filter(Boolean);

        const sourceRecords = await db.source.findMany({
          where: { id: { in: sourceIds } },
          select: { id: true, title: true, type: true },
        });

        const titleMap = new Map<string, { title: string; type: string }>();
        sourceRecords.forEach((s) => titleMap.set(s.id, { title: s.title, type: s.type }));

        // 5. Format Numbered Citations & Human Locators
        citations = selectedPoints.map((p, idx) => {
          const sId = (p.payload?.sourceId as string) || "";
          const meta = titleMap.get(sId) || { title: "Untitled Source", type: "TEXT" };
          const locator = (p.payload?.locator as Locator) || {};

          let humanLocator = `Chunk #${(p.payload?.chunkIndex as number) ?? idx}`;
          if (locator.page) {
            humanLocator = `Page ${locator.page}`;
          } else if (locator.startSec !== undefined && locator.startSec !== null) {
            const mins = Math.floor(locator.startSec / 60);
            const secs = (locator.startSec % 60).toString().padStart(2, "0");
            humanLocator = `${mins}:${secs}`;
          } else if (locator.heading) {
            humanLocator = locator.heading;
          } else if (locator.charStart !== undefined && locator.charEnd !== undefined) {
            humanLocator = `Chars ${locator.charStart}–${locator.charEnd}`;
          }

          return {
            number: idx + 1,
            sourceId: sId,
            title: meta.title,
            chunkIndex: (p.payload?.chunkIndex as number) ?? 0,
            text: (p.payload?.text as string) || "",
            score: p.score,
            locator,
            humanLocator,
          };
        });

        contextString = citations
          .map(
            (c) =>
              `[${c.number}] Source: "${c.title}" (${c.humanLocator})\nContent: ${c.text}`
          )
          .join("\n\n");
      }
    } catch (retrievalErr) {
      console.error("Vector retrieval error (proceeding without context):", retrievalErr);
    }

    // Save User Message to DB
    await db.message.create({
      data: {
        notebookId,
        role: "user",
        content: userPrompt,
      },
    });

    // Strict Grounding System Prompt
    const systemPrompt = `You are Pensieve AI Notebook, an expert grounded research assistant.
Answer the user's request accurately using ONLY the provided numbered context sources below.
When using information from a context chunk, cite it directly in your response text using bracket format like [1], [2], etc.
If the context does not contain enough information to answer the question, state that clearly and refuse to invent details outside the sources.

=== NUMBERED CONTEXT SOURCES ===
${contextString}
=================================`;

    // 6. Stream Response using Vercel AI SDK
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

    // Pass citations payload encoded in response header
    const responseHeaders = new Headers();
    responseHeaders.set("X-Citations", encodeURIComponent(JSON.stringify(citations)));

    return result.toTextStreamResponse({
      headers: responseHeaders,
    });
  } catch (error: any) {
    console.error("Chat API error:", error);
    return NextResponse.json({ error: error.message || "Failed to process chat" }, { status: 500 });
  }
}
