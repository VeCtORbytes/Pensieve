import { NextRequest, NextResponse } from "next/server";
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
  locator?: Locator;
  humanLocator?: string;
  /** Variant the quoted text is rendered in, so the viewer opens to match. */
  variant?: VariantKind;
  /** Variant whose vectors actually matched, which may differ from `variant`. */
  matchedVariant?: VariantKind;
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
    const { messages, notebookId, variant } = await req.json();

    if (!notebookId || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "notebookId and messages array are required" },
        { status: 400 }
      );
    }

    // The reader's explicit language choice, if they made one. When absent the
    // variant is inferred from the question's own language further down, so
    // asking in English about a Hindi source answers in English by default.
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

      // 3. Search Qdrant candidates (top 20). ensureCollection guarantees the
      // collection and the notebookId payload index exist before filtering.
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
        // 4. Score Floor Filtering.
        // The relative floor only trims a long tail when there is a standout
        // match. On text-embedding-3-small genuinely relevant chunks sit around
        // 0.30-0.55, so the ratio has to stay low or a strong top hit raises the
        // bar and prunes valid supporting context.
        const ABSOLUTE_FLOOR = 0.28;
        const RELATIVE_FLOOR_RATIO = 0.55;
        const topScore = searchResult[0].score || 0;
        const floor = Math.max(ABSOLUTE_FLOOR, +(topScore * RELATIVE_FLOOR_RATIO).toFixed(3));

        const scoredPoints = searchResult.filter((p) => p.score >= floor);

        // 5. Cross-variant dedupe.
        // A passage is indexed once per language, so the same content can surface
        // twice — once from the Hindi vectors, once from the English. Segment
        // ordinals are identical across variants, so overlapping ranges from
        // *different* variants are the same passage: keep the better-scoring one.
        // Overlaps within one variant are left alone, since pieces of a long
        // segment are genuinely distinct text.
        const { kept: candidatePoints, duplicateOf: duplicateReason } =
          dedupeByPassage(scoredPoints);

        // 6. Diversity Selection: prefer breadth across sources, then backfill
        // to the context budget so a single-source question still gets enough
        // context to answer (and to summarise) from.
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

        // 7. Resolve the reading language.
        // An explicit choice from the switcher always wins. Otherwise infer it
        // from the question, so an English question about a Hindi source is
        // answered in English rather than silently in Hindi.
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

        // 8. Render the selected passages in the language the reader has open.
        // The chunk that matched may have come from a different variant's
        // vectors; its segment range is re-sliced out of the reading variant so
        // the model quotes what the user actually sees.
        const selectedSourceIds = Array.from(
          new Set(selectedPoints.map((p) => (p.payload?.sourceId as string) || "").filter(Boolean))
        );
        const readingVariants = await loadVariantsForSources(selectedSourceIds, readingVariant);

        // If the reader's language has not been generated for a source yet, the
        // original text is a better fallback than whichever variant happened to
        // match — a Hinglish reader wants the Hindi wording, not the English one.
        const fallbackVariants =
          readingVariant === "ORIGINAL"
            ? new Map()
            : await loadVariantsForSources(selectedSourceIds, "ORIGINAL");

        // 9. Format Citations
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

          // Answer in the language of the text the reader is actually looking at.
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

    // Strict Refusal Grounding Prompt
    const languageDirective = answerLanguage
      ? `\nWrite your entire answer in ${answerLanguage}, matching the language the ` +
        `context sources are written in. Keep the [1], [2] citation markers as digits ` +
        `in square brackets regardless of language.`
      : "";

    const systemPrompt = `You are Pensieve AI Notebook, an expert grounded research assistant.
Answer the user's question using ONLY the numbered context sources below.
When stating facts from context, cite the source using brackets like [1], [2].
If the provided sources do not contain enough information to answer the question, state clearly that the sources do not cover it and stop. Do NOT invent information or use general knowledge.${languageDirective}

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
