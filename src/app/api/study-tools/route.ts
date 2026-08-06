import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

export const maxDuration = 60;

const FlashcardsSchema = z.object({
  flashcards: z.array(
    z.object({
      id: z.string().describe("Unique flashcard identifier"),
      question: z.string().describe("Clear, concise study question testing a key concept"),
      answer: z.string().describe("Detailed, authoritative answer"),
      topic: z.string().describe("Broad topic tag (e.g. Superposition, Key Term, Algorithm)"),
      sourceTitle: z.string().describe("Title of the source document referenced"),
    })
  ),
});

const QuizSchema = z.object({
  questions: z.array(
    z.object({
      id: z.string().describe("Unique quiz question identifier"),
      question: z.string().describe("Multiple-choice question text"),
      options: z
        .array(z.string())
        .length(4)
        .describe("Four plausible multiple choice answer options"),
      correctIndex: z
        .number()
        .min(0)
        .max(3)
        .describe("0-based index of the correct option"),
      explanation: z.string().describe("Detailed explanation of why the correct option is right"),
      sourceTitle: z.string().describe("Title of the source document referenced"),
    })
  ),
});

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { notebookId, tool, language = "English" } = await req.json();

    if (!notebookId || !tool) {
      return NextResponse.json(
        { error: "notebookId and tool parameters are required" },
        { status: 400 }
      );
    }

    // 1. Fetch Notebook and verify user ownership. Only title/rawText/url feed
    // the prompt below, so blobUrl (base64 PDF) is left out of the read.
    const notebook = await db.notebook.findUnique({
      where: { id: notebookId },
      select: {
        userId: true,
        sources: { select: { title: true, rawText: true, url: true } },
      },
    });

    if (!notebook) {
      return NextResponse.json({ error: "Notebook not found" }, { status: 404 });
    }

    if (notebook.userId && notebook.userId !== userId) {
      return NextResponse.json({ error: "Unauthorized notebook access" }, { status: 403 });
    }

    if (notebook.sources.length === 0) {
      return NextResponse.json(
        { error: "Notebook has no ingested sources to generate study tools from" },
        { status: 400 }
      );
    }

    // 2. Combine source text content (up to 25,000 characters for OpenAI context)
    const combinedText = notebook.sources
      .map((s) => `--- SOURCE: ${s.title} ---\n${s.rawText || s.url || ""}`)
      .join("\n\n")
      .slice(0, 25000);

    const langInstruction =
      language === "Hinglish"
        ? "Generate ALL text strictly in Hinglish (Hindi language typed in Roman/Latin alphabet, e.g. 'Aapko yeh concept yaad rakhna chahiye')."
        : `Generate ALL text strictly in ${language}.`;

    if (tool === "flashcards") {
      const { object } = await generateObject({
        model: openai("gpt-4o-mini"),
        schema: FlashcardsSchema,
        prompt: `You are an expert educational tutor. Generate a set of 10 interactive study flashcards based on the following notebook source materials.
IMPORTANT LANGUAGE DIRECTIVE: ${langInstruction}

Source Text:
${combinedText}`,
      });

      return NextResponse.json({ flashcards: object.flashcards });
    } else if (tool === "quiz") {
      const { object } = await generateObject({
        model: openai("gpt-4o-mini"),
        schema: QuizSchema,
        prompt: `You are an expert test creator. Generate a 6-question multiple choice quiz based on the following notebook source materials. Ensure each question has 4 options, a 0-based correct index, and a clear explanation.
IMPORTANT LANGUAGE DIRECTIVE: ${langInstruction}

Source Text:
${combinedText}`,
      });

      return NextResponse.json({ questions: object.questions });
    } else {
      return NextResponse.json({ error: "Invalid study tool specified" }, { status: 400 });
    }
  } catch (error: any) {
    console.error("Study tool generation error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate study tool material" },
      { status: 500 }
    );
  }
}
