import { Chunk, Segment } from "./locator";

/**
 * Chunks structured segments into maxChars windows while unifying locators.
 * Preserves exact charStart and charEnd character offsets into rawText.
 */
export function chunkSegments(segments: Segment[], maxChars = 900): Chunk[] {
  if (!segments || segments.length === 0) return [];

  const chunks: Chunk[] = [];
  let chunkIndex = 0;

  let currentTextParts: string[] = [];
  let currentLength = 0;
  let firstSeg: Segment | null = null;
  let lastSeg: Segment | null = null;

  for (const seg of segments) {
    const segText = seg.text.trim();
    if (!segText) continue;

    if (!firstSeg) firstSeg = seg;
    lastSeg = seg;

    if (currentLength + segText.length > maxChars && currentTextParts.length > 0) {
      // Emit accumulated chunk
      const chunkTextContent = currentTextParts.join("\n\n");
      chunks.push({
        text: chunkTextContent,
        chunkIndex: chunkIndex++,
        locator: {
          charStart: firstSeg.locator.charStart,
          charEnd: lastSeg.locator.charEnd,
          page: firstSeg.locator.page,
          startSec: firstSeg.locator.startSec,
          heading: firstSeg.locator.heading,
          endSec: lastSeg.locator.endSec,
        },
      });

      // Reset for next chunk
      currentTextParts = [segText];
      currentLength = segText.length;
      firstSeg = seg;
    } else {
      currentTextParts.push(segText);
      currentLength += segText.length + 2; // account for \n\n
    }
  }

  // Flush final chunk
  if (currentTextParts.length > 0 && firstSeg && lastSeg) {
    const chunkTextContent = currentTextParts.join("\n\n");
    chunks.push({
      text: chunkTextContent,
      chunkIndex: chunkIndex++,
      locator: {
        charStart: firstSeg.locator.charStart,
        charEnd: lastSeg.locator.charEnd,
        page: firstSeg.locator.page,
        startSec: firstSeg.locator.startSec,
        heading: firstSeg.locator.heading,
        endSec: lastSeg.locator.endSec,
      },
    });
  }

  return chunks;
}
