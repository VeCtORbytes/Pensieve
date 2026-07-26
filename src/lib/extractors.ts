import { extractText } from "unpdf";
import * as cheerio from "cheerio";
import { YoutubeTranscript } from "youtube-transcript";

/**
 * Extracts text page-by-page from a PDF buffer.
 */
export async function extractPdf(buffer: ArrayBuffer | Buffer): Promise<string> {
  const { text } = await extractText(buffer as any);

  
  if (Array.isArray(text)) {
    return text
      .map((pageText, idx) => `[Page ${idx + 1}]\n${pageText.trim()}`)
      .filter((t) => t.length > 10)
      .join("\n\n");
  }
  
  return typeof text === "string" ? text : "";
}

/**
 * Fetches web page content, strips boilerplate, and segments text by headings/paragraphs.
 */
export async function extractWebsite(url: string): Promise<string> {
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

  const sections: string[] = [];

  // Group text by h2 headings if present, or fallback to main article paragraphs
  const h2Elements = $("h2");
  if (h2Elements.length > 0) {
    h2Elements.each((_, el) => {
      const title = $(el).text().trim();
      const nextContent = $(el).nextUntil("h2").text().replace(/\s+/g, " ").trim();
      if (title || nextContent) {
        sections.push(`## ${title}\n${nextContent}`);
      }
    });
  }

  if (sections.length === 0) {
    // Fallback: collect paragraphs
    $("p, article, section").each((_, el) => {
      const pText = $(el).text().replace(/\s+/g, " ").trim();
      if (pText.length > 30) {
        sections.push(pText);
      }
    });
  }

  const fullText = sections.length > 0 ? sections.join("\n\n") : $("body").text().replace(/\s+/g, " ").trim();
  return fullText;
}

/**
 * Fetches YouTube video captions with start time offsets.
 */
export async function extractYoutube(url: string): Promise<string> {
  try {
    const transcript = await YoutubeTranscript.fetchTranscript(url);
    if (!transcript || transcript.length === 0) {
      throw new Error("No captions or transcript found for this YouTube video.");
    }

    return transcript
      .map((item) => {
        const totalSec = Math.floor(item.offset / 1000);
        const mins = Math.floor(totalSec / 60);
        const secs = (totalSec % 60).toString().padStart(2, "0");
        const timestamp = `[${mins}:${secs}]`;
        const cleanText = item.text.replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"');
        return `${timestamp} ${cleanText}`;
      })
      .join("\n");
  } catch (err: any) {
    throw new Error(err.message || "Could not retrieve transcript for YouTube video.");
  }
}
