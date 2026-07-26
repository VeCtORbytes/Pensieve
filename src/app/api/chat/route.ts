import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { qdrant, NOTEBOOK_COLLECTION_NAME, ensureCollection } from "@/lib/qdrant";
import { generateEmbeddings } from "@/lib/embeddings";
import { Locator, VariantKind, isVariantKind } from "@/lib/locator";
import { locatorLabel } from "@/lib/formatLocator";
import {
  dedupeByPassage,
  inferReadingVariant,
  resolveAnswerLanguage,
  selectForContext,
} from "@/lib/retrieval";
import { loadVariantsForSources, sliceVariant } from "@/lib/variants";
import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";

export const maxDuration = 60;

export interface CandidateTrace {
  score: number;
  kept: boolean;
  title: string;
  humanLocator: string;
  /** Which language rendering this chunk was indexed from. */
  variant?: VariantKind;
  /** Set when this hit was dropped as the same passage in another language. */
  duplicateOf?: VariantKind;
}

export interface RetrievalTracePayload {
  totalChunks: number;
  candidates: CandidateTrace[];
  floor: number;
  /** Language the context and answer were rendered in. */
  readingVariant?: VariantKind;
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
  /** Variant the quoted text is rendered in, so the viewer opens to match. */
  variant?: VariantKind;
  /** Variant whose vectors actually matched, which may differ from `variant`. */
  matchedVariant?: VariantKind;
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
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Authentication required to chat" }, { status: 401 });
    }

    const { messages, notebookId, variant } = await req.json();

    if (!notebookId || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "notebookId and messages array are required" },
        { status: 400 }
      );
    }

    const explicitVariant: VariantKind | null = isVariantKind(variant) ? variant : null;

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
    let readingVariant: VariantKind = explicitVariant ?? "ORIGINAL";
    let trace: RetrievalTracePayload = {
      totalChunks,
      candidates: [],
      floor: 0,
      readingVariant,
    };
    let answerLanguage: string | null = null;

    try {
      // 2. Generate Query Embedding
      const [queryVector] = await generateEmbeddings([userPrompt]);

      // 3. Search Qdrant candidates (top 20)
      await ensureCollection();

      const searchResult = await qdrant.search(NOTEBOOK_COLLECTION_NAME, {
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

      if (searchResult && searchResult.length > 0) {
        // 4. Score Floor Filtering
        // Adjusted ABSOLUTE_FLOOR to 0.20 (from 0.28) so valid semantic matches
        // on conceptual topics (e.g. hormones, biology) clear the floor cleanly.
        const ABSOLUTE_FLOOR = 0.20;
        const RELATIVE_FLOOR_RATIO = 0.50;
        const topScore = searchResult[0].score || 0;
        const floor = Math.max(ABSOLUTE_FLOOR, +(topScore * RELATIVE_FLOOR_RATIO).toFixed(3));

        let scoredPoints = searchResult.filter((p) => p.score >= floor);

        // Soft Fallback: If strict floor filtered everything out but candidates exist with score >= 0.18,
        // take top 3 candidate passages so the LLM gets valid context to answer from.
        if (scoredPoints.length === 0 && searchResult.length > 0 && searchResult[0].score >= 0.18) {
          scoredPoints = searchResult.slice(0, 3);
        }

        // 5. Cross-variant dedupe
        const { kept: candidatePoints, duplicateOf: duplicateReason } =
          dedupeByPassage(scoredPoints);

        // 6. Diversity Selection
        const MAX_CONTEXT_CHUNKS = 6;
        const MAX_PER_SOURCE = 2;

        const selectedPoints = selectForContext(
          candidatePoints,
          MAX_CONTEXT_CHUNKS,
          MAX_PER_SOURCE
        );

        // Fetch Source Titles & Types
        const sourceIds = Array.from(
          new Set(searchResult.map((p) => (p.payload?.sourceId as string) || ""))
        ).filter(Boolean);

        const sourceRecords = await db.source.findMany({
          where: { id: { in: sourceIds } },
          select: { id: true, title: true, type: true, language: true },
        });

        const titleMap = new Map<
          string,
          { title: string; type: string; language: string | null }
        >();
        sourceRecords.forEach((s) =>
          titleMap.set(s.id, { title: s.title, type: s.type, language: s.language })
        );

        // 7. Resolve reading language
        const topSourceId = (selectedPoints[0]?.payload?.sourceId as string) || "";
        const topSourceLanguage = titleMap.get(topSourceId)?.language ?? null;

        if (!explicitVariant) {
          readingVariant = await inferReadingVariant(userPrompt, topSourceLanguage);
        }

        // 8. Build Trace Payload
        trace = {
          totalChunks,
          candidates: searchResult.map((p) => {
            const sId = (p.payload?.sourceId as string) || "";
            const meta = titleMap.get(sId) || { title: "Source", type: "TEXT", language: null };
            const loc = (p.payload?.locator as Locator) || null;
            return {
              score: +p.score.toFixed(3),
              kept: selectedPoints.includes(p),
              title: meta.title,
              humanLocator: locatorLabel(meta.type, loc),
              variant: (p.payload?.variantKind as VariantKind) || "ORIGINAL",
              duplicateOf: duplicateReason.get(String(p.id)),
            };
          }),
          floor,
          readingVariant,
        };

        // 9. Format Citations
        const selectedSourceIds = Array.from(
          new Set(selectedPoints.map((p) => (p.payload?.sourceId as string) || "").filter(Boolean))
        );
        const readingVariants = await loadVariantsForSources(selectedSourceIds, readingVariant);

        const fallbackVariants =
          readingVariant === "ORIGINAL"
            ? new Map()
            : await loadVariantsForSources(selectedSourceIds, "ORIGINAL");

        citations = selectedPoints.map((p, idx) => {
          const sId = (p.payload?.sourceId as string) || "";
          const meta =
            titleMap.get(sId) || { title: "Untitled Source", type: "TEXT", language: null };
          const loc = (p.payload?.locator as Locator) || null;
          const label = locatorLabel(meta.type, loc);
          const matchedVariant = (p.payload?.variantKind as VariantKind) || "ORIGINAL";

          const inReadingVariant = sliceVariant(
            readingVariants.get(sId),
            loc?.segStart,
            loc?.segEnd
          );
          const rendered =
            inReadingVariant ??
            sliceVariant(fallbackVariants.get(sId), loc?.segStart, loc?.segEnd);
          const usedReadingVariant = inReadingVariant !== null;

          return {
            number: idx + 1,
            sourceId: sId,
            title: meta.title,
            chunkIndex: (p.payload?.chunkIndex as number) ?? 0,
            text: rendered ?? ((p.payload?.text as string) || ""),
            score: +p.score.toFixed(3),
            locator: loc || undefined,
            humanLocator: label || `Chunk #${(p.payload?.chunkIndex as number) ?? idx}`,
            variant: usedReadingVariant ? readingVariant : matchedVariant,
            matchedVariant,
          };
        });

        if (citations.length > 0) {
          contextString = citations
            .map(
              (c) =>
                `[${c.number}] Source: "${c.title}" ${c.humanLocator ? `(${c.humanLocator})` : ""}\nContent: ${c.text}`
            )
            .join("\n\n");

          answerLanguage = resolveAnswerLanguage(readingVariant, topSourceLanguage);
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

    const isGreetingOrMeta = /^(hi|hello|hey|greetings|who are you|what is this|what can you do|help)\b/i.test(
      userPrompt.trim()
    );

    const languageDirective = answerLanguage
      ? `\nWrite your entire answer in ${answerLanguage}, matching the language the context sources are written in. Keep [1], [2] citation markers as numbers in square brackets.`
      : "";

    const systemPrompt = `You are Pensieve AI Notebook, a grounded research assistant.
${
  isGreetingOrMeta
    ? "The user is greeting you or asking about capabilities. Respond warmly, introduce yourself as Pensieve AI Notebook, and explain that you answer questions grounded strictly in their ingested documents with exact page and timestamp citations."
    : "Answer the user's question accurately using ONLY the numbered context sources below. When stating facts from context, cite the source using brackets like [1], [2]. If the provided sources do not contain enough information to answer the question, state clearly that the sources do not cover it and stop. Do NOT invent information or use general knowledge."
}
${languageDirective}

=== NUMBERED CONTEXT SOURCES ===
${contextString}
=================================`;

    // Stream Response using ReadableStream data protocol
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
        controller.enqueue(
          encoder.encode(`2:${JSON.stringify([{ type: "trace", data: trace }])}\n`)
        );
        controller.enqueue(
          encoder.encode(`2:${JSON.stringify([{ type: "citations", data: citations }])}\n`)
        );

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
