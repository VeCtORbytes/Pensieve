export interface TextChunk {
  text: string;
  chunkIndex: number;
}

/**
 * Strips WEBVTT headers, cue identifiers, timestamps, and formatting tags to output clean text.
 */
export function cleanVtt(rawVtt: string): string {
  const lines = rawVtt.split(/\r?\n/);
  const cleanLines: string[] = [];

  const timestampRegex = /^\d{2}:?[\d:]+\.\d{3}\s+-->\s+\d{2}:?[\d:]+\.\d{3}/;
  const headerRegex = /^(WEBVTT|NOTE|STYLE|REGION)/i;

  for (let line of lines) {
    line = line.trim();

    // Skip empty lines, headers, cue numbers, and timestamp lines
    if (!line) continue;
    if (headerRegex.test(line)) continue;
    if (timestampRegex.test(line)) continue;
    if (/^\d+$/.test(line)) continue; // Cue numbers

    // Strip HTML/VTT style tags like <v Speaker> or <b>
    const textOnly = line.replace(/<[^>]*>/g, "").trim();
    if (textOnly) {
      cleanLines.push(textOnly);
    }
  }

  // Deduplicate consecutive identical lines (common in VTT live captions)
  const deduped: string[] = [];
  for (const line of cleanLines) {
    if (deduped.length === 0 || deduped[deduped.length - 1] !== line) {
      deduped.push(line);
    }
  }

  return deduped.join(" ");
}

/**
 * Chunks a block of text into character windows with overlap.
 */
export function chunkText(
  text: string,
  chunkSize: number = 800,
  overlap: number = 100
): TextChunk[] {
  const sanitized = text.replace(/\s+/g, " ").trim();
  if (!sanitized) return [];

  const chunks: TextChunk[] = [];
  let startIndex = 0;
  let index = 0;

  while (startIndex < sanitized.length) {
    let endIndex = startIndex + chunkSize;
    if (endIndex < sanitized.length) {
      // Find space to break cleanly on word boundary if possible
      const lastSpace = sanitized.lastIndexOf(" ", endIndex);
      if (lastSpace > startIndex + chunkSize / 2) {
        endIndex = lastSpace;
      }
    } else {
      endIndex = sanitized.length;
    }

    const chunkContent = sanitized.slice(startIndex, endIndex).trim();
    if (chunkContent) {
      chunks.push({
        text: chunkContent,
        chunkIndex: index++,
      });
    }

    if (endIndex >= sanitized.length) break;
    startIndex = endIndex - overlap;
  }

  return chunks;
}
