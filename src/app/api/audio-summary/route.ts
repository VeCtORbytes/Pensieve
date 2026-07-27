import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { loadOwnedNotebook } from "@/lib/authz";
import OpenAI from "openai";

export const maxDuration = 60;

const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const { notebookId } = await req.json();

    if (!notebookId) {
      return NextResponse.json({ error: "notebookId parameter is required" }, { status: 400 });
    }

    const { userId } = await auth();
    const { error } = await loadOwnedNotebook(notebookId, userId);
    if (error) return error;

    // 1. Fetch READY sources for the notebook
    const sources = await db.source.findMany({
      where: { notebookId, status: "READY" },
      select: { title: true, type: true, rawText: true },
    });

    if (sources.length === 0) {
      return NextResponse.json(
        { error: "No ready sources available to generate an audio overview." },
        { status: 400 }
      );
    }

    // Combine source text previews (up to 3000 chars per source)
    const combinedContext = sources
      .map((s) => `[Source: ${s.title}]\n${(s.rawText || "").slice(0, 3000)}`)
      .join("\n\n");

    // 2. Generate a conversational podcast-style summary script
    const scriptCompletion = await openaiClient.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are an expert audio producer. Generate a natural, engaging 2-paragraph conversational audio podcast script summarizing the key insights, findings, and takeaways from the provided research sources. Keep it under 200 words.",
        },
        {
          role: "user",
          content: `Generate an audio overview script for these notebook sources:\n\n${combinedContext}`,
        },
      ],
    });

    const scriptText = scriptCompletion.choices[0]?.message?.content || "Here is a brief audio overview of your notebook sources.";

    // 3. Synthesize MP3 Audio using OpenAI TTS API (tts-1, alloy)
    const mp3Response = await openaiClient.audio.speech.create({
      model: "tts-1",
      voice: "alloy",
      input: scriptText,
    });

    const audioArrayBuffer = await mp3Response.arrayBuffer();
    const base64Audio = Buffer.from(audioArrayBuffer).toString("base64");
    const audioUrl = `data:audio/mp3;base64,${base64Audio}`;

    return NextResponse.json({
      success: true,
      scriptText,
      audioUrl,
    });
  } catch (error: any) {
    console.error("Audio Summary API error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate audio overview" },
      { status: 500 }
    );
  }
}
