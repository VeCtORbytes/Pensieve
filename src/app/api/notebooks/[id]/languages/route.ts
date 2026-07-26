import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { canRomanize, isEnglish, languageName } from "@/lib/language";
import { VariantKind } from "@/lib/locator";
import { variantLabel } from "@/lib/variants";

export const dynamic = "force-dynamic";

/**
 * Summarises which language renderings are worth offering across a whole
 * notebook, so the chat panel can show a reading-language switcher without
 * pulling every source's full text.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const sources = await db.source.findMany({
      where: { notebookId: id, status: "READY" },
      select: { language: true },
    });

    const languages = Array.from(
      new Set(sources.map((s) => s.language).filter((l): l is string => Boolean(l)))
    );

    // The dominant non-English language drives the labels ("Hinglish" vs generic).
    const primaryLanguage = languages.find((l) => !isEnglish(l)) ?? languages[0] ?? null;

    const offered: VariantKind[] = ["ORIGINAL"];
    if (languages.some((l) => !isEnglish(l))) offered.push("ENGLISH");
    if (languages.some((l) => canRomanize(l))) offered.push("ROMANIZED");

    return NextResponse.json({
      languages,
      primaryLanguage,
      primaryLanguageLabel: primaryLanguage ? languageName(primaryLanguage) : null,
      options: offered.map((kind) => ({
        kind,
        label: variantLabel(kind, primaryLanguage),
      })),
    });
  } catch (err: any) {
    console.error("Failed to summarise notebook languages:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to load languages" },
      { status: 500 }
    );
  }
}
