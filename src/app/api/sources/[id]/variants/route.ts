import { NextRequest, NextResponse } from "next/server";
import { isVariantKind } from "@/lib/locator";
import { ensureVariant, listVariants } from "@/lib/variants";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Lists which language renderings exist or can be offered for a source. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    return NextResponse.json(await listVariants(id));
  } catch (err: any) {
    const notFound = err?.message === "Source not found";
    return NextResponse.json(
      { error: err?.message || "Failed to list variants" },
      { status: notFound ? 404 : 500 }
    );
  }
}

/**
 * Returns a rendering's text, generating and caching it on first request.
 * Translation and romanization are lazy because most sources are never read in
 * more than one language.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { kind } = await req.json();

    if (!isVariantKind(kind)) {
      return NextResponse.json(
        { error: "kind must be one of ORIGINAL, ENGLISH, ROMANIZED" },
        { status: 400 }
      );
    }

    const variant = await ensureVariant(id, kind);

    return NextResponse.json({
      kind: variant.kind,
      language: variant.language,
      rawText: variant.rawText,
      spans: variant.spans,
    });
  } catch (err: any) {
    console.error("Variant generation failed:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to generate variant" },
      { status: 500 }
    );
  }
}
