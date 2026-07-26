import { QdrantClient } from "@qdrant/js-client-rest";
import { EMBEDDING_DIMENSIONS } from "./embeddings";

const qdrantUrl = process.env.QDRANT_URL || "http://localhost:6333";
const qdrantApiKey = process.env.QDRANT_API_KEY || undefined;

export const qdrant = new QdrantClient({
  url: qdrantUrl,
  apiKey: qdrantApiKey,
});

export const NOTEBOOK_COLLECTION_NAME = "notebook_chunks";

/** Payload fields used in Qdrant filters; each needs a keyword index. */
const INDEXED_PAYLOAD_FIELDS = ["notebookId", "sourceId", "variantKind"] as const;

let ensurePromise: Promise<void> | null = null;

/**
 * Idempotently creates the collection and its payload indexes, so a fresh
 * environment works without running `npm run setup:qdrant` first.
 *
 * Memoized per process. A failure clears the memo so the next caller retries.
 */
export function ensureCollection(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = createCollection().catch((err) => {
      ensurePromise = null;
      throw err;
    });
  }
  return ensurePromise;
}

async function createCollection(): Promise<void> {
  const { collections } = await qdrant.getCollections();

  if (!collections.some((c) => c.name === NOTEBOOK_COLLECTION_NAME)) {
    try {
      await qdrant.createCollection(NOTEBOOK_COLLECTION_NAME, {
        // Dimension is derived from the embedding model so the two cannot drift.
        vectors: { size: EMBEDDING_DIMENSIONS, distance: "Cosine" },
      });
    } catch (err) {
      // A concurrent request may have won the race; anything else is fatal.
      const { collections: after } = await qdrant.getCollections();
      if (!after.some((c) => c.name === NOTEBOOK_COLLECTION_NAME)) throw err;
    }
  }

  for (const field of INDEXED_PAYLOAD_FIELDS) {
    try {
      await qdrant.createPayloadIndex(NOTEBOOK_COLLECTION_NAME, {
        field_name: field,
        field_schema: "keyword",
      });
    } catch {
      // Index already exists.
    }
  }
}
