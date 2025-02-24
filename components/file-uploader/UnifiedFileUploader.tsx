"use client";

import React, { useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Props for UnifiedFileUploader
 */
export interface UnifiedFileUploaderProps {
  /** Optional label to show at top of drop zone */
  label?: string;
  /** The accept string for file input, e.g. "image/*, .pdf" */
  accept?: string;
  /** Maximum file size in bytes; defaults to ~100MB */
  maxSize?: number;
  /** Called after successful upload. Each file is returned individually. */
  onUpload: (files: File[]) => Promise<void> | void;
  /** Whether to allow multiple files. Defaults to true. */
  multiple?: boolean;
  /** The progress, if you want to feed it from external upload logic. 0..100 */
  progress?: number;
  /** Any current status message if you want to show it. */
  statusMessage?: string;
}

export function UnifiedFileUploader({
  label = "Upload Files",
  accept = "*/*",
  maxSize = 100 * 1024 * 1024, // 100 MB default
  onUpload,
  multiple = true,
  progress,
  statusMessage
}: UnifiedFileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const files = Array.from(e.dataTransfer.files);
      void processFiles(files);
    },
    []
  );

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    void processFiles(files);
  }, []);

  const processFiles = async (files: File[]) => {
    // Basic validation
    const invalidFiles: string[] = [];
    const validFiles: File[] = [];

    for (const file of files) {
      if (file.size > maxSize) {
        invalidFiles.push(file.name);
      } else {
        validFiles.push(file);
      }
    }

    if (invalidFiles.length > 0) {
      toast.error(
        `Some files exceed the maximum size of ${Math.round(maxSize / 1024 / 1024)} MB: ${invalidFiles.join(", ")}`
      );
    }

    if (validFiles.length > 0) {
      try {
        await onUpload(validFiles);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to upload files");
      }
    }

    // Reset the input so user can re-select same file
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const handleBrowseClick = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.click();
    }
  }, []);

  return (
    <div className="space-y-4">
      <button
        type="button"
        className={cn(
          "group relative w-full rounded-xl border-2 border-dashed p-8 text-center transition-all duration-300",
          isDragging
            ? "border-cyan-500/50 bg-cyan-500/5"
            : "border-white/10 bg-black/20 hover:border-cyan-500/30"
        )}
        onClick={handleBrowseClick}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* Enhanced gradient overlay */}
        <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-cyan-500/10 via-transparent to-purple-500/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

        <div className="relative z-10">
          <div className="mb-4">
            <div className="mx-auto size-16 rounded-2xl border border-white/10 bg-gradient-to-br from-cyan-500/20 to-purple-500/20 p-4 transition-all duration-300 group-hover:border-cyan-500/20 group-hover:shadow-[0_0_30px_rgba(0,255,255,0.2)]">
              <Upload className="size-full text-cyan-400 transition-colors duration-300 group-hover:text-cyan-300" />
            </div>
          </div>
          <h3 className="mb-2 text-lg font-medium text-white/90">{label}</h3>
          <p className="mb-4 text-sm text-white/70">
            or click to browse from your computer
          </p>
          <Button
            className="group/btn relative overflow-hidden bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg transition-all duration-300 hover:from-cyan-600 hover:to-blue-600 hover:shadow-[0_0_30px_rgba(0,255,255,0.3)]"
            onClick={handleBrowseClick}
          >
            Select Files
            <div className="absolute inset-0 overflow-hidden">
              <div className="group-hover/btn:animate-scan absolute -left-full top-0 h-px w-full bg-gradient-to-r from-transparent via-white/60 to-transparent" />
            </div>
          </Button>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept={accept}
            multiple={multiple}
            onChange={handleFileSelect}
          />
        </div>
      </button>

      {typeof progress === "number" && progress > 0 && (
        <div className="flex flex-col gap-1">
          <div className="relative h-2 rounded-full bg-black/40">
            <div
              className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          {statusMessage && (
            <p className="text-sm text-white/70">
              {statusMessage} ({progress}%)
            </p>
          )}
        </div>
      )}
    </div>
  );
}