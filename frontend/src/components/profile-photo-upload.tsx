"use client";

import { useRef, useState } from "react";

type ProfilePhotoUploadProps = {
  value: string;
  onChange: (url: string) => void;
  placeholderLetter?: string;
  size?: "md" | "lg";
};

export function ProfilePhotoUpload({
  value,
  onChange,
  placeholderLetter = "?",
  size = "lg",
}: ProfilePhotoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const sizeClass = size === "lg" ? "w-20 h-20" : "w-16 h-16";
  const plusSize = size === "lg" ? "w-7 h-7" : "w-6 h-6";

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok && data.url) {
        onChange(data.url);
      } else {
        setUploadError(data?.error ?? "Upload failed");
      }
    } catch {
      setUploadError("Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className={`${sizeClass} rounded-full overflow-hidden border-2 border-white/20 bg-white/10 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-white/40 focus:ring-offset-2 focus:ring-offset-[#0d0d0f] hover:border-white/30 transition-colors disabled:opacity-60 disabled:pointer-events-none`}
        >
          {value ? (
            <img
              src={value}
              alt="Profile"
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <span className="text-2xl font-semibold text-white/40">
              {placeholderLetter}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className={`absolute -top-0.5 -right-0.5 ${plusSize} rounded-full flex items-center justify-center border-2 border-white/20 bg-[#ffd28e] text-black hover:bg-[#ffdc9e] focus:outline-none focus:ring-2 focus:ring-[#ffd28e] focus:ring-offset-2 focus:ring-offset-[#0d0d0f] transition-colors disabled:opacity-60 disabled:pointer-events-none shadow-lg`}
          aria-label="Upload photo"
        >
          {uploading ? (
            <SpinnerIcon className="w-3.5 h-3.5" />
          ) : (
            <PlusIcon className="w-4 h-4" />
          )}
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleFile}
        className="hidden"
      />
      {uploadError && (
        <p className="text-xs text-red-400">{uploadError}</p>
      )}
    </div>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
