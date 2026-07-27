import { generateEmbeddings } from "@/lib/embeddings";
import { qdrant, NOTEBOOK_COLLECTION_NAME, ensureCollection } from "@/lib/qdrant";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

export interface QueryVariants {
  rewrittenQuery: string;
  stepBackQuery: string;
  hydePassage: string;
}

export interface FusedScoredPoint {
  id: string | number;
  score: number;
  rrfScore: number;
  payload: any;
  matchedQueryTypes: string[];
}

export interface AdvancedRAGResult {
  variants: QueryVariants;
  fusedPoints: FusedScoredPoint[];
}

const QueryVariantsSchema = z.object({
  rewrittenQuery: z
    .string()
    .describe("A clear, self-contained standalone query resolving any pronouns or conversational references from chat history."),
  stepBackQuery: z
    .string()
    .describe("A high-level abstract or conceptual question that steps back to ask about the underlying principles, domain, or concepts behind the user's prompt."),
  hydePassage: z
    .string()
    .describe("A short 2-sentence hypothetical answer passage that directly contains facts, terms, and explanations that would ideally appear in a matching document."),
});

/**
 * Generates Query Expansion (Standalone Query, Step-Back Conceptual Query, and HyDE Hypothetical Passage)
 */
export async function generateAdvancedQueryVariants(
  userPrompt: string,
  history: Array<{ role: string; content: string }> = []
): Promise<QueryVariants> {
  const conversationContext = history
    .slice(-4)
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n");

  try {
    const { object } = await generateObject({
      model: openai("gpt-4o-mini"),
      schema: QueryVariantsSchema,
      prompt: `You are an Advanced RAG Query Optimization Assistant.
Given the following conversation history and the user's latest prompt, generate 3 query representations to maximize vector retrieval precision:

1. rewrittenQuery: A standalone self-contained question resolving any pronouns ("it", "they", "this").
2. stepBackQuery: An abstract, high-level conceptual question that steps back to ask about fundamental principles or broad domain concepts.
3. hydePassage: A 2-sentence hypothetical document passage that simulates what a perfect matching reference document would state.

Conversation History:
${conversationContext || "None"}

User Prompt: "${userPrompt}"`,
    });

    return {
      rewrittenQuery: object.rewrittenQuery || userPrompt,
      stepBackQuery: object.stepBackQuery || userPrompt,
      hydePassage: object.hydePassage || userPrompt,
    };
  } catch (err) {
    console.warn("Failed to generate advanced query variants, using fallback:", err);
    return {
      rewrittenQuery: userPrompt,
      stepBackQuery: userPrompt,
      hydePassage: userPrompt,
    };
  }
}

/**
 * Single-embedding, single-search retrieval — no query expansion, no RRF.
 *
 * For an English-only notebook with a confidently-scoring query, the four-way
 * expansion in executeAdvancedRAGSearch buys little: there's no cross-language
 * gap to bridge and RRF fusion over near-identical query variants rarely
 * reorders the top hits. This skips straight to one embedding and one Qdrant
 * search so the caller can try it first and only fall back to the full pipeline
 * when it doesn't score well.
 */
export async function executeFastSearch({
  notebookId,
  userPrompt,
  limit = 20,
}: {
  notebookId: string;
  userPrompt: string;
  limit?: number;
}): Promise<AdvancedRAGResult> {
  await ensureCollection();

  const [vector] = await generateEmbeddings([userPrompt]);

  const hits = await qdrant.search(NOTEBOOK_COLLECTION_NAME, {
    vector,
    filter: {
      must: [
        {
          key: "notebookId",
          match: { value: notebookId },
        },
      ],
    },
    limit,
    with_payload: true,
  });

  return {
    // Empty (falsy) rather than echoing userPrompt, so RetrievalTrace's
    // step-back/HyDE pills correctly stay hidden instead of showing the same
    // text three times as if expansion had actually run.
    variants: { rewrittenQuery: userPrompt, stepBackQuery: "", hydePassage: "" },
    fusedPoints: hits.map((hit) => ({
      id: hit.id,
      score: +hit.score.toFixed(4),
      rrfScore: hit.score,
      payload: hit.payload,
      matchedQueryTypes: ["original"],
    })),
  };
}

/**
 * Executes Parallel Multi-Query Vector Searches and merges hits using Reciprocal Rank Fusion (RRF)
 */
export async function executeAdvancedRAGSearch({
  notebookId,
  userPrompt,
  history = [],
  limit = 20,
}: {
  notebookId: string;
  userPrompt: string;
  history?: Array<{ role: string; content: string }>;
  limit?: number;
}): Promise<AdvancedRAGResult> {
  await ensureCollection();

  // 1. Generate Query Expansion Variants (Step-Back & HyDE)
  const variants = await generateAdvancedQueryVariants(userPrompt, history);

  // 2. Generate Embeddings for all 4 query representations in parallel
  const queryTexts = [
    userPrompt,
    variants.rewrittenQuery,
    variants.stepBackQuery,
    variants.hydePassage,
  ];

  const embeddings = await generateEmbeddings(queryTexts);

  const filter = {
    must: [
      {
        key: "notebookId",
        match: { value: notebookId },
      },
    ],
  };

  // 3. Execute 4 Parallel Qdrant Vector Searches
  const searchPromises = embeddings.map((vector) =>
    qdrant.search(NOTEBOOK_COLLECTION_NAME, {
      vector,
      filter,
      limit,
      with_payload: true,
    })
  );

  const [hitsOriginal, hitsRewritten, hitsStepBack, hitsHyde] = await Promise.all(searchPromises);

  // 4. Reciprocal Rank Fusion (RRF) Constant
  const K_RRF = 60;
  const pointMap = new Map<
    string,
    {
      id: string | number;
      bestVectorScore: number;
      rrfScore: number;
      payload: any;
      matchedQueryTypes: Set<string>;
    }
  >();

  const searchLists = [
    { name: "original", hits: hitsOriginal },
    { name: "rewritten", hits: hitsRewritten },
    { name: "stepBack", hits: hitsStepBack },
    { name: "hyde", hits: hitsHyde },
  ];

  searchLists.forEach(({ name, hits }) => {
    hits.forEach((hit, rank) => {
      const pointId = String(hit.id);
      const scoreContribution = 1 / (K_RRF + (rank + 1));

      if (!pointMap.has(pointId)) {
        pointMap.set(pointId, {
          id: hit.id,
          bestVectorScore: hit.score,
          rrfScore: scoreContribution,
          payload: hit.payload,
          matchedQueryTypes: new Set([name]),
        });
      } else {
        const existing = pointMap.get(pointId)!;
        existing.rrfScore += scoreContribution;
        existing.bestVectorScore = Math.max(existing.bestVectorScore, hit.score);
        existing.matchedQueryTypes.add(name);
      }
    });
  });

  // 5. Sort Candidates by RRF Score
  const fusedPoints: FusedScoredPoint[] = Array.from(pointMap.values())
    .map((item) => ({
      id: item.id,
      score: +item.bestVectorScore.toFixed(4),
      rrfScore: +item.rrfScore.toFixed(5),
      payload: item.payload,
      matchedQueryTypes: Array.from(item.matchedQueryTypes),
    }))
    .sort((a, b) => b.rrfScore - a.rrfScore);

  return {
    variants,
    fusedPoints,
  };
}
