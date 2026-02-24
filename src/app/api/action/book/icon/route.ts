import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { ACTION_ICON_FALLBACK } from "@/lib/constants";

export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Cache-Control": "public, max-age=300",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

async function serveFallbackIcon(): Promise<NextResponse> {
  try {
    const res = await fetch(ACTION_ICON_FALLBACK, {
      headers: { "User-Agent": "IntervalBlink/1" },
    });
    if (!res.ok) throw new Error("Fallback fetch failed");
    const buffer = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get("content-type") || "image/x-icon";
    return new NextResponse(buffer, {
      status: 200,
      headers: { "Content-Type": contentType, ...CORS_HEADERS },
    });
  } catch {
    return new NextResponse(null, { status: 404, headers: CORS_HEADERS });
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slotId = searchParams.get("slotId");

  if (!slotId) {
    return serveFallbackIcon();
  }

  try {
    const slot = await prisma.slot.findUnique({
      where: { id: slotId },
      include: { creator: true },
    });

    if (!slot?.creator?.profileImageUrl?.trim()) {
      return serveFallbackIcon();
    }

    const url = slot.creator.profileImageUrl.trim();

    // External URL: proxy so we can add CORS headers
    if (url.startsWith("http://") || url.startsWith("https://")) {
      const imgRes = await fetch(url, {
        headers: { "User-Agent": "IntervalBlink/1" },
      });
      if (!imgRes.ok) return serveFallbackIcon();
      const contentType = imgRes.headers.get("content-type") || "image/png";
      const buffer = Buffer.from(await imgRes.arrayBuffer());
      return new NextResponse(buffer, {
        status: 200,
        headers: { "Content-Type": contentType, ...CORS_HEADERS },
      });
    }

    // Local path: serve from public/uploads with CORS
    const localPath = path.join(process.cwd(), "public", url.startsWith("/") ? url : `/${url}`);
    const ext = path.extname(localPath).toLowerCase();
    const contentType =
      ext === ".png" ? "image/png"
      : ext === ".gif" ? "image/gif"
      : ext === ".webp" ? "image/webp"
      : "image/jpeg";

    const buffer = await readFile(localPath);
    return new NextResponse(buffer, {
      status: 200,
      headers: { "Content-Type": contentType, ...CORS_HEADERS },
    });
  } catch {
    return serveFallbackIcon();
  }
}
