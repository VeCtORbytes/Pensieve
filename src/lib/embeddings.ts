import OpenAI from "openai";

const apiKey = process.env.OPENAI_API_KEY || "";

export const openai = new OpenAI({
  apiKey: apiKey || "dummy-key-for-build",
});

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY environment variable is not set. Please provide OPENAI_API_KEY in .env."
    );
  }

  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: texts,
  });

  return response.data.map((item) => item.embedding);
}
