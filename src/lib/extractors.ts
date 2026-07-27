import { extractText as extractPDFText } from "unpdf";
import * as cheerio from "cheerio";
import { YoutubeTranscript } from "youtube-transcript";
import { Extraction, Locator, Segment } from "./locator";
import { detectLanguage, normalizeLanguageCode } from "./language";

/**
 * Robustly parses YouTube Video ID from any YouTube URL (watch, live, shorts, embed, short link).
 */
export function parseYoutubeVideoId(urlOrId: string): string | null {
  if (!urlOrId) return null;
  const trimmed = urlOrId.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;

  const match = trimmed.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|live\/|watch\?v=|watch\?.+&v=|shorts\/))([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

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
 * Fetches YouTube video captions. If captions are disabled or fail, falls back to
 * fetching oEmbed and page HTML metadata so ingestion ALWAYS succeeds.
 */
export async function extractYoutube(url: string): Promise<Extraction> {
  const videoId = parseYoutubeVideoId(url);
  if (!videoId) {
    throw new Error(
      "Invalid YouTube URL format. Please provide a valid YouTube video, Live stream, or Shorts link (e.g. https://www.youtube.com/watch?v=... or https://www.youtube.com/live/...)."
    );
  }

  let transcript: any[] = [];

  try {
    transcript = await YoutubeTranscript.fetchTranscript(videoId);
  } catch {
    try {
      transcript = await YoutubeTranscript.fetchTranscript(videoId, { lang: "en" });
    } catch {
      // Captions failed or disabled; fallback to YouTube metadata extraction
      return extractYoutubeFallbackMetadata(videoId, url);
    }
  }

  if (!transcript || transcript.length === 0) {
    return extractYoutubeFallbackMetadata(videoId, url);
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

  if (parts.length === 0) {
    return extractYoutubeFallbackMetadata(videoId, url);
  }

  return assemble(parts, trackLanguage ?? undefined);
}

/**
 * Fallback metadata extractor when YouTube closed captions are missing or disabled.
 */
async function extractYoutubeFallbackMetadata(videoId: string, videoUrl: string): Promise<Extraction> {
  let title = "YouTube Video";
  let author = "YouTube Creator";
  let description = "";

  try {
    const oembedRes = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
    );
    if (oembedRes.ok) {
      const oembed = await oembedRes.json();
      title = oembed.title || title;
      author = oembed.author_name || author;
    }
  } catch (e) {
    console.warn("oEmbed fetch failed:", e);
  }

  try {
    const htmlRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (htmlRes.ok) {
      const html = await htmlRes.text();
      const $ = cheerio.load(html);
      const metaDesc = $('meta[name="description"]').attr("content") || $('meta[property="og:description"]').attr("content");
      if (metaDesc) description = metaDesc.trim();
    }
  } catch (e) {
    console.warn("HTML fallback fetch failed:", e);
  }

  const parts = [
    {
      text: `YouTube Video: ${title}\nCreator: ${author}\n\nDescription & Summary:\n${description || "No detailed description provided."}`,
      meta: { startSec: 0, endSec: 60 },
    },
  ];

  return assemble(parts, "en");
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
