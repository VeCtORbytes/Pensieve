import { CHAT_MODEL, getOpenAI, mapWithConcurrency } from "./llm";
import { languageName } from "./language";

export type TransformMode = "translate-en" | "romanize";

/** Segments per model call. Small enough that one bad batch costs little. */
const BATCH_SIZE = 30;
const MAX_BATCH_CHARS = 6000;
/** Batches in flight at once. */
const CONCURRENCY = 6;

type Batch = { start: number; texts: string[] };

/**
 * Transforms every segment's text, returning an array of exactly the same
 * length and order as the input.
 *
 * That guarantee is load-bearing: segment ordinals are the anchor that joins a
 * source's language variants, so a dropped or merged segment would silently
 * misalign every citation. The model is asked to echo indices back, and any
 * segment it omits is retried individually, then finally passed through
 * untransformed rather than lost.
 */
export async function transformSegments(
  texts: string[],
  mode: TransformMode,
  sourceLanguage?: string | null
): Promise<string[]> {
  if (texts.length === 0) return [];

  const output = new Array<string>(texts.length);
  const batches = buildBatches(texts);

  await mapWithConcurrency(batches, CONCURRENCY, async (batch) => {
    const transformed = await transformBatch(batch, mode, sourceLanguage);
    for (let i = 0; i < batch.texts.length; i++) {
      output[batch.start + i] = transformed[i];
    }
  });

  // Final safety net: never return a hole.
  for (let i = 0; i < output.length; i++) {
    if (typeof output[i] !== "string") output[i] = texts[i];
  }

  return output;
}

function buildBatches(texts: string[]): Batch[] {
  const batches: Batch[] = [];
  let current: string[] = [];
  let start = 0;
  let chars = 0;

  texts.forEach((text, index) => {
    const wouldExceed = current.length >= BATCH_SIZE || chars + text.length > MAX_BATCH_CHARS;
    if (current.length > 0 && wouldExceed) {
      batches.push({ start, texts: current });
      current = [];
      chars = 0;
      start = index;
    }
    if (current.length === 0) start = index;
    current.push(text);
    chars += text.length;
  });

  if (current.length > 0) batches.push({ start, texts: current });
  return batches;
}

async function transformBatch(
  batch: Batch,
  mode: TransformMode,
  sourceLanguage?: string | null
): Promise<string[]> {
  const result = new Array<string>(batch.texts.length);

  // Attempt 1 and 2: whole batch, indices echoed back.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const received = await callModel(batch.texts, mode, sourceLanguage);
      for (const [index, value] of received) {
        if (index >= 0 && index < batch.texts.length && typeof value === "string") {
          result[index] = value;
        }
      }
      if (result.every((v) => typeof v === "string")) return result;
    } catch (err) {
      if (attempt === 1) {
        console.warn(`Batch ${mode} failed at offset ${batch.start}:`, err);
      }
    }
  }

  // Attempt 3: whatever is still missing, one segment at a time.
  const missing: number[] = [];
  for (let i = 0; i < batch.texts.length; i++) {
    if (typeof result[i] !== "string") missing.push(i);
  }

  if (missing.length > 0) {
    await mapWithConcurrency(missing, 4, async (index) => {
      try {
        const received = await callModel([batch.texts[index]], mode, sourceLanguage);
        const value = received.get(0);
        result[index] = typeof value === "string" ? value : batch.texts[index];
      } catch {
        // Pass the original through; alignment matters more than the rendering.
        result[index] = batch.texts[index];
      }
    });
  }

  return result;
}

async function callModel(
  texts: string[],
  mode: TransformMode,
  sourceLanguage?: string | null
): Promise<Map<number, string>> {
  const response = await getOpenAI().chat.completions.create({
    model: CHAT_MODEL,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt(mode, sourceLanguage) },
      {
        role: "user",
        content: JSON.stringify({
          items: texts.map((text, index) => ({ i: index, t: text })),
        }),
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("Empty response from model");

  const parsed = JSON.parse(content);
  const items = Array.isArray(parsed?.items) ? parsed.items : [];
  if (items.length === 0) throw new Error("Response contained no items");

  const received = new Map<number, string>();
  for (const item of items) {
    const index = typeof item?.i === "number" ? item.i : Number(item?.i);
    if (Number.isInteger(index) && typeof item?.t === "string") {
      received.set(index, item.t);
    }
  }

  return received;
}

function systemPrompt(mode: TransformMode, sourceLanguage?: string | null): string {
  const language = sourceLanguage ? languageName(sourceLanguage) : "the source language";

  const shared =
    "You process a JSON object of caption/text segments: " +
    '{"items":[{"i":<index>,"t":"<text>"}]}. ' +
    "Return JSON in exactly the same shape, with one output item for every input " +
    "item and the same `i` values. Never merge, split, reorder, drop, or add " +
    "items — the indices are used to align the result with timestamps and page " +
    "numbers. A segment may be a partial sentence; transform it as-is rather " +
    "than completing it. If a segment cannot be processed, echo its original text.";

  if (mode === "translate-en") {
    return (
      `${shared}\n\n` +
      `Task: translate each item's text from ${language} into natural English. ` +
      "Preserve meaning, tone, and register. Keep proper nouns, brand names, " +
      "numbers, and technical terms intact. Do not add commentary or explanation."
    );
  }

  return (
    `${shared}\n\n` +
    `Task: transliterate each item's text from ${language} into the Latin ` +
    "alphabet. This is romanization, NOT translation — keep the original words " +
    "and language, changing only the script. Use the informal spelling people " +
    "actually type online (Hindi in Devanagari becomes Hinglish, e.g. " +
    '"मैं ठीक हूँ" becomes "main theek hoon"). Leave text that is already in ' +
    "the Latin alphabet, including English loanwords, unchanged."
  );
}
