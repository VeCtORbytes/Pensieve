import { extractText as extractPDFText } from "unpdf";
import * as cheerio from "cheerio";
import { YoutubeTranscript } from "youtube-transcript";
import { Extraction, Locator, Segment } from "./locator";
import { detectLanguage, normalizeLanguageCode } from "./language";

/**
 * Combines structured text parts into rawText while setting exact charStart/charEnd
 * offsets for each segment.
 */
async function assemble(
  parts: { text: string; meta: Omit<Locator, "charStart" | "charEnd"> }[],
  overrideLanguage?: string
): Promise<Extraction> {
  const segments: Segment[] = [];
  let rawText = "";

  for (let idx = 0; idx < parts.length; idx++) {
    const p = parts[idx];
    const trimmed = p.text.trim();
    if (!trimmed) continue;

    const charStart = rawText.length;
    rawText += trimmed + "\n\n";
    const charEnd = rawText.length - 2;

    segments.push({
      text: trimmed,
      index: idx,
      locator: {
        ...p.meta,
        charStart,
        charEnd,
      },
    });
  }

  const cleanRawText = rawText.trimEnd();

  return {
    rawText: cleanRawText,
    segments,
    language: overrideLanguage ?? (await detectLanguage(cleanRawText)),
  };
}

/**
 * Parses PDF data and extracts text page-by-page into segments with page locators.
 */
export async function extractPdf(data: Uint8Array): Promise<Extraction> {
  const pdf = await extractPDFText(data);
  const parts: { text: string; meta: Omit<Locator, "charStart" | "charEnd"> }[] = [];

  if (Array.isArray(pdf.text)) {
    (pdf.text as string[]).forEach((pageText: string, idx: number) => {
      const trimmed = pageText.trim();
      if (trimmed) {
        parts.push({
          text: trimmed,
          meta: { page: idx + 1 },
        });
      }
    });
  } else if (typeof pdf.text === "string" && (pdf.text as string).trim()) {
    parts.push({
      text: (pdf.text as string).trim(),
      meta: { page: 1 },
    });
  }

  if (parts.length === 0) {
    throw new Error("Could not extract any readable text from this PDF document.");
  }

  return assemble(parts);
}

/**
 * Fetches HTML from a webpage, strips navigation/scripts, and extracts heading-tagged segments.
 */
export async function extractWebsite(url: string): Promise<Extraction> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch website (HTTP status ${res.status}).`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  $("script, style, nav, footer, header, iframe, noscript, svg").remove();

  const parts: { text: string; meta: Omit<Locator, "charStart" | "charEnd"> }[] = [];
  let currentHeading = "Overview";

  $("h1, h2, h3, h4, p, article, section").each((_, el) => {
    const tag = el.tagName.toLowerCase();
    const text = $(el).text().trim();

    if (!text) return;

    if (tag.startsWith("h")) {
      currentHeading = text;
    } else {
      parts.push({
        text,
        meta: { heading: currentHeading },
      });
    }
  });

  if (parts.length === 0) {
    const fallbackText = $("body").text().replace(/\s+/g, " ").trim();
    if (!fallbackText) {
      throw new Error("No readable main body text found on this website.");
    }
    parts.push({
      text: fallbackText,
      meta: { heading: "Main Content" },
    });
  }

  return assemble(parts);
}

/**
 * Fetches YouTube video captions, grouping cue fragments into dense continuous sentences (~350 chars)
 * for rich semantic vector embedding.
 */
export async function extractYoutube(url: string): Promise<Extraction> {
  let transcript: any[] = [];

  try {
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

  const trackLanguage = normalizeLanguageCode(transcript.find((item) => item?.lang)?.lang);

  const parts: { text: string; meta: Omit<Locator, "charStart" | "charEnd"> }[] = [];

  let currentText = "";
  let currentStartSec = 0;
  let currentEndSec = 0;

  for (const item of transcript) {
    const startSec = Math.floor(item.offset / 1000);
    const durationSec = Math.ceil((item.duration || 2000) / 1000);
    const endSec = startSec + durationSec;

    const cleanText = item.text
      .replace(/&amp;/g, "&")
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .trim();

    if (!cleanText) continue;

    if (!currentText) {
      currentStartSec = startSec;
      currentText = cleanText;
      currentEndSec = endSec;
    } else {
      currentText += " " + cleanText;
      currentEndSec = endSec;
    }

    if (currentText.length >= 350 || /[.!?]$/.test(cleanText)) {
      parts.push({
        text: currentText,
        meta: { startSec: currentStartSec, endSec: currentEndSec },
      });
      currentText = "";
    }
  }

  if (currentText) {
    parts.push({
      text: currentText,
      meta: { startSec: currentStartSec, endSec: currentEndSec },
    });
  }

  return assemble(parts, trackLanguage ?? undefined);
}

/**
 * Parses WEBVTT format strings into timestamped continuous cue blocks.
 */
export async function extractVtt(rawVtt: string): Promise<Extraction> {
  const lines = rawVtt.split(/\r?\n/);
  const timestampRegex = /^(\d{2}:)?(\d{2}):(\d{2})\.\d{3}\s+-->\s+(\d{2}:)?(\d{2}):(\d{2})\.\d{3}/;
  const headerRegex = /^(WEBVTT|NOTE|STYLE|REGION)/i;

  const rawCues: { text: string; startSec: number; endSec: number }[] = [];

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
      rawCues.push({
        text: textOnly,
        startSec: currentStartSec,
        endSec: currentEndSec,
      });
    }
  }

  const parts: { text: string; meta: Omit<Locator, "charStart" | "charEnd"> }[] = [];
  let blockText = "";
  let blockStartSec = 0;
  let blockEndSec = 0;

  for (const cue of rawCues) {
    if (!blockText) {
      blockStartSec = cue.startSec;
      blockText = cue.text;
      blockEndSec = cue.endSec;
    } else {
      blockText += " " + cue.text;
      blockEndSec = cue.endSec;
    }

    if (blockText.length >= 350 || /[.!?]$/.test(cue.text)) {
      parts.push({
        text: blockText,
        meta: { startSec: blockStartSec, endSec: blockEndSec },
      });
      blockText = "";
    }
  }

  if (blockText) {
    parts.push({
      text: blockText,
      meta: { startSec: blockStartSec, endSec: blockEndSec },
    });
  }

  return assemble(parts);
}

/**
 * Wraps plain text into a single extraction segment.
 */
export async function extractPlainText(rawText: string): Promise<Extraction> {
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
