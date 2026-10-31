import { ALLOWED_MEDIA_TYPES, MAX_MEDIA_BYTES } from "./schemas";

export const PHOTO_TARGET_BYTES = 750 * 1024;
export const MAX_SOURCE_PHOTO_BYTES = 25 * 1024 * 1024;
export const MAX_PHOTO_REQUEST_BYTES = MAX_MEDIA_BYTES;
export const MAX_PHOTOS_PER_BATCH = 10;

export async function compressActivityPhoto(file: File): Promise<File> {
  if (!(ALLOWED_MEDIA_TYPES as readonly string[]).includes(file.type)) {
    throw new Error("Choose JPG, PNG, WebP or GIF images.");
  }
  if (file.size === 0 || file.size > MAX_SOURCE_PHOTO_BYTES) {
    throw new Error("Choose a non-empty photo no larger than 25 MB.");
  }
  if (file.type === "image/gif") {
    if (file.size > MAX_PHOTO_REQUEST_BYTES) {
      throw new Error(
        "Animated GIFs must be 3 MB or smaller. Choose a JPG, PNG or WebP photo instead.",
      );
    }
    return file;
  }
  const { default: imageCompression } =
    await import("browser-image-compression");
  const compressed = await imageCompression(file, {
    maxSizeMB: PHOTO_TARGET_BYTES / (1024 * 1024),
    maxWidthOrHeight: 1600,
    initialQuality: 0.82,
    maxIteration: 15,
    fileType: "image/webp",
    preserveExif: false,
    useWebWorker: true,
    libURL:
      "https://cdn.jsdelivr.net/npm/browser-image-compression@2.0.2/dist/browser-image-compression.js",
  });
  if (compressed.size === 0 || compressed.size > PHOTO_TARGET_BYTES) {
    throw new Error(
      "This photo could not be reduced enough. Choose a smaller image and retry.",
    );
  }
  return new File([compressed], file.name, {
    type: compressed.type,
    lastModified: file.lastModified,
  });
}

export async function uploadActivityPhotos({
  files,
  activityId,
  caption,
  upload,
  onProgress,
}: {
  files: File[];
  activityId: string;
  caption: string;
  upload: (data: FormData) => Promise<{ success: boolean; error?: string }>;
  onProgress: (message: string) => void;
}) {
  if (files.length === 0 || files.length > MAX_PHOTOS_PER_BATCH) {
    throw new Error("Choose between 1 and 10 photos.");
  }
  const failures: { file: File; error: string }[] = [];
  let uploaded = 0;
  let originalBytes = 0;
  let uploadedBytes = 0;
  for (const [index, file] of files.entries()) {
    try {
      onProgress(`Preparing photo ${index + 1} of ${files.length}`);
      const photo = await compressActivityPhoto(file);
      const data = new FormData();
      data.set("activityId", activityId);
      data.set("caption", caption);
      data.append("files", photo);
      onProgress(`Uploading photo ${index + 1} of ${files.length}`);
      const result = await upload(data);
      if (!result.success)
        throw new Error(result.error || "Upload failed. Please retry.");
      uploaded += 1;
      originalBytes += file.size;
      uploadedBytes += photo.size;
    } catch (error) {
      failures.push({
        file,
        error:
          error instanceof Error
            ? error.message
            : "Upload failed. Please retry.",
      });
    }
  }
  return { uploaded, originalBytes, uploadedBytes, failures };
}
