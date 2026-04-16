"use client";

import { useRef, useState } from "react";
import { Camera, X, Loader2, CheckCircle2, AlertCircle, Plus } from "lucide-react";

export interface AnalyzedPhoto {
  id: string;
  dataUrl: string;
  topicId: string;
  topicLabel: string;
  sentiment: "positive" | "negative" | "neutral";
  label: string;
}

interface PhotoUploadProps {
  photos: AnalyzedPhoto[];
  onChange: (photos: AnalyzedPhoto[]) => void;
  maxPhotos?: number;
}

const SENTIMENT_COLOR: Record<string, string> = {
  positive: "#22c55e",
  negative: "#ef4444",
  neutral: "#6b7280",
};

const SENTIMENT_LABEL: Record<string, string> = {
  positive: "Positive",
  negative: "Negative",
  neutral: "Neutral",
};

type PhotoState =
  | { status: "analyzing" }
  | { status: "done"; photo: AnalyzedPhoto }
  | { status: "error" };

export default function PhotoUpload({ photos, onChange, maxPhotos = 10 }: PhotoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ id: string; dataUrl: string; state: PhotoState }[]>([]);
  const [dragging, setDragging] = useState(false);

  const canAdd = photos.length + pending.filter((p) => p.state.status === "analyzing").length < maxPhotos;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (canAdd) setDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (canAdd) handleFiles(e.dataTransfer.files);
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;

    const slots = Array.from(files).slice(0, maxPhotos - photos.length);

    for (const file of slots) {
      if (!file.type.startsWith("image/")) continue;
      if (file.size > 8 * 1024 * 1024) {
        alert(`"${file.name}" is too large (max 8 MB).`);
        continue;
      }

      const dataUrl = await readAsDataUrl(file);
      const id = crypto.randomUUID();

      setPending((prev) => [...prev, { id, dataUrl, state: { status: "analyzing" } }]);

      try {
        const res = await fetch("/api/analyze-photo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dataUrl }),
        });
        const data = await res.json();

        const photo: AnalyzedPhoto = {
          id,
          dataUrl,
          topicId: data.topicId,
          topicLabel: data.topicLabel,
          sentiment: data.sentiment,
          label: data.label,
        };

        // Move from pending → confirmed
        setPending((prev) => prev.filter((p) => p.id !== id));
        onChange([...photos, photo]);
      } catch {
        setPending((prev) =>
          prev.map((p) => (p.id === id ? { ...p, state: { status: "error" } } : p))
        );
      }
    }
  };

  const removePhoto = (id: string) => {
    onChange(photos.filter((p) => p.id !== id));
  };

  const removePending = (id: string) => {
    setPending((prev) => prev.filter((p) => p.id !== id));
  };

  const allItems = [
    ...photos.map((p) => ({ id: p.id, dataUrl: p.dataUrl, state: { status: "done" as const, photo: p } })),
    ...pending,
  ];

  return (
    <div className="space-y-4">
      {/* Grid of photos */}
      {allItems.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {allItems.map((item) => (
            <div key={item.id} className="relative rounded-xl overflow-hidden border border-[#e5e0d8] bg-gray-50">
              {/* Image */}
              <img
                src={item.dataUrl}
                alt="Review photo"
                className="w-full h-36 object-cover"
              />

              {/* Remove button */}
              <button
                onClick={() => item.state.status === "done" ? removePhoto(item.id) : removePending(item.id)}
                className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80 transition-colors"
              >
                <X className="w-3.5 h-3.5 text-white" />
              </button>

              {/* Status overlay / label */}
              {item.state.status === "analyzing" && (
                <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-1.5">
                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                  <p className="text-white text-xs font-medium">Analyzing…</p>
                </div>
              )}

              {item.state.status === "error" && (
                <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-1.5">
                  <AlertCircle className="w-5 h-5 text-red-400" />
                  <p className="text-white text-xs font-medium">Failed</p>
                </div>
              )}

              {item.state.status === "done" && (
                <div className="px-2.5 py-2 bg-white">
                  <div className="flex items-start gap-1.5">
                    <CheckCircle2
                      className="w-3.5 h-3.5 flex-shrink-0 mt-0.5"
                      style={{ color: SENTIMENT_COLOR[item.state.photo.sentiment] }}
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[#1a1a2e] truncate leading-snug">
                        {item.state.photo.label}
                      </p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span
                          className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                          style={{
                            background: SENTIMENT_COLOR[item.state.photo.sentiment] + "20",
                            color: SENTIMENT_COLOR[item.state.photo.sentiment],
                          }}
                        >
                          {SENTIMENT_LABEL[item.state.photo.sentiment]}
                        </span>
                        <span className="text-[10px] text-gray-400 truncate">
                          {item.state.photo.topicLabel}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Add more tile */}
          {canAdd && (
            <button
              onClick={() => inputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`h-36 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all group ${
                dragging
                  ? "border-[#ff6b35] bg-orange-50 scale-[1.01]"
                  : "border-[#e5e0d8] hover:border-[#ff6b35] hover:bg-orange-50"
              }`}
            >
              <Plus className={`w-6 h-6 transition-colors ${dragging ? "text-[#ff6b35]" : "text-gray-300 group-hover:text-[#ff6b35]"}`} />
              <span className={`text-xs transition-colors ${dragging ? "text-[#ff6b35]" : "text-gray-400 group-hover:text-[#ff6b35]"}`}>
                {dragging ? "Drop to upload" : "Add photo"}
              </span>
            </button>
          )}
        </div>
      )}

      {/* Initial upload button (no photos yet) */}
      {allItems.length === 0 && (
        <button
          onClick={() => inputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`w-full py-10 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-3 transition-all group ${
            dragging
              ? "border-[#ff6b35] bg-orange-50 scale-[1.01]"
              : "border-[#e5e0d8] hover:border-[#ff6b35] hover:bg-orange-50"
          }`}
        >
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{ background: "#fff0eb" }}
          >
            <Camera className="w-6 h-6 text-[#ff6b35]" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-[#1a1a2e]">
              {dragging ? "Drop to upload" : "Upload photos"}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              Drag and drop or click to select · up to {maxPhotos} photos · max 8 MB each
            </p>
          </div>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
        onClick={(e) => { (e.target as HTMLInputElement).value = ""; }}
      />

      {photos.length > 0 && (
        <p className="text-xs text-gray-400 text-center">
          {photos.length} photo{photos.length !== 1 ? "s" : ""} added
          {maxPhotos - photos.length > 0 ? ` · ${maxPhotos - photos.length} remaining` : " · limit reached"}
        </p>
      )}
    </div>
  );
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
