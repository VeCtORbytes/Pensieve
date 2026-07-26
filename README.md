# 🧠 NoteBookLLM — Personal RAG Knowledge Assistant

> An AI-powered research notebook platform inspired by Google NotebookLM. Ingest PDFs, Websites, YouTube videos, VTT transcripts, and notes into an isolated vector database, chat with real-time streaming RAG responses, and inspect precise source citations with deep-link highlight navigation.

---

## 🏗️ Architecture Overview

```mermaid
graph TD
    User([User / Browser]) <--> NextApp[Next.js 14 App Router UI]
    
    subgraph Frontend Components
        SourcePanel[SourcePanel Component]
        ChatPanel[ChatPanel Component]
        SourceViewer[SourceViewerModal Component]
    end
    
    subgraph Ingestion Pipeline
        Extractor[Text Extractor Engine<br/>PDF / Website / YouTube / VTT]
        Chunker[Chunker & Normalizer<br/>800-char windows, 100 overlap]
        Embedder[OpenAI Embeddings<br/>text-embedding-3-small]
    end

    subgraph Data & Vector Layer
        PostgreSQL[(PostgreSQL Database<br/>Prisma ORM - Neon)]
        Qdrant[(Qdrant Vector DB<br/>notebook_chunks collection)]
    end

    subgraph RAG & Chat Pipeline
        RAG[RAG Retrieval & Reranker<br/>Top 20 → Top 6 Diverse]
        LLM[OpenAI GPT-4o-mini<br/>Numbered Context Streaming]
    end

    NextApp --> SourcePanel & ChatPanel & SourceViewer
    SourcePanel -->|POST /api/sources| Extractor
    Extractor --> Chunker --> Embedder
    Embedder -->|Upsert Vectors| Qdrant
    Extractor -->|Save Source & rawText| PostgreSQL

    ChatPanel -->|POST /api/chat| RAG
    RAG -->|Vector Search with notebookId filter| Qdrant
    RAG -->|Fetch Source Titles| PostgreSQL
    RAG -->|Formatted Numbered System Prompt| LLM
    LLM -->|Data Stream + X-Citations Header| ChatPanel
    ChatPanel -->|Click Citation| SourceViewer
```

---

## 🔑 Environment Variables

Create a `.env` file in the root directory with the following configuration:

| Variable Name | Description | Example / Format |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string (Prisma ORM) | `postgresql://user:password@ep-host.neon.tech/neondb?sslmode=require` |
| `QDRANT_URL` | Qdrant Cloud or local REST endpoint | `https://your-qdrant-cluster.qdrant.io` or `http://localhost:6333` |
| `QDRANT_API_KEY` | Qdrant Cloud authentication API key | `eyJhbGciOiJIUzI1NiIsInR5cCI6...` |
| `OPENAI_API_KEY` | OpenAI API key for embeddings & completions | `sk-proj-...` |

---

