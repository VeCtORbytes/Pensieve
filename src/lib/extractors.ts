import { extractText } from "unpdf";
import * as cheerio from "cheerio";
import { YoutubeTranscript } from "youtube-transcript";

export interface ExtractedSegment {
  text: string;
  page?: number;
  timestamp?: number; // in seconds
  charStart?: number;
  charEnd?: number;
}

export interface ExtractionResult {
  fullText: string;
  segments: ExtractedSegment[];
}

/**
 * Extracts text page-by-page from a PDF buffer with exact page locators.
 */
export async function extractPdf(buffer: Uint8Array | ArrayBuffer): Promise<ExtractionResult> {
  const pdfOutput: any = await extractText(buffer as any);
  const text: any = pdfOutput.text;

  const segments: ExtractedSegment[] = [];
  const fullTextParts: string[] = [];

  if (Array.isArray(text)) {
    let currentOffset = 0;
    text.forEach((pageText: any, idx: number) => {
      const cleanPageText = typeof pageText === "string" ? pageText.trim() : String(pageText || "").trim();
      if (cleanPageText.length > 5) {
        const pageNum = idx + 1;
        const formattedPage = `[Page ${pageNum}]\n${cleanPageText}`;
        const charStart = currentOffset;
        const charEnd = currentOffset + formattedPage.length;

        segments.push({
          text: formattedPage,
          page: pageNum,
          charStart,
          charEnd,
        });

        fullTextParts.push(formattedPage);
        currentOffset = charEnd + 2; // account for \n\n separator
      }
    });
  } else if (typeof text === "string" && text.trim()) {
    segments.push({
      text: text.trim(),
      page: 1,
      charStart: 0,
      charEnd: text.trim().length,
    });
    fullTextParts.push(text.trim());
  }

  const fullText = fullTextParts.join("\n\n");
  return { fullText, segments };
}

/**
 * Fetches web page content, strips boilerplate, and segments text cleanly.
 */
export async function extractWebsite(url: string): Promise<ExtractionResult> {
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

  const rawSegments: string[] = [];

  const h2Elements = $("h2");
  if (h2Elements.length > 0) {
    h2Elements.each((_, el) => {
      const title = $(el as any).text().trim();
      const nextContent = $(el as any).nextUntil("h2").text().replace(/\s+/g, " ").trim();
      if (title || nextContent) {
        rawSegments.push(`## ${title}\n${nextContent}`);
      }
    });
  }

  if (rawSegments.length === 0) {
    $("p, article, section").each((_, el) => {
      const pText = $(el as any).text().replace(/\s+/g, " ").trim();
      if (pText.length > 30) {
        rawSegments.push(pText);
      }
    });
  }

  if (rawSegments.length === 0) {
    rawSegments.push($("body").text().replace(/\s+/g, " ").trim());
  }

  const segments: ExtractedSegment[] = [];
  let offset = 0;

  for (const segText of rawSegments) {
    const charStart = offset;
    const charEnd = offset + segText.length;
    segments.push({
      text: segText,
      charStart,
      charEnd,
    });
    offset = charEnd + 2;
  }

  const fullText = rawSegments.join("\n\n");
  return { fullText, segments };
}

/**
 * Fetches YouTube video captions with exact timestamp locators in seconds.
 */
export async function extractYoutube(url: string): Promise<ExtractionResult> {
  try {
    const transcript = await YoutubeTranscript.fetchTranscript(url);
    if (!transcript || transcript.length === 0) {
      throw new Error("No captions or transcript found for this YouTube video.");
    }

    const segments: ExtractedSegment[] = [];
    const fullTextLines: string[] = [];
    let offset = 0;

    for (const item of transcript) {
      const timestampSecs = Math.floor(item.offset / 1000);
      const mins = Math.floor(timestampSecs / 60);
      const secs = (timestampSecs % 60).toString().padStart(2, "0");
      const tsTag = `[${mins}:${secs}]`;
      const cleanText = item.text
        .replace(/&amp;/g, "&")
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"');

      const line = `${tsTag} ${cleanText}`;
      const charStart = offset;
      const charEnd = offset + line.length;

      segments.push({
        text: line,
        timestamp: timestampSecs,
        charStart,
        charEnd,
      });

      fullTextLines.push(line);
      offset = charEnd + 1;
    }

    const fullText = fullTextLines.join("\n");
    return { fullText, segments };
  } catch (err: any) {
    throw new Error(err.message || "Could not retrieve transcript for YouTube video.");
  }
}
