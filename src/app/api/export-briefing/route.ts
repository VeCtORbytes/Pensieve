import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { notebookId, format = "briefing" } = await req.json();
    if (!notebookId) {
      return NextResponse.json({ error: "notebookId is required" }, { status: 400 });
    }

    const notebook = await db.notebook.findUnique({
      where: { id: notebookId },
      include: {
        sources: {
          select: { title: true, type: true, rawText: true },
          take: 10,
        },
      },
    });

    if (!notebook) {
      return NextResponse.json({ error: "Notebook not found" }, { status: 404 });
    }

    if (notebook.sources.length === 0) {
      return NextResponse.json(
        { error: "No sources found in this notebook. Please upload sources first." },
        { status: 400 }
      );
    }

    const combinedText = notebook.sources
      .map((s) => `SOURCE (${s.type}): ${s.title}\n${(s.rawText || "").slice(0, 3000)}`)
      .join("\n\n---\n\n");

    const systemPrompt =
      format === "study-guide"
        ? `You are an expert academic tutor. Create a beautifully formatted, highly structured Study Guide & Exam Prep document based strictly on the provided notebook sources.`
        : `You are a Principal AI Strategist. Synthesize a publication-grade, beautifully formatted Executive Briefing Memorandum based strictly on the provided notebook sources.`;

    const userPrompt =
      format === "study-guide"
        ? `=== NOTEBOOK SOURCES ===
${combinedText}
========================

Generate a beautifully formatted, publication-ready Markdown Study Guide for "${notebook.title}".

Follow this exact structure:

# 📖 Study Guide: ${notebook.title}

> **Overview**: Synthesized exam preparation & key concept guide grounded in uploaded research sources.

---

## 🎯 1. Executive Summary & Learning Objectives
- **Core Subject**: Summary of primary subject matter.
- **Key Objectives**: Bulleted list of 3-5 learning goals.

---

## 💡 2. Core Concepts & Frameworks
| Concept | Definition / Formula | Significance |
| :--- | :--- | :--- |
| **Term 1** | Explanation | Importance |
| **Term 2** | Explanation | Importance |

### In-Depth Breakdown
Detailed paragraphs explaining core mechanisms, methodologies, and findings with **bold emphasis** on key terminology.

---

## 📚 3. Key Vocabulary & Glossary
- **Term A**: Definition and context.
- **Term B**: Definition and context.

---

## ❓ 4. Self-Assessment Practice Questions
1. **Question 1**: Description.
   - *Answer*: Detailed answer key.
2. **Question 2**: Description.
   - *Answer*: Detailed answer key.

---

## 📌 5. Summary Check-list
- [ ] Review core definitions.
- [ ] Understand key findings.`
        : `=== NOTEBOOK SOURCES ===
${combinedText}
========================

Generate a publication-ready Executive Briefing Memorandum for "${notebook.title}".

Follow this exact structure:

# 📋 Executive Briefing: ${notebook.title}

> **CONFIDENTIAL INTELLIGENCE BRIEFING** — Synthesized research summary grounded in ingested notebook sources.

---

## 1. Executive Summary & Context
A concise 2-paragraph overview highlighting the strategic background and primary objectives of the research.

---

## 2. Key Findings & Strategic Insights
| Domain | Strategic Insight | Impact Level |
| :--- | :--- | :--- |
| **Finding 1** | Concise description | High |
| **Finding 2** | Concise description | Medium |

- **Core Insight A**: High-impact takeaway with supporting data.
- **Core Insight B**: High-impact takeaway with supporting data.

---

## 3. Source-by-Source Synthesis
Summarize each ingested source's core contributions in structured bullet points.

---

## 4. Strategic Implications & Recommendations
1. **Recommendation 1**: Actionable next steps based on source evidence.
2. **Recommendation 2**: Actionable next steps based on source evidence.

---

## 5. Key Glossary
- **Concept X**: Definition.
- **Concept Y**: Definition.`;

    const { text } = await generateText({
      model: openai("gpt-4o-mini"),
      system: systemPrompt,
      prompt: userPrompt,
    });

    return NextResponse.json({
      title: `${notebook.title} - ${format === "study-guide" ? "Study Guide" : "Executive Briefing"}`,
      markdown: text,
    });
  } catch (error: any) {
    console.error("Export briefing error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate briefing document" },
      { status: 500 }
    );
  }
}