## 🚀 Quick Start Guide

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/VeCtORbytes/Pensieve.git
cd NoteBookLLM
npm install
```

### 2. Configure Environment & Database
Make sure `.env` contains your `DATABASE_URL`, `QDRANT_URL`, `QDRANT_API_KEY`, and `OPENAI_API_KEY`.

Generate the Prisma client:
```bash
npx prisma generate
```

Push database schema to PostgreSQL:
```bash
npx prisma db push
```

### 3. Initialize Qdrant Vector Collection & Payload Indexes
Run the automated setup script to create the `notebook_chunks` collection and setup keyword payload indexes (`notebookId`, `sourceId`):
```bash
npm run setup:qdrant
```

### 4. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📖 Retrieval & RAG Flow

1. **Query Embedding Generation**:
   When a user sends a message, the prompt text is converted into a 1536-dimensional vector embedding using OpenAI's `text-embedding-3-small` model.

2. **Vector Similarity Search (Top 20)**:
   The query vector searches the Qdrant `notebook_chunks` collection using cosine similarity. Search queries are filtered strictly by `notebookId` using Qdrant's payload index to ensure notebook isolation.

3. **Source Diversity Reranking & Deduplication (Top 6)**:
   To prevent a single long document from dominating all context slots, search results undergo a round-robin diversity filter:
   - Max 2 chunks per `sourceId` are selected in the first pass.
   - Remaining slots (up to 6 total chunks) are filled from secondary matches.

4. **Numbered Context Assembly**:
   Source records are looked up in PostgreSQL to attach source titles. Chunks are formatted into a structured system prompt:
   ```text
   [1] Source: "Lecture Notes" (Chunk 0)
   Content: ...
   [2] Source: "YouTube Video" (Chunk 2)
   Content: ...
   ```

5. **Streaming Response & Citation Mapping**:
   The response is streamed in real-time via `streamText` (`gpt-4o-mini`). The top 6 cited chunks are sent in an `X-Citations` HTTP response header and persisted to PostgreSQL (`Message` model) for instant UI chip rendering and session history reload.

---

## 💡 Engineering Thoughtfulness: Format Normalization

> **Why Normalize Heterogeneous Inputs to a Unified `Segment[]` Schema?**
>
> In real-world RAG applications, knowledge sources arrive in vastly different structures—PDF binary pages, YouTube VTT subtitle tracks with millisecond timestamps, raw HTML web scraping, and plain text notes.
> 
> Rather than treating text ingestion as a monolithic string dump, NoteBookLLM normalizes every source into a unified `Segment[]` / `TextChunk` abstraction during ingestion:
> - **PDFs** retain page boundary markers (`[Page N]`).
> - **YouTube Videos & Transcripts** retain timestamp offsets (`[MM:SS]`).
> - **Websites & Text** retain clean character window boundaries.
> 
> **The Key Benefit**: When an LLM cites chunk `[3]`, the UI doesn't just display static text—it can deep-link directly into the exact PDF page (`#page=3`), jump the YouTube video embed to the exact second (`?start=105`), or wrap matching text inside a `<mark>` tag with automated `scrollIntoView()`!

---

## 🎥 Demo Video Script & Walkthrough Guide

Use this step-by-step flow when recording your video demo:

1. **Create Notebook**:
   - On the homepage (`/`), click **New notebook**.
   - Open the newly created notebook.

2. **Add 3 Source Types**:
   - **PDF Source**: Upload a `.pdf` document.
   - **Website Source**: Paste a website URL (e.g. documentation or article).
   - **YouTube Source**: Paste a YouTube video URL (e.g. a lecture or tutorial).

3. **Observe Background Ingestion**:
   - Watch the status badges update in real-time (`queued` $\rightarrow$ `extracting` $\rightarrow$ `embedding` $\rightarrow$ `ready` green indicator with chunk count).

4. **Ask RAG Questions**:
   - Type a question in the chat panel (or click a suggested prompt).
   - Observe real-time streaming response with bracketed citations (e.g. `[1]`, `[2]`).

5. **Interact with Citation Chips**:
   - Click a **Citation Chip** under the AI response to open the Citation Detail Modal.
   - Click **Jump to Source Document**.

6. **Inspect Source Viewer Modal**:
   - For **PDF**: Show the embedded PDF iframe loaded to the correct page.
   - For **YouTube**: Show the video embed playing from the exact timestamp + clickable transcript timestamps.
   - For **Text/Website**: Show the document text with the cited chunk highlighted in yellow `<mark>` and auto-scrolled to center!

---

## 🛠️ Built With

- **Framework**: [Next.js 14 (App Router)](https://nextjs.org/)
- **Database**: [PostgreSQL (Neon)](https://neon.tech/) & [Prisma ORM](https://www.prisma.io/)
- **Vector Database**: [Qdrant Cloud](https://qdrant.tech/)
- **AI / LLM**: [OpenAI API](https://platform.openai.com/) (`gpt-4o-mini`, `text-embedding-3-small`)
- **Styling & UI**: [Tailwind CSS](https://tailwindcss.com/), [Lucide Icons](https://lucide.dev/)
- **Text Processing**: `unpdf`, `cheerio`, `youtube-transcript`
