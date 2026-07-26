# Pensieve — Grounded AI Notebook & Research Vessel

> A vessel for your knowledge sources. Pensieve cuts documents, websites, YouTube videos, and transcripts into precise segments, indexes them into a vector spatial database, and streams grounded answers with exact position citations (`p.4`, `41:12`, `Heading`).

---

## Features & Architecture Highlights

- 🎯 **Exact Locator Data Pipeline (`Segment[]`)**: Position metadata (`page`, `startSec`, `endSec`, `heading`, `charStart`, `charEnd`) is preserved end-to-end as typed data structures, eliminating string marker decoration.
- 📍 **Direct Character Offset Slice Highlighting**: Text highlighting uses exact `rawText.slice(charStart, charEnd)` wrapped in `<mark>` and auto-scrolled with zero fuzzy string searches.
- ⚡ **Precision Relevance Floor (`ABSOLUTE_FLOOR = 0.28`)**: Filtering uses `Math.max(0.28, topScore * 0.7)`. Irrelevant vector noise is filtered out so off-topic questions trigger clean prompt refusal with zero false-positive citations.
- 📊 **Interactive `RetrievalTrace`**: Animated retrieval pipeline visualizer showing total corpus chunks, retrieved candidates, relevance cutoff line, and kept vs. filtered candidate score bars.
- 🎙️ **AI Audio Overview Generator**: Synthesizes a 2-paragraph conversational audio overview script using `gpt-4o-mini` and `tts-1` speech synthesis, playable in an in-browser audio player.
- 🚀 **Explicit Re-Index Endpoint (`POST /api/sources/[id]/reindex`)**: Re-runs extraction, chunking, and Qdrant vector embedding directly from stored raw content or PDF Base64 `blobUrl`.
- ⌨️ **Command Palette (`⌘K`)**: Global keyboard shortcut to search notebook sources and select starter prompts.
- 📥 **Drag-and-Drop Bulk Ingestion**: Drop PDF and VTT files directly onto the source rail.

---

## Technical Stack

- **Framework**: Next.js 14 (App Router, Server Components)
- **Database**: PostgreSQL (via Prisma ORM)
- **Vector Database**: Qdrant Cloud (`notebook_chunks` collection with `notebookId` and `sourceId` keyword payload indexes)
- **AI & Embeddings**: OpenAI `gpt-4o-mini`, `text-embedding-3-small`, `tts-1` (via Vercel AI SDK `ai`)
- **Extractors**: `unpdf` (PDF page parsing), `cheerio` (Web page scraping), `youtube-transcript` (Caption fetching)
- **Styling**: Vanilla CSS tokens (`--ink`, `--vessel`, `--surface`, `--rule`, `--accent`, `--found`) & Google Fonts (`Instrument Serif`, `Inter`, `JetBrains Mono`)

---

## Architecture Flow

```mermaid
graph TD
    A[Upload Source: PDF / Website / YouTube / VTT] --> B[Extractors: extractPdf / extractWebsite / extractYoutube / extractVtt]
    B --> C[Format Normalization: Segment[] with Locator metadata]
    C --> D[Chunker: chunkSegments maxChars=900 with Locator union]
    D --> E[OpenAI Embeddings: text-embedding-3-small]
    E --> F[Qdrant Vector Database: notebook_chunks collection]
    
    G[User Asks Question] --> H[Generate Query Vector]
    H --> I[Qdrant Spatial Retrieval: Top 20 Candidates]
    I --> J[Relevance Cutoff: ABSOLUTE_FLOOR = 0.28 & Diversity Reranking]
    J --> K[System Prompt: Strict Grounding Refusal Rule]
    K --> L[Vercel AI SDK Stream: data-trace & data-citations Data Parts]
    L --> M[UI: RetrievalTrace + Interactive Inline Superscript Citations]
```

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

# 3. Setup Qdrant collection & payload indexes (notebookId, sourceId)
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
