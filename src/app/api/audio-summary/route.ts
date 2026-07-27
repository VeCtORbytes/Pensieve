import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { loadOwnedNotebook } from "@/lib/authz";
import OpenAI from "openai";

export const maxDuration = 60;

const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export type VoicePersona = "casual" | "academic" | "eli5" | "debate";
export type VoiceName = "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";

const personaPrompts: Record<VoicePersona, string> = {
  casual:
    "You are a friendly, upbeat podcast host. Synthesize an engaging, conversational 2-paragraph audio podcast overview of the key findings. Use warm, clear language.",
  academic:
    "You are a distinguished research scholar. Synthesize an analytical, rigorous 2-paragraph executive academic briefing highlighting methodology, findings, and technical takeaways.",
  eli5:
    "You are a brilliant teacher explaining concepts to a beginner. Synthesize a crystal-clear 2-paragraph overview using fun analogies, zero jargon, and simple language.",
  debate:
    "You are a sharp investigative analyst. Synthesize a thought-provoking 2-paragraph podcast overview highlighting key arguments, tradeoffs, counter-perspectives, and open questions.",
};

export async function POST(req: NextRequest) {
  try {
    const {
      notebookId,
      persona = "casual",
      voice = "alloy",
    }: { notebookId: string; persona?: VoicePersona; voice?: VoiceName } = await req.json();

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

    const systemPrompt = personaPrompts[persona] || personaPrompts.casual;

    // 2. Generate a conversational podcast-style summary script
    const scriptCompletion = await openaiClient.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `${systemPrompt} Break the script into distinct paragraph segments. Keep total length under 250 words.`,
        },
        {
          role: "user",
          content: `Generate an audio overview script for these notebook sources:\n\n${combinedContext}`,
        },
      ],
    });

    const scriptText =
      scriptCompletion.choices[0]?.message?.content ||
      "Here is a brief audio overview of your notebook sources.";

    // Split script into paragraphs for synchronized transcript highlighting
    const segments = scriptText
      .split("\n\n")
      .map((p) => p.trim())
      .filter(Boolean);

    // 3. Synthesize MP3 Audio using OpenAI TTS API (tts-1, selected voice)
    const validVoices: VoiceName[] = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"];
    const chosenVoice = validVoices.includes(voice as VoiceName) ? (voice as VoiceName) : "alloy";

    const mp3Response = await openaiClient.audio.speech.create({
      model: "tts-1",
      voice: chosenVoice,
      input: scriptText,
    });

    const audioArrayBuffer = await mp3Response.arrayBuffer();
    const base64Audio = Buffer.from(audioArrayBuffer).toString("base64");
    const audioUrl = `data:audio/mp3;base64,${base64Audio}`;

    return NextResponse.json({
      success: true,
      scriptText,
      segments,
      audioUrl,
      persona,
      voice: chosenVoice,
    });
  } catch (error: any) {
    console.error("Audio Summary API error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate audio overview" },
      { status: 500 }
    );
  }
}
