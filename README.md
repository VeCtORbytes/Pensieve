# Pensieve — Grounded AI Notebook & Research Vessel

> A vessel for your knowledge sources. Pensieve cuts documents, websites, YouTube videos, and transcripts into precise segments, indexes them into a vector spatial database, and streams grounded answers with exact position citations (`p.4`, `41:12`, `Heading`).

---

## Features & Architecture Highlights

- 🎯 **Exact Locator Data Pipeline (`Segment[]`)**: Position metadata (`page`, `startSec`, `endSec`, `heading`, `charStart`, `charEnd`, `segStart`, `segEnd`) is preserved end-to-end as typed data structures, eliminating string marker decoration.
- 📍 **Direct Character Offset Slice Highlighting**: Text highlighting uses exact `rawText.slice(charStart, charEnd)` wrapped in `<mark>` and auto-scrolled with zero fuzzy string searches.
- 🌐 **Multilingual Variants (Original / English / Hinglish)**: A non-English source is translated segment by segment at ingest and both renderings are embedded, so a question retrieves well in either language. A romanized rendering (Hinglish for Hindi, Romaji for Japanese, …) is generated on demand for reading. Switching language in the viewer or chat header also switches the language answers are written in.
- ⚓ **Segment-Ordinal Anchors**: Character offsets differ between translations, so citations are anchored to *segment ordinals*, which translation preserves one-to-one. That single anchor powers cross-language highlighting, cross-variant dedupe, and page/timestamp reuse — with no offset-remapping layer.
- ⚡ **Precision Relevance Floor (`ABSOLUTE_FLOOR = 0.28`)**: Filtering uses `Math.max(0.28, topScore * 0.55)`, then collapses cross-language duplicates of the same passage, then selects for source diversity and backfills to a 6-chunk budget.
- 📊 **Interactive `RetrievalTrace`**: Animated retrieval pipeline visualizer showing total corpus chunks, retrieved candidates, relevance cutoff line, and kept vs. filtered candidate score bars.
- 🎙️ **AI Audio Overview Generator**: Synthesizes a 2-paragraph conversational audio overview script using `gpt-4o-mini` and `tts-1` speech synthesis, playable in an in-browser audio player.
- 🚀 **Explicit Re-Index Endpoint (`POST /api/sources/[id]/reindex`)**: Re-runs extraction, chunking, and Qdrant vector embedding directly from stored raw content or PDF Base64 `blobUrl`.
- ⌨️ **Command Palette (`⌘K`)**: Global keyboard shortcut to search notebook sources and select starter prompts.
- 📥 **Drag-and-Drop Bulk Ingestion**: Drop PDF and VTT files directly onto the source rail.

---

## Technical Stack

- **Framework**: Next.js 14 (App Router, Server Components)
- **Database**: PostgreSQL (via Prisma ORM)
- **Vector Database**: Qdrant Cloud (`notebook_chunks` collection with `notebookId`, `sourceId`, and `variantKind` keyword payload indexes, created idempotently by `ensureCollection()`)
- **AI & Embeddings**: OpenAI `gpt-4o-mini`, `text-embedding-3-small`, `tts-1` (via Vercel AI SDK `ai`)
- **Extractors**: `unpdf` (PDF page parsing), `cheerio` (Web page scraping), `youtube-transcript` (Caption fetching)
- **Styling**: Vanilla CSS tokens (`--ink`, `--vessel`, `--surface`, `--rule`, `--accent`, `--found`) & Google Fonts (`Instrument Serif`, `Inter`, `JetBrains Mono`)

---

## Architecture Flow

