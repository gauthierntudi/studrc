"use client";

import { useRef, useState } from "react";
import { FileUp, ImagePlus } from "lucide-react";
import { cn } from "@/lib/utils";

export function AdminDropzone({
  accept,
  hint,
  label,
  fileName,
  previewUrl,
  variant = "file",
  thumbRatio = "portrait",
  multiple = false,
  onFile,
  onFiles,
}: {
  accept: string;
  hint: string;
  label: string;
  fileName?: string | null;
  previewUrl?: string | null;
  variant?: "image" | "file";
  thumbRatio?: "portrait" | "wide" | "square";
  /** Accepte plusieurs fichiers : ils arrivent via `onFiles`. */
  multiple?: boolean;
  onFile?: (file: File | null) => void;
  onFiles?: (files: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function pick(list: FileList | null | undefined) {
    const files = Array.from(list ?? []);
    if (multiple && onFiles) {
      if (files.length) onFiles(files);
      return;
    }
    onFile?.(files[0] ?? null);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    if (e.dataTransfer.files?.length) pick(e.dataTransfer.files);
  }

  return (
    <div
      className={cn(
        "admin-mag__dropzone",
        variant === "image" && "admin-mag__dropzone--image",
        dragging && "admin-mag__dropzone--active",
        fileName && "admin-mag__dropzone--filled",
      )}
      onDragEnter={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setDragging(false);
      }}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      aria-label={label}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="admin-mag__dropzone-input"
        onChange={(e) => {
          pick(e.target.files);
          e.target.value = "";
        }}
        onClick={(e) => e.stopPropagation()}
      />

      {variant === "image" && previewUrl ? (
        <img
          src={previewUrl}
          alt=""
          className={cn(
            "admin-mag__dropzone-thumb",
            thumbRatio === "wide" && "admin-mag__dropzone-thumb--wide",
            thumbRatio === "square" && "admin-mag__dropzone-thumb--square",
          )}
        />
      ) : (
        <span className="admin-mag__dropzone-icon" aria-hidden>
          {variant === "image" ? (
            <ImagePlus strokeWidth={1.6} />
          ) : (
            <FileUp strokeWidth={1.6} />
          )}
        </span>
      )}

      <div className="admin-mag__dropzone-copy">
        <strong>{label}</strong>
        <span>{hint}</span>
        {fileName ? (
          <em className="admin-mag__dropzone-file">{fileName}</em>
        ) : null}
      </div>
    </div>
  );
}
