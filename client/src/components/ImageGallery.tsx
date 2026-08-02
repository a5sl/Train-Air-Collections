import React, { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Plus, Trash2, X, Loader2 } from "lucide-react";
import { api } from "../lib/api";
import { useToast } from "./fx/Toast";
import type { TripImage } from "../../../shared/types";

export default function ImageGallery({ tripId }: { tripId: number }) {
  const [images, setImages] = useState<TripImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState<TripImage | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(true);
  const { toast, confirmDlg } = useToast();

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(() => {
    api
      .getImages(tripId)
      .then((rows) => {
        if (mountedRef.current) setImages(rows);
      })
      .catch(() => {
        if (mountedRef.current) toast("加载图片失败", "err");
      });
  }, [tripId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    let okCount = 0;
    for (const file of Array.from(files)) {
      try {
        await api.uploadImage(tripId, file);
        okCount++;
      } catch (e: any) {
        if (mountedRef.current) toast(file.name + ": " + e.message, "err");
      }
    }
    if (!mountedRef.current) return;
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
    if (okCount > 0) {
      toast("已添加 " + okCount + " 张图片", "ok");
      load();
    }
  };

  const handleDelete = async (img: TripImage) => {
    const yes = await confirmDlg({
      title: "删除图片",
      message: "确定要删除这张图片吗？此操作无法撤销。",
      confirmText: "删除",
      danger: true,
    });
    if (!yes) return;
    try {
      await api.deleteImage(tripId, img.id);
      if (!mountedRef.current) return;
      toast("图片已删除", "ok");
      setLightbox((cur) => (cur && cur.id === img.id ? null : cur));
      load();
    } catch (e: any) {
      if (mountedRef.current) toast("删除失败: " + e.message, "err");
    }
  };

  return (
    <div className="card p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Camera className="w-4 h-4 text-brand" />
        <span className="text-sm font-medium text-content-secondary">行程图片</span>
        <span className="text-xs text-content-tertiary">{images.length} 张</span>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {images.map((img) => (
          <div key={img.id} className="relative group aspect-square rounded-lg overflow-hidden bg-line">
            <img
              src={img.url}
              alt={img.originalName || "行程图片"}
              loading="lazy"
              className="w-full h-full object-cover cursor-zoom-in"
              onClick={() => setLightbox(img)}
            />
            <button
              type="button"
              onClick={() => handleDelete(img)}
              className="absolute top-1 right-1 p-1 rounded-md bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity"
              title="删除"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="aspect-square rounded-lg border-2 border-dashed border-line flex flex-col items-center justify-center gap-1 text-content-tertiary hover:text-brand hover:border-brand transition-colors disabled:opacity-50"
        >
          {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
          <span className="text-xs">{uploading ? "上传中" : "添加"}</span>
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {lightbox && (
        <div
          className="fixed inset-0 z-[130] flex items-center justify-center bg-black/80 overlay-in p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
            onClick={() => setLightbox(null)}
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={lightbox.url}
            alt={lightbox.originalName || "行程图片"}
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
