# Pensieve

Pensieve is a notebook for grounded research. Feed it documents, websites, YouTube videos, or transcripts and it slices them into precise segments, indexes those segments into a vector database, and answers your questions with citations that point to an exact page, timestamp, or heading — not just "somewhere in this PDF."

## What it does

**Locator data that survives the whole pipeline.** Every segment carries real position metadata — page, startSec, endSec, heading, character offsets, segment ordinals — as typed data, not string markers bolted on after the fact.

**Highlighting without fuzzy matching.** When a citation is clicked, Pensieve slices the raw text directly (`rawText.slice(charStart, charEnd)`), wraps it in `<mark>`, and scrolls to it. No approximate string search involved.

**Multilingual by default.** Non-English sources get translated segment-by-segment at ingest time, and both the original and English versions are embedded so questions can be answered well in either language. A romanized version (Hinglish for Hindi, Romaji for Japanese, etc.) is generated on request. Switching the language in the viewer or chat header changes which language the answers come back in, too.

**Why ordinals instead of offsets.** Translating text shifts every character offset, so you can't reuse an English citation's offsets to highlight the Hindi version. But segment ordinals map one-to-one across a translation, so that's what citations anchor to. This one decision is what makes cross-language highlighting, deduping, and citation reuse work without a separate remapping layer.

**A relevance floor that actually filters.** Retrieval keeps whatever clears `Math.max(0.28, topScore * 0.55)`, then collapses duplicate passages that show up in multiple languages, favors source diversity, and backfills up to 6 chunks.

**You can watch retrieval happen.** There's an animated trace view showing how many chunks exist in the corpus, how many were retrieved, where the cutoff line falls, and which candidates survived it.

**Audio overviews.** Generates a short two-paragraph conversational script (gpt-4o-mini) and turns it into audio (tts-1) you can play right in the browser.

**Re-indexing on demand.** `POST /api/sources/[id]/reindex` re-runs extraction, chunking, and embedding straight from whatever's already stored — raw content or a PDF's base64 blob.

Also included: a command palette (⌘K) for jumping to sources or starter prompts, and drag-and-drop bulk uploads for PDFs and VTT files.

## Stack

- **Framework:** Next.js 14, App Router, Server Components
- **Database:** PostgreSQL via Prisma
- **Vector store:** Qdrant Cloud — a `notebook_chunks` collection with keyword indexes on `notebookId`, `sourceId`, and `variantKind`, created idempotently through `ensureCollection()`
- **AI/embeddings:** OpenAI's `gpt-4o-mini`, `text-embedding-3-small`, and `tts-1`, via the Vercel AI SDK
- **Extraction:** `unpdf` for PDFs, `cheerio` for web pages, `youtube-transcript` for captions
- **Styling:** plain CSS custom properties (`--ink`, `--vessel`, `--surface`, `--rule`, `--accent`, `--found`) plus Instrument Serif, Inter, and JetBrains Mono from Google Fonts

## How a source becomes an answer

A source gets uploaded (PDF, website, YouTube, or VTT) and run through the matching extractor, which produces a `Segment[]` with locator metadata and stable ordinals. Language gets detected from the caption track or a script/model heuristic. The original-language variant stores its own raw text and character spans; if the source isn't English, each segment also gets translated and stored as a second variant with its own spans.

Both variants get chunked (900 characters max, 120 character overlap) and embedded with `text-embedding-3-small`, then written into Qdrant tagged with their variant kind and segment range.

When someone asks a question, Pensieve embeds the query, pulls the top 20 matches across all language variants, drops anything below the relevance cutoff, collapses passages that are really the same text in two languages, picks for source diversity, and backfills to 6 chunks. Those get re-sliced into whichever language variant the reader currently has open, fed to the model alongside a system prompt that enforces grounding and answer language, and streamed back with trace and citation data attached.

## Environment variables

Copy `.env.example` to `.env` and fill in:

| Variable | What it's for |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `OPENAI_API_KEY` | Embeddings, chat streaming, and TTS |
| `QDRANT_URL` | Your Qdrant Cloud or local cluster URL |
| `QDRANT_API_KEY` | Qdrant API key |

## Getting started

```bash
npm install
npx prisma db push
npm run setup:qdrant   # optional — ensureCollection() runs automatically anyway
npm run dev
```

Then open `http://localhost:3000`.

## Trying it out

Create a notebook, and you'll land on the empty-state screen with five ways to add a source. Try a few: drop in a PDF, paste a YouTube link, drag a VTT file onto the source rail.

Ask something grounded in what you added and watch the retrieval trace animate — total chunks, top 20 candidates, and the 0.28 cutoff line. Click an inline citation number and it'll jump straight to the right page or timestamp with the exact text highlighted.

Then ask something completely unrelated to your sources. Everything should fall below the cutoff, nothing gets cited, and the assistant should say so instead of making something up.

If you're curious about the multilingual side, add a Hindi YouTube video and watch it move through extracting → translating → embedding → ready. Switch between हिन्दी, English, and Hinglish in the viewer — Hinglish is generated the first time you ask for it, then cached. Ask a question in English about the Hindi video and the trace will show English-tagged candidates plus duplicate markers where a passage matched in both languages. Switch the chat language and ask again — same timestamps, different language.
