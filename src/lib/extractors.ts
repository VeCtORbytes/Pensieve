import { extractText } from "unpdf";
import * as cheerio from "cheerio";
import { YoutubeTranscript } from "youtube-transcript";
import { Extraction, Locator, Segment } from "./locator";
import { assembleVariant } from "./segments";
import { normalizeLanguageCode } from "./language";

/**
 * Assembles rawText and segments with exact charStart and charEnd boundaries by
 * construction, numbering each segment. The ordinals become the anchor that
 * joins this text to its translated variants, so they must be assigned here —
 * once, over the surviving (non-empty) parts.
 */
function assemble(
  parts: { text: string; meta: Omit<Locator, "charStart" | "charEnd"> }[],
  language?: string
): Extraction {
  const kept = parts
    .map((part) => ({ ...part, text: part.text.trim() }))
    .filter((part) => part.text.length > 0);

  const { rawText, spans } = assembleVariant(kept.map((part) => part.text));

  const segments: Segment[] = kept.map((part, index) => ({
    text: part.text,
    index,
    locator: {
      ...part.meta,
      charStart: spans[index][0],
      charEnd: spans[index][1],
      segStart: index,
      segEnd: index,
    },
  }));

  return { rawText, segments, language };
}

/**
 * Extracts text page-by-page from a PDF buffer with page locators (no string markers).
 */
export async function extractPdf(buffer: Uint8Array | ArrayBuffer): Promise<Extraction> {
  const pdfOutput: any = await extractText(buffer as any);
  const text: any = pdfOutput.text;

  const parts: { text: string; meta: Omit<Locator, "charStart" | "charEnd"> }[] = [];

  if (Array.isArray(text)) {
    text.forEach((pageText: any, idx: number) => {
      const cleanPageText = typeof pageText === "string" ? pageText.trim() : String(pageText || "").trim();
      if (cleanPageText.length > 5) {
        parts.push({
          text: cleanPageText,
          meta: { page: idx + 1 },
        });
      }
    });
  } else if (typeof text === "string" && text.trim()) {
    parts.push({
      text: text.trim(),
      meta: { page: 1 },
    });
  }

  return assemble(parts);
}

/**
 * Fetches web page content and segments text by sections/headings without markdown prefixes.
 */
export async function extractWebsite(url: string): Promise<Extraction> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch website URL (${res.status} ${res.statusText})`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  // Remove non-content elements
  $("script, style, nav, footer, header, noscript, iframe, svg, form").remove();

  const parts: { text: string; meta: Omit<Locator, "charStart" | "charEnd"> }[] = [];

  const h2Elements = $("h2");
  if (h2Elements.length > 0) {
    h2Elements.each((_, el) => {
      const title = $(el as any).text().trim();
      const nextContent = $(el as any).nextUntil("h2").text().replace(/\s+/g, " ").trim();
      if (title || nextContent) {
        parts.push({
          text: `${title}\n${nextContent}`.trim(),
          meta: { heading: title || undefined },
        });
      }
    });
  }

  if (parts.length === 0) {
    $("p, article, section").each((_, el) => {
      const pText = $(el as any).text().replace(/\s+/g, " ").trim();
      if (pText.length > 30) {
        parts.push({ text: pText, meta: {} });
      }
    });
  }

  if (parts.length === 0) {
    const bodyText = $("body").text().replace(/\s+/g, " ").trim();
    if (bodyText) parts.push({ text: bodyText, meta: {} });
  }

  return assemble(parts);
}

/**
 * Fetches YouTube video captions with exact startSec and endSec locators (no [MM:SS] text prefixes).
 */
export async function extractYoutube(url: string): Promise<Extraction> {
  let transcript: any[] = [];

  try {
    // Take the video's own default caption track, so a Hindi video is ingested
    // as Hindi. Asking for English first would hide the original language behind
    // YouTube's auto-translation and lose the source wording entirely.
    transcript = await YoutubeTranscript.fetchTranscript(url);
  } catch (primaryErr: any) {
    try {
      transcript = await YoutubeTranscript.fetchTranscript(url, { lang: "en" });
    } catch {
      throw new Error(
        primaryErr?.message || "Could not retrieve transcript for YouTube video."
      );
    }
  }

  if (!transcript || transcript.length === 0) {
    throw new Error("No captions or transcript found for this YouTube video.");
  }

  // youtube-transcript reports the resolved track's language on each cue.
  const trackLanguage = normalizeLanguageCode(transcript.find((item) => item?.lang)?.lang);

  const parts: { text: string; meta: Omit<Locator, "charStart" | "charEnd"> }[] = [];

  for (const item of transcript) {
    const startSec = Math.floor(item.offset / 1000);
    const durationSec = Math.ceil((item.duration || 2000) / 1000);
    const endSec = startSec + durationSec;

    const cleanText = item.text
      .replace(/&amp;/g, "&")
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .trim();

    if (cleanText) {
      parts.push({
        text: cleanText,
        meta: { startSec, endSec },
      });
    }
  }

  return assemble(parts, trackLanguage ?? undefined);
}

/**
 * Parses WEBVTT format strings into timestamped cues with startSec/endSec locators.
 */
export function extractVtt(rawVtt: string): Extraction {
  const lines = rawVtt.split(/\r?\n/);
  const timestampRegex = /^(\d{2}:)?(\d{2}):(\d{2})\.\d{3}\s+-->\s+(\d{2}:)?(\d{2}):(\d{2})\.\d{3}/;
  const headerRegex = /^(WEBVTT|NOTE|STYLE|REGION)/i;

  const parts: { text: string; meta: Omit<Locator, "charStart" | "charEnd"> }[] = [];

  let currentStartSec = 0;
  let currentEndSec = 0;

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    if (headerRegex.test(line)) continue;
    if (/^\d+$/.test(line)) continue;

    const tsMatch = line.match(timestampRegex);
    if (tsMatch) {
      const times = line.split("-->").map((t) => t.trim());
      currentStartSec = parseTimeStringToSeconds(times[0]);
      currentEndSec = parseTimeStringToSeconds(times[1]);
      continue;
    }

    const textOnly = line.replace(/<[^>]*>/g, "").trim();
    if (textOnly) {
      parts.push({
        text: textOnly,
        meta: { startSec: currentStartSec, endSec: currentEndSec },
      });
    }
  }

  return assemble(parts);
}

/**
 * Wraps plain text into a single extraction segment.
 */
export function extractPlainText(rawText: string): Extraction {
  return assemble([{ text: rawText, meta: {} }]);
}

function parseTimeStringToSeconds(ts: string): number {
  const parts = ts.split(":");
  if (parts.length === 3) {
    return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + Math.floor(parseFloat(parts[2]));
  }
  if (parts.length === 2) {
    return parseInt(parts[0]) * 60 + Math.floor(parseFloat(parts[1]));
  }
  return 0;
}
