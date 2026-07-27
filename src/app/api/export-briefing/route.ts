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
        ? `You are an expert academic tutor. Create a comprehensive, highly structured Study Guide & Exam Prep document based strictly on the provided notebook sources.`
        : `You are a Principal AI Strategist. Synthesize an Executive Briefing & Intelligence Memorandum based strictly on the provided notebook sources.`;

    const userPrompt =
      format === "study-guide"
        ? `=== NOTEBOOK SOURCES ===
${combinedText}
========================

Generate a complete, publication-ready Markdown Study Guide containing:
# [Notebook Title]: Comprehensive Study Guide

## 1. Executive Summary & Learning Objectives
- High-level overview of core subjects covered in the sources.

## 2. Core Concepts & Technical Breakdown
- Detailed explanations of key theories, frameworks, methodologies, and findings.

## 3. Key Vocabulary & Glossary
- Bulleted list of technical terms with concise definitions.

## 4. Practice Questions & Self-Assessment
- 5 multiple-choice/short-answer study questions with hidden answer keys.

## 5. Critical Takeaways & Summary
- Key bullet points to remember for exams or research.`
        : `=== NOTEBOOK SOURCES ===
${combinedText}
========================

Generate a complete, publication-ready Executive Briefing Memorandum containing:
# Executive Briefing: [Notebook Title]

## 1. Executive Memorandum & Context
- Strategic summary of all ingested materials.

## 2. Key Findings & Strategic Insights
- Categorized bullet points highlighting core facts, numbers, and arguments.

## 3. Source-by-Source Synthesis
- Detailed breakdown summarizing each source's primary contribution.

## 4. Strategic Implications & Recommendations
- Actionable takeaways derived from the research.

## 5. Key Terminology & Definitions
- Concise reference glossary.`;

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
