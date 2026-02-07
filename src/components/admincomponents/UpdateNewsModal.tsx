import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import axios from "axios";
import { presignDownload, presignUpload } from "../../api/files";
import type { UpdateItem } from "../../types/updates";
import type { ApiProperty } from "../../types/property";
import { fetchAdminProperties } from "../../api/admin.properties";
import { createAdminUpdate, updateAdminUpdate } from "../../api/admin.updates";
import { isVideoUrl, normalizeMediaUrl } from "../../util/normalizeMediaUrl";
import { getErrorMessage } from "../../util/getErrorMessage";
import { usePresignedMediaUrls } from "../../hooks/usePresignedMediaUrls";

interface UpdateNewsModalProps {
  isOpen: boolean;
  onClose: () => void;
  update: UpdateItem | null;
  onSuccess: (item: UpdateItem) => void;
}

const MAX_IMAGE_SIZE = 100 * 1024 * 1024;
const MAX_VIDEO_SIZE = 1024 * 1024 * 1024;
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/heif-sequence",
  "image/heic-sequence",
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/quicktime",
  "video/3gpp",
  "video/3gpp2",
  "video/x-m4v",
];

const dedupeUrls = (urls: Array<string | null | undefined>) => {
  const seen = new Set<string>();
  const result: string[] = [];
  urls.forEach((url) => {
    if (!url || seen.has(url)) return;
    seen.add(url);
    result.push(url);
  });
  return result;
};

const isDirectUrl = (value: string) =>
  value.startsWith("http") ||
  value.startsWith("blob:") ||
  value.startsWith("data:") ||
  value.startsWith("//");

const sanitizeFileName = (name: string) =>
  name
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "_");

