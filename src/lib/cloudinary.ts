import { v2 as cloudinary } from "cloudinary";

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

if (cloudName) {
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey ?? "",
    api_secret: apiSecret ?? "",
    secure: true,
  });
}

const FOLDER = "interval/profile";
const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export function isCloudinaryConfigured(): boolean {
  return Boolean(cloudName && apiKey && apiSecret);
}

export function getMaxSize(): number {
  return MAX_BYTES;
}

export function getAllowedTypes(): string[] {
  return [...ALLOWED_TYPES];
}

export type UploadResult = { url: string; secureUrl: string; publicId: string };

export async function uploadImage(
  buffer: Buffer,
  mimeType: string,
  options?: { publicId?: string }
): Promise<UploadResult> {
  if (!isCloudinaryConfigured()) {
    throw new Error("Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.");
  }
  if (!ALLOWED_TYPES.includes(mimeType)) {
    throw new Error("Invalid file type. Use JPEG, PNG, WebP or GIF.");
  }

  const base64 = buffer.toString("base64");
  const dataUri = `data:${mimeType};base64,${base64}`;

  const result = await cloudinary.uploader.upload(dataUri, {
    folder: FOLDER,
    public_id: options?.publicId,
    resource_type: "image",
    overwrite: true,
  });

  return {
    url: result.secure_url,
    secureUrl: result.secure_url,
    publicId: result.public_id,
  };
}
