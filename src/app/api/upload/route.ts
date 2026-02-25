import { NextResponse } from "next/server";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  isCloudinaryConfigured,
  uploadImage,
  getMaxSize,
  getAllowedTypes,
} from "@/lib/cloudinary";

const UPLOAD_DIR = "public/uploads/profile";
const ALLOWED_TYPES = getAllowedTypes();
const MAX_SIZE = getMaxSize();

function getExt(name: string): string {
  const ext = path.extname(name).toLowerCase();
  if ([".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext)) return ext;
  return ".jpg";
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") ?? formData.get("image");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Use JPEG, PNG, WebP or GIF." },
        { status: 400 }
      );
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "Image must be under 5MB." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    if (isCloudinaryConfigured()) {
      const { url } = await uploadImage(buffer, file.type);
      return NextResponse.json({ url });
    }

    // Fallback: local disk (dev only; not suitable for production)
    const dir = path.join(process.cwd(), UPLOAD_DIR);
    await mkdir(dir, { recursive: true });
    const ext = getExt(file.name);
    const filename = `${randomUUID()}${ext}`;
    const filepath = path.join(dir, filename);
    await writeFile(filepath, buffer);
    const url = `/uploads/profile/${filename}`;
    return NextResponse.json({ url });
  } catch (err) {
    console.error("[upload] Error:", err);
    const message = err instanceof Error ? err.message : "Upload failed.";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
