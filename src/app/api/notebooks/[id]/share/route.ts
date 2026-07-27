import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import crypto from "crypto";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const notebook = await db.notebook.findUnique({
      where: { id },
      select: { id: true, isPublic: true, shareToken: true },
    });

    if (!notebook) {
      return NextResponse.json({ error: "Notebook not found" }, { status: 404 });
    }

    const host = req.headers.get("host") || "localhost:3000";
    const protocol = req.headers.get("x-forwarded-proto") || "http";
    const baseUrl = `${protocol}://${host}`;

    return NextResponse.json({
      isPublic: notebook.isPublic,
      shareToken: notebook.shareToken,
      shareUrl: notebook.shareToken ? `${baseUrl}/share/${notebook.shareToken}` : null,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch share status" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { id } = await params;
    const { enable } = await req.json();

    const notebook = await db.notebook.findUnique({
      where: { id },
      select: { id: true, isPublic: true, shareToken: true },
    });

    if (!notebook) {
      return NextResponse.json({ error: "Notebook not found" }, { status: 404 });
    }

    let shareToken = notebook.shareToken;
    if (enable && !shareToken) {
      shareToken = `ps_${crypto.randomBytes(8).toString("hex")}`;
    }

    const updated = await db.notebook.update({
      where: { id },
      data: {
        isPublic: enable,
        shareToken: enable ? shareToken : notebook.shareToken,
      },
    });

    const host = req.headers.get("host") || "localhost:3000";
    const protocol = req.headers.get("x-forwarded-proto") || "http";
    const baseUrl = `${protocol}://${host}`;

    return NextResponse.json({
      isPublic: updated.isPublic,
      shareToken: updated.shareToken,
      shareUrl: updated.shareToken ? `${baseUrl}/share/${updated.shareToken}` : null,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to update share status" }, { status: 500 });
  }
}
