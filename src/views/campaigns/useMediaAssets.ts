/**
 * Uploaded media assets management for the campaign builder.
 */
import React, { useEffect, useState } from 'react';
import type { UploadedAsset, MediaLimits } from './types';

export interface UseMediaAssetsProps {
  effectiveMediaLimits: MediaLimits;
  isHebrew: boolean;
  onMessage: (msg: string | null) => void;
}

export function useMediaAssets({ effectiveMediaLimits, isHebrew, onMessage }: UseMediaAssetsProps) {
  const [uploadedAssets, setUploadedAssets] = useState<UploadedAsset[]>([]);

  // Revoke object URLs on unmount / change
  useEffect(() => {
    return () => {
      uploadedAssets.forEach((asset) => URL.revokeObjectURL(asset.previewUrl));
    };
  }, [uploadedAssets]);

  // ── Image resize helpers ──────────────────────────────────────────────────

  const loadImageElement = (file: File) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load image.')); };
      img.src = url;
    });

  const resizeImageForPlatforms = async (file: File) => {
    const img = await loadImageElement(file);
    const { width, height } = img;
    const scale = Math.min(
      1,
      effectiveMediaLimits.maxImageWidth / Math.max(width, 1),
      effectiveMediaLimits.maxImageHeight / Math.max(height, 1)
    );
    if (scale >= 1) return { file, width, height };
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { file, width, height };
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
    const preferredType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    const quality = preferredType === 'image/png' ? undefined : 0.92;
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, preferredType, quality)
    );
    if (!blob) return { file, width, height };
    const ext = preferredType === 'image/png' ? '.png' : '.jpg';
    const baseName = file.name.replace(/\.[^.]+$/, '');
    return {
      file: new File([blob], `${baseName}${ext}`, { type: preferredType, lastModified: Date.now() }),
      width: targetWidth,
      height: targetHeight,
    };
  };

  // ── Handlers ──────────────────────────────────────────────────────────────

  const appendMediaFiles = async (files: File[]) => {
    if (!files.length) return;
    const imageMaxBytes = effectiveMediaLimits.imageMaxMb * 1024 * 1024;
    const videoMaxBytes = effectiveMediaLimits.videoMaxMb * 1024 * 1024;
    const mapped: UploadedAsset[] = [];
    for (const file of files) {
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      if (!isImage && !isVideo) continue;
      if (isImage && file.size > imageMaxBytes) {
        onMessage(
          isHebrew
            ? `קובץ תמונה "${file.name}" גדול מדי לתנאי הפלטפורמות שנבחרו.`
            : `Image "${file.name}" is too large for selected platform requirements.`
        );
        continue;
      }
      if (isVideo && file.size > videoMaxBytes) {
        onMessage(
          isHebrew
            ? `קובץ וידאו "${file.name}" גדול מדי לתנאי הפלטפורמות שנבחרו.`
            : `Video "${file.name}" is too large for selected platform requirements.`
        );
        continue;
      }
      let optimizedFile = file;
      let width: number | undefined;
      let height: number | undefined;
      if (isImage) {
        try {
          const optimized = await resizeImageForPlatforms(file);
          optimizedFile = optimized.file;
          width = optimized.width;
          height = optimized.height;
        } catch {
          optimizedFile = file;
        }
      }
      mapped.push({
        id: `${optimizedFile.name}-${optimizedFile.size}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: optimizedFile.name,
        size: optimizedFile.size,
        type: optimizedFile.type,
        file: optimizedFile,
        previewUrl: URL.createObjectURL(optimizedFile),
        mediaType: isVideo ? 'video' : 'image',
        width,
        height,
      });
    }
    if (mapped.length > 0) {
      setUploadedAssets((prev) => [...prev, ...mapped].slice(0, 12));
      onMessage(null);
    }
  };

  const handleAssetUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []) as File[];
    e.target.value = '';
    await appendMediaFiles(files);
  };

  const removeAsset = (id: string) => {
    setUploadedAssets((prev) => {
      const target = prev.find((a) => a.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((a) => a.id !== id);
    });
  };

  const clearUploadedMedia = () => {
    setUploadedAssets((prev) => {
      prev.forEach((a) => URL.revokeObjectURL(a.previewUrl));
      return [];
    });
  };

  return {
    uploadedAssets,
    handleAssetUpload,
    appendMediaFiles,
    removeAsset,
    clearUploadedMedia,
  };
}
