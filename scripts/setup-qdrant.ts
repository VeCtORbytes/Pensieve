import "dotenv/config";
import { QdrantClient } from "@qdrant/js-client-rest";

const QDRANT_URL = process.env.QDRANT_URL || "http://localhost:6333";
const QDRANT_API_KEY = process.env.QDRANT_API_KEY || undefined;
const COLLECTION_NAME = "notebook_chunks";

async function createQdrantCollection() {
  console.log(`Connecting to Qdrant at ${QDRANT_URL}...`);
  const client = new QdrantClient({
    url: QDRANT_URL,
    apiKey: QDRANT_API_KEY,
  });

  try {
    const collections = await client.getCollections();
    const exists = collections.collections.some((c) => c.name === COLLECTION_NAME);

    if (exists) {
      console.log(`Collection "${COLLECTION_NAME}" already exists.`);
    } else {
      console.log(`Creating collection "${COLLECTION_NAME}"...`);
      await client.createCollection(COLLECTION_NAME, {
        vectors: {
          size: 1536, // Standard embedding dimension (OpenAI / text-embedding-3-small)
          distance: "Cosine",
        },
      });
      console.log(`Collection "${COLLECTION_NAME}" created successfully.`);
    }
  } catch (error) {
    console.error("Error setting up Qdrant collection:", error);
    process.exit(1);
  }
}

createQdrantCollection();