```mermaid
graph TD
    A[Upload Source: PDF / Website / YouTube / VTT] --> B[Extractors: extractPdf / extractWebsite / extractYoutube / extractVtt]
    B --> C[Segment[] with Locator metadata + stable ordinals]
    C --> D[detectLanguage: caption track tag or script heuristic + model]
    D --> E[ORIGINAL variant: rawText + per-segment char spans]
    D --> F{Non-English?}
    F -- yes --> G[transformSegments: per-segment translation, count preserved]
    G --> H[ENGLISH variant: own rawText + own char spans]
    E --> I[Chunker: chunkSegments maxChars=900, overlap=120]
    H --> I
    I --> J[OpenAI Embeddings: text-embedding-3-small, batched]
    J --> K[Qdrant: notebook_chunks, tagged with variantKind + segStart/segEnd]

    L[User Asks Question] --> M[Generate Query Vector]
    M --> N[Qdrant Retrieval: Top 20 across all variants]
    N --> O[Relevance Cutoff: max 0.28, topScore * 0.55]
    O --> P[dedupeByPassage: collapse cross-language copies by ordinal overlap]
    P --> Q[selectForContext: source diversity, then backfill to 6]
    Q --> R[Re-slice passages into the reader's selected variant]
    R --> S[System Prompt: grounding refusal + answer-language directive]
    S --> T[Stream: data-trace & data-citations Data Parts]
    T --> U[UI: RetrievalTrace + Inline Citations + Language Switcher]
```

### Why segment ordinals

Translating a source changes every character offset, so a citation found in the
English index cannot be highlighted in the Hindi text using offsets. Translation
*is* one-to-one per segment though, so segment ordinals survive it. Each variant
stores its own `[charStart, charEnd]` per ordinal, and `spanForSegmentRange()`
converts an ordinal range into offsets for whichever variant is on screen. The
same anchor tells the retriever that a Hindi hit and an English hit covering
overlapping ordinals are one passage, not two.

---

## Environment Variables

Copy `.env.example` to `.env` and supply the required API keys:

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `OPENAI_API_KEY` | OpenAI API Key (for embeddings, chat streaming, and TTS) |
| `QDRANT_URL` | Qdrant Cloud or local cluster URL (e.g. `https://xxx.qdrant.tech:6333`) |
| `QDRANT_API_KEY` | Qdrant API Key |

---

## Quickstart

```bash
# 1. Install dependencies
npm install

# 2. Setup PostgreSQL database schema
npx prisma db push

# 3. Optional: pre-create the Qdrant collection & payload indexes.
#    The app calls ensureCollection() on ingest and search, so this is
#    a convenience rather than a prerequisite.
npm run setup:qdrant

# 4. Start Next.js development server
npm run dev
```

Visit `http://localhost:3000` in your browser.

---

## Demo Script & Evaluation Walkthrough

1. **Create Notebook**: Click `New Notebook` on the homepage and enter a title.
2. **First-Run Onboarding**: Observe the `<EmptyNotebook />` screen presenting the 5 source choices.
3. **Ingest Sources**:
   - Add a PDF file (observe `blobUrl` Data URL storage).
   - Add a YouTube Video URL (observe timestamp cue extraction).
   - Drop a VTT caption file onto the quiet source rail.
4. **Ask a Grounded Question**: Type a prompt. Observe the animated `RetrievalTrace` showing total corpus chunks, top 20 candidates, and the `0.28` relevance cutoff.
5. **Interactive Inline Citations**: Click an inline superscript `[1]` in the text response prose. The `SourceViewerModal` opens at the exact page or timestamp with exact `<mark>` slice highlighting.
6. **Ask an Off-Topic Question**: Ask about an unrelated topic. Observe the `0.28` cutoff drop all candidates (`0 cited`) and the assistant cleanly refuse without hallucinating.
7. **Audio Overview**: Click `Audio Overview` in the header to listen to the synthesized AI podcast overview.
8. **Multilingual Transcript**: Add a Hindi YouTube video. Watch the status move
   `EXTRACTING → TRANSLATING → EMBEDDING → READY`, then use the language switcher
   (`हिन्दी (original)` / `English` / `Hinglish`) in the viewer header. Hinglish is
   generated on first click and cached. Ask a question in English about the Hindi
   video and note that the `RetrievalTrace` shows `en`-tagged candidates and `dup`
   markers where the same passage matched in both languages. Switch the chat
   header language and ask again — the answer comes back in that language, citing
   the same timestamps.
