import { ExtractedSegment, ExtractionResult } from "./extractors";

export interface ChunkLocator {
  page?: number;
  timestamp?: number;
  charStart?: number;
  charEnd?: number;
}

export interface TextChunk {
  text: string;
  chunkIndex: number;
  locator: ChunkLocator;
}

/**
 * Strips WEBVTT headers and outputs clean text along with timestamped segments.
 */
export function cleanVtt(rawVtt: string): ExtractionResult {
  const lines = rawVtt.split(/\r?\n/);
  const timestampRegex = /^(\d{2}:)?(\d{2}):(\d{2})\.\d{3}\s+-->/;
  const headerRegex = /^(WEBVTT|NOTE|STYLE|REGION)/i;

  const segments: ExtractedSegment[] = [];
  const cleanLines: string[] = [];

  let currentSecs = 0;
  let offset = 0;

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    if (headerRegex.test(line)) continue;
    if (/^\d+$/.test(line)) continue;

    const tsMatch = line.match(timestampRegex);
    if (tsMatch) {
      const parts = line.split("-->")[0].trim().split(":");
      if (parts.length === 3) {
        currentSecs = parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2]);
      } else if (parts.length === 2) {
        currentSecs = parseInt(parts[0]) * 60 + parseFloat(parts[1]);
      }
      continue;
    }

    const textOnly = line.replace(/<[^>]*>/g, "").trim();
    if (textOnly) {
      const charStart = offset;
      const charEnd = offset + textOnly.length;

      segments.push({
        text: textOnly,
        timestamp: Math.floor(currentSecs),
        charStart,
        charEnd,
      });

      cleanLines.push(textOnly);
      offset = charEnd + 1;
    }
  }

  const fullText = cleanLines.join(" ");
  return { fullText, segments };
}

/**
 * Chunks extracted segments or raw text into character windows with overlap, preserving locator metadata.
 */
export function chunkSegments(
  extraction: ExtractionResult,
  chunkSize: number = 800,
  overlap: number = 100
): TextChunk[] {
  const { fullText, segments } = extraction;

  if (!fullText.trim()) return [];

  // If segments exist, chunk segment by segment to preserve page / timestamp boundaries
  if (segments && segments.length > 0) {
    const chunks: TextChunk[] = [];
    let globalIndex = 0;

    for (const seg of segments) {
      const segText = seg.text.trim();
      if (!segText) continue;

      if (segText.length <= chunkSize) {
        chunks.push({
          text: segText,
          chunkIndex: globalIndex++,
          locator: {
            page: seg.page,
            timestamp: seg.timestamp,
            charStart: seg.charStart ?? 0,
            charEnd: seg.charEnd ?? segText.length,
          },
        });
      } else {
        // Sub-chunk large segment
        let startIndex = 0;
        while (startIndex < segText.length) {
          let endIndex = startIndex + chunkSize;
          if (endIndex < segText.length) {
            const lastSpace = segText.lastIndexOf(" ", endIndex);
            if (lastSpace > startIndex + chunkSize / 2) {
              endIndex = lastSpace;
            }
          } else {
            endIndex = segText.length;
          }

          const subChunkContent = segText.slice(startIndex, endIndex).trim();
          if (subChunkContent) {
            const baseStart = seg.charStart ?? 0;
            chunks.push({
              text: subChunkContent,
              chunkIndex: globalIndex++,
              locator: {
                page: seg.page,
                timestamp: seg.timestamp,
                charStart: baseStart + startIndex,
                charEnd: baseStart + endIndex,
              },
            });
          }

          if (endIndex >= segText.length) break;
          startIndex = endIndex - overlap;
        }
      }
    }

    return chunks;
  }

  // Fallback chunking for plain text without segments
  return chunkText(fullText, chunkSize, overlap);
}

/**
 * Fallback chunker for raw text strings.
 */
export function chunkText(
  text: string,
  chunkSize: number = 800,
  overlap: number = 100
): TextChunk[] {
  const sanitized = text.trim();
  if (!sanitized) return [];

  const chunks: TextChunk[] = [];
  let startIndex = 0;
  let index = 0;

  while (startIndex < sanitized.length) {
    let endIndex = startIndex + chunkSize;
    if (endIndex < sanitized.length) {
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
        locator: {
          charStart: startIndex,
          charEnd: endIndex,
        },
      });
    }

    if (endIndex >= sanitized.length) break;
    startIndex = endIndex - overlap;
  }

  return chunks;
}
