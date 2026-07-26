import "dotenv/config";
import { ensureCollection, NOTEBOOK_COLLECTION_NAME } from "../src/lib/qdrant";
import { EMBEDDING_MODEL, EMBEDDING_DIMENSIONS } from "../src/lib/embeddings";

/**
 * Provisions the Qdrant collection ahead of time. The app also calls
 * ensureCollection() on its own during ingestion and search, so this script is
 * a convenience rather than a prerequisite.
 */
async function main() {
  const url = process.env.QDRANT_URL || "http://localhost:6333";
  console.log(`Connecting to Qdrant at ${url}...`);

  await ensureCollection();

  console.log(
    `Collection "${NOTEBOOK_COLLECTION_NAME}" is ready ` +
      `(${EMBEDDING_DIMENSIONS}-dim Cosine, for ${EMBEDDING_MODEL}).`
  );
  console.log("Payload indexes ensured for: notebookId, sourceId.");
}

main().catch((error) => {
  console.error("Error setting up Qdrant collection:", error);
  process.exit(1);
});
