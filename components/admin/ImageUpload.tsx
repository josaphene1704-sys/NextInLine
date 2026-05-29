"use client";

import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ImageIcon, Loader2, Pencil, Trash2 } from "lucide-react";

interface Props {
  value: string;
  onChange: (url: string) => void;
  shape?: "circle" | "square" | "banner";
}

export function ImageUpload({ value, onChange, shape = "circle" }: Props) {
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const getStorageUrl = useMutation(api.files.getStorageUrl);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const uploadUrl = await generateUploadUrl();
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      const { storageId } = await res.json();
      const url = await getStorageUrl({ storageId });
      if (url) onChange(url);
    } finally {
      setUploading(false);
    }
  }

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      className="hidden"
      onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) handleFile(file);
        e.target.value = "";
      }}
    />
  );

  // ── Banner variant ──────────────────────────────────────────────────────────
  if (shape === "banner") {
    return (
      <div className="space-y-0">
        <div
          role="button"
          tabIndex={value ? -1 : 0}
          onClick={() => !value && !uploading && inputRef.current?.click()}
          onKeyDown={(e) => e.key === "Enter" && !value && inputRef.current?.click()}
          className={[
            "relative w-full aspect-[3/1] rounded-xl overflow-hidden border-2 transition-colors",
            value
              ? "border-border"
              : "border-dashed border-border hover:border-primary/50 cursor-pointer bg-muted/40",
          ].join(" ")}
        >
          {/* Preview */}
          {value && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="w-full h-full object-cover" />
          )}

          {/* Empty placeholder */}
          {!value && !uploading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground select-none">
              <ImageIcon className="w-8 h-8 opacity-40" />
              <span className="text-sm font-medium">לחצי להעלאת תמונת כותרת</span>
              <span className="text-xs opacity-60">JPG, PNG, WEBP</span>
            </div>
          )}

          {/* Upload overlay */}
          {uploading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/70 backdrop-blur-sm">
              <Loader2 className="w-7 h-7 animate-spin text-primary" />
              <span className="text-sm font-medium text-foreground">מעלה תמונה...</span>
            </div>
          )}

          {/* Action buttons overlay (when image exists) */}
          {value && !uploading && (
            <div className="absolute inset-0 flex items-center justify-center gap-3 opacity-0 hover:opacity-100 transition-opacity bg-black/30">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
                className="flex items-center gap-1.5 rounded-lg bg-white/90 px-3 py-1.5 text-xs font-semibold text-foreground shadow hover:bg-white transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
                החלפי תמונה
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onChange(""); }}
                className="flex items-center gap-1.5 rounded-lg bg-white/90 px-3 py-1.5 text-xs font-semibold text-destructive shadow hover:bg-white transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                הסרי
              </button>
            </div>
          )}
        </div>
        {fileInput}
      </div>
    );
  }

  // ── Square / Circle variant (original) ────────────────────────────────────
  const shapeClass = shape === "circle" ? "rounded-full" : "rounded-lg";

  return (
    <div className="flex items-center gap-3">
      {value ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={value}
          alt=""
          className={`w-14 h-14 object-cover border bg-muted ${shapeClass}`}
        />
      ) : (
        <div
          className={`w-14 h-14 bg-muted border flex items-center justify-center shrink-0 ${shapeClass}`}
        >
          <ImageIcon className="w-5 h-5 text-muted-foreground/40" />
        </div>
      )}

      <div className="space-y-1.5">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="block text-xs border border-border rounded-md px-3 py-1.5 hover:bg-accent transition-colors disabled:opacity-50"
        >
          {uploading ? "מעלה..." : value ? "החלף תמונה" : "העלה תמונה"}
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="block text-xs text-muted-foreground hover:text-destructive transition-colors"
          >
            הסר
          </button>
        )}
      </div>

      {fileInput}
    </div>
  );
}
