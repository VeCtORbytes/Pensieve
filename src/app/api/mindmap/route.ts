import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

export const maxDuration = 60;

const MindMapNodeSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    id: z.string(),
    label: z.string(),
    category: z.string(),
    description: z.string().optional(),
    children: z.array(MindMapNodeSchema).optional(),
  })
);

const MindMapOutputSchema = z.object({
  title: z.string(),
  mermaidCode: z.string(),
  root: MindMapNodeSchema,
});

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { notebookId } = await req.json();
    if (!notebookId) {
      return NextResponse.json({ error: "notebookId is required" }, { status: 400 });
    }

    // Fetch notebook sources
    const sources = await db.source.findMany({
      where: { notebookId },
      take: 10,
      select: { title: true, type: true, rawText: true },
    });

    if (sources.length === 0) {
      return NextResponse.json(
        { error: "No sources found in this notebook. Please upload sources first." },
        { status: 400 }
      );
    }

    const combinedText = sources
      .map((s) => `SOURCE (${s.type}): ${s.title}\n${(s.rawText || "").slice(0, 2500)}`)
      .join("\n\n");

    const prompt = `Analyze the following ingested notebook sources and create a comprehensive Mind Map / Knowledge Graph structure.

=== SOURCE CONTENT ===
${combinedText}
======================

Generate:
1. A main title for the Mind Map.
2. A valid, clean Mermaid.js flowchart code string (starting with 'graph TD') connecting main concepts, subtopics, and key technical terms.
3. A hierarchical tree of nodes starting from a central Root Node, branching into 3-5 Main Categories, each having 2-4 Sub-concepts with short descriptions.`;

    const result = await generateObject({
      model: openai("gpt-4o-mini"),
      schema: MindMapOutputSchema,
      prompt,
    });

    return NextResponse.json(result.object);
  } catch (error: any) {
    console.error("Mind map generation error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate mind map" },
      { status: 500 }
    );
  }
}
