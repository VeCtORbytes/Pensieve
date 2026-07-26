import OpenAI from "openai";

export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMENSIONS = 1536;

/** text-embedding-3-* accepts 8191 tokens per input; stay well under it. */
const MAX_CHARS_PER_INPUT = 28_000;
/** OpenAI caps one request at 2048 inputs and roughly 300k tokens. */
const MAX_INPUTS_PER_REQUEST = 128;
const MAX_CHARS_PER_REQUEST = 600_000;
const MAX_ATTEMPTS = 4;

let client: OpenAI | null = null;

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY environment variable is not set. Please provide OPENAI_API_KEY in .env."
    );
  }
  if (!client) client = new OpenAI({ apiKey });
  return client;
}

/**
 * Embeds texts in request-sized batches, preserving input order.
 * A single oversized input is clamped rather than failing the whole ingestion.
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (!texts || texts.length === 0) return [];

  const inputs = texts.map((text) => {
    const value = (text ?? "").trim();
    if (!value) return " "; // the API rejects empty strings
    return value.length > MAX_CHARS_PER_INPUT ? value.slice(0, MAX_CHARS_PER_INPUT) : value;
  });

  const vectors: number[][] = [];
  for (const group of toBatches(inputs)) {
    vectors.push(...(await embedBatch(group)));
  }

  if (vectors.length !== texts.length) {
    throw new Error(
      `Embedding count mismatch: expected ${texts.length}, received ${vectors.length}.`
    );
  }

  return vectors;
}

function toBatches(inputs: string[]): string[][] {
  const batches: string[][] = [];
  let current: string[] = [];
  let chars = 0;

  for (const input of inputs) {
    const wouldExceed =
      current.length >= MAX_INPUTS_PER_REQUEST || chars + input.length > MAX_CHARS_PER_REQUEST;

    if (current.length > 0 && wouldExceed) {
      batches.push(current);
      current = [];
      chars = 0;
    }

    current.push(input);
    chars += input.length;
  }

  if (current.length > 0) batches.push(current);
  return batches;
}

async function embedBatch(inputs: string[]): Promise<number[][]> {
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const response = await getClient().embeddings.create({
        model: EMBEDDING_MODEL,
        input: inputs,
      });

      // The API may return items out of order; index is authoritative.
      return response.data
        .slice()
        .sort((a, b) => a.index - b.index)
        .map((item) => item.embedding);
    } catch (err) {
      lastError = err;
      if (attempt === MAX_ATTEMPTS - 1 || !isRetryable(err)) break;

      const backoffMs = 500 * 2 ** attempt + Math.floor(Math.random() * 250);
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }

  throw lastError;
}

function isRetryable(err: any): boolean {
  const status = err?.status ?? err?.response?.status;
  if (typeof status !== "number") return false;
  return status === 408 || status === 409 || status === 429 || status >= 500;
}
