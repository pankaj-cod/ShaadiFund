"use client";

import { ImagePlus, Loader2 } from "lucide-react";
import Image from "next/image";
import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ImageDTO } from "@/modules/wedding/wedding.types";

interface ImageUploadProps {
  kind: "HERO" | "DREAM_COVER";
  label: string;
  value: ImageDTO | null;
  onChange: (image: ImageDTO | null) => void;
  /** Shape of the preview frame. */
  aspect?: "wide" | "card";
  allowRemove?: boolean;
}

const MAX_BYTES = 8 * 1024 * 1024;

/** Picks a photo, uploads it and shows the result. The server re-checks everything. */
export function ImageUpload({
  kind,
  label,
  value,
  onChange,
  aspect = "wide",
  allowRemove = true,
}: ImageUploadProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setError(null);
    if (file.size > MAX_BYTES) {
      setError("Photos can be up to 8 MB.");
      return;
    }
    setUploading(true);
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("kind", kind);
      const response = await fetch("/api/media", { method: "POST", body });
      const json: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message = (json as { error?: { message?: string } } | null)?.error?.message;
        setError(message ?? "We could not upload that photo. Please try again.");
        return;
      }
      onChange((json as { data: ImageDTO }).data);
    } catch {
      setError("We could not reach the server. Please check your connection and try again.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="grid gap-2">
      <span className="text-sm leading-none font-medium">{label}</span>
      <div
        className={cn(
          "bg-muted relative overflow-hidden rounded-lg border",
          aspect === "wide" ? "aspect-[16/9]" : "aspect-[4/3]",
        )}
      >
        {value ? (
          <Image
            src={value.url}
            alt=""
            fill
            unoptimized
            sizes="(max-width: 768px) 100vw, 640px"
            className="object-cover"
          />
        ) : (
          <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-sm">
            <ImagePlus className="size-6" aria-hidden="true" />
            <span>JPEG, PNG or WebP, up to 8 MB</span>
          </div>
        )}
        {uploading ? (
          <div
            role="status"
            className="bg-background/80 absolute inset-0 flex items-center justify-center gap-2 text-sm"
          >
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Uploading…
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {value ? "Change photo" : "Choose a photo"}
        </Button>
        {value && allowRemove ? (
          <Button type="button" variant="ghost" disabled={uploading} onClick={() => onChange(null)}>
            Remove
          </Button>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