const UpdateNewsModal: React.FC<UpdateNewsModalProps> = ({
  isOpen,
  onClose,
  update,
  onSuccess,
}) => {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [propertyId, setPropertyId] = useState("");
  const [offPlanOnly, setOffPlanOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [properties, setProperties] = useState<ApiProperty[]>([]);
  const [propertiesLoading, setPropertiesLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!update) {
      setTitle("");
      setContent("");
      setMediaUrls([]);
      setPendingFiles([]);
      setPropertyId("");
      setOffPlanOnly(false);
      return;
    }

    setTitle(update.title ?? "");
    setContent(update.content ?? "");
    const mediaFromFiles = update.media_files?.map((item) => item.url) ?? [];
    setMediaUrls(
      dedupeUrls([
        ...mediaFromFiles,
        ...(update.media_urls ?? []),
        ...(update.image_urls ?? []),
        update.image_url,
        update.video_url,
      ])
    );
    setPropertyId(update.property_id ? String(update.property_id) : "");
    setOffPlanOnly(Boolean(update.off_plan_only));
  }, [update]);

  useEffect(() => {
    if (!isOpen) return;
    setPropertiesLoading(true);
    fetchAdminProperties({ page: 1, page_size: 200 })
      .then((res) => setProperties(res.properties ?? []))
      .catch((error: unknown) => {
        toast.error(getErrorMessage(error, "Failed to load properties"));
      })
      .finally(() => setPropertiesLoading(false));
  }, [isOpen]);

  const resolvedMedia = usePresignedMediaUrls(mediaUrls);
  const resolvedMap = useMemo(
    () => new Map(resolvedMedia.map((item) => [item.raw, item.url])),
    [resolvedMedia]
  );

  const removeMedia = (url: string) => {
    setMediaUrls((prev) => prev.filter((item) => item !== url));
  };

  const previews = useMemo(
    () =>
      pendingFiles.map((file) => ({
        file,
        url: URL.createObjectURL(file),
      })),
    [pendingFiles]
  );

  useEffect(() => {
    return () => {
      previews.forEach((preview) => URL.revokeObjectURL(preview.url));
    };
  }, [previews]);

  const resolveMediaUrls = async (urls: string[]) => {
    const unique = Array.from(new Set(urls.filter(Boolean)));
    const items = await Promise.all(
      unique.map(async (raw) => {
        const cached = resolvedMap.get(raw);
        if (cached) {
          return { raw, url: cached };
        }

        if (isDirectUrl(raw)) {
          return { raw, url: normalizeMediaUrl(raw) || raw };
        }

        try {
          const res = await presignDownload({ file_key: raw });
          return { raw, url: res.download_url || raw };
        } catch {
          return { raw, url: raw };
        }
      })
    );

    return items;
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    if (selectedFiles.length === 0) return;

    const validFiles = selectedFiles.filter((file) => {
      if (!ALLOWED_TYPES.includes(file.type)) return false;
      const isVideo = file.type.startsWith("video");
      const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
      return file.size <= maxSize;
    });

    if (validFiles.length !== selectedFiles.length) {
      toast.error("Some files were rejected (type/size)");
    }

    setPendingFiles((prev) => [...prev, ...validFiles]);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const uploadPendingFiles = async (files: File[]) => {
    const uploadedKeys: string[] = [];

    for (const file of files) {
      const contentType = file.type || "application/octet-stream";
      const { upload_url, file_key, upload_headers } = await presignUpload({
        filename: sanitizeFileName(file.name),
        content_type: contentType,
      });

      const headers: Record<string, string> = {
        ...upload_headers,
      };

      if (!headers["Content-Type"] && !headers["content-type"]) {
        headers["Content-Type"] = contentType;
      }

      await axios.put(upload_url, file, { headers });

      uploadedKeys.push(file_key);
    }

    return uploadedKeys;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !content.trim()) {
      toast.error("Title and content are required");
      return;
    }

    if (offPlanOnly && !propertyId.trim()) {
      toast.error("Property ID is required for off-plan updates");
      return;
    }

    setLoading(true);
    try {
      let combinedUrls = [...mediaUrls];
      if (pendingFiles.length > 0) {
        const uploadedUrls = await uploadPendingFiles(pendingFiles);
        combinedUrls = [...combinedUrls, ...uploadedUrls];
      }

      combinedUrls = dedupeUrls(combinedUrls);

      const combinedResolved = await resolveMediaUrls(combinedUrls);

      const image = combinedResolved.find((item) => !isVideoUrl(item.url))?.raw;
      const video = combinedResolved.find((item) => isVideoUrl(item.url))?.raw;
      const media_files = combinedResolved.map((item) => ({
        media_type: (isVideoUrl(item.url) ? "video" : "image") as
          | "video"
          | "image",
        url: item.raw,
      }));

      const payload = {
        property_id: propertyId.trim() ? Number(propertyId) : undefined,
        title: title.trim(),
        content: content.trim(),
        off_plan_only: offPlanOnly,
        media_files: media_files.length ? media_files : undefined,
        image_url: image,
        video_url: video,
      };

      const result = update
        ? await updateAdminUpdate(update.id, payload)
        : await createAdminUpdate(payload);

      toast.success(update ? "Update saved" : "Update created");
      setPendingFiles([]);
      setMediaUrls(dedupeUrls(combinedUrls));
      onSuccess(result);
      onClose();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to save update"));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-100 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">
              {update ? "Edit Update" : "Create Update"}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-xl"
              disabled={loading}
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Property (required for off-plan updates)
              </label>
              <select
                value={propertyId}
                onChange={(e) => setPropertyId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                disabled={loading || propertiesLoading}
              >
                <option value="">No property selected</option>
                {properties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.title}
                  </option>
                ))}
              </select>
              {propertiesLoading && (
                <p className="text-xs text-gray-500 mt-1">Loading properties...</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title *
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                required
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Content *
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={4}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                required
                disabled={loading}
              />
            </div>

            <div>
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={offPlanOnly}
                  onChange={(e) => setOffPlanOnly(e.target.checked)}
                  disabled={loading}
                />
                Off-plan only
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Media
              </label>
              <div className="border border-dashed border-gray-300 rounded-lg p-4 space-y-3">
                <div className="flex flex-wrap gap-3">
                  {previews.length > 0 && (
                    <div className="flex flex-wrap gap-3">
                      {previews.map((preview) => (
                        <div
                          key={preview.url}
                          className="relative w-28 h-20 rounded-md overflow-hidden bg-gray-100"
                        >
                          {preview.file.type.startsWith("video") ? (
                            <video
                              src={preview.url}
                              className="w-full h-full object-cover"
                              muted
                              playsInline
                              loop
                              autoPlay
                            />
                          ) : (
                            <img
                              src={preview.url}
                              alt="Pending media"
                              className="w-full h-full object-cover"
                            />
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              setPendingFiles((prev) =>
                                prev.filter((file) => file !== preview.file)
                              )
                            }
                            className="absolute top-1 right-1 bg-black/70 text-white text-xs px-2 py-0.5 rounded"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {previews.length === 0 && resolvedMedia.length === 0 ? (
                    <p className="text-sm text-gray-500">No media uploaded.</p>
                  ) : (
                    resolvedMedia.map(({ raw, url }) => (
                      <div
                        key={raw}
                        className="relative w-28 h-20 rounded-md overflow-hidden bg-gray-100"
                      >
                        {isVideoUrl(url) ? (
                          <video
                            src={url}
                            className="w-full h-full object-cover"
                            muted
                            playsInline
                            loop
                            autoPlay
                          />
                        ) : (
                          <img
                            src={url}
                            alt="Update media"
                            className="w-full h-full object-cover"
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => removeMedia(raw)}
                          className="absolute top-1 right-1 bg-black/70 text-white text-xs px-2 py-0.5 rounded"
                        >
                          ✕
                        </button>
                      </div>
                    ))
                  )}
                </div>

                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    hidden
                    multiple
                    accept={ALLOWED_TYPES.join(",")}
                    onChange={handleFileChange}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                    disabled={loading}
                  >
                    Upload Media
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? "Saving..." : "Save Update"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default UpdateNewsModal;
