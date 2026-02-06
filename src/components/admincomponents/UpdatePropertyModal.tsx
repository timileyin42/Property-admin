import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import axios from "axios";
import { presignUpload } from "../../api/files";
import { ApiProperty } from "../../types/property";
import {
  PropertyStatusFilter,
  UpdateAdminPropertyPayload,
  deleteAdminProperty,
  updateAdminProperty,
} from "../../api/admin.properties";
import { isVideoUrl } from "../../util/normalizeMediaUrl";
import { getErrorMessage } from "../../util/getErrorMessage";
import { usePresignedMediaUrls } from "../../hooks/usePresignedMediaUrls";

interface UpdatePropertyModalProps {
  isOpen: boolean;
  onClose: () => void;
  property: ApiProperty | null;
  onUpdate: (updatedProperty: ApiProperty) => void;
  onDelete: (deletedId: number) => void;
}

const STATUS_OPTIONS: PropertyStatusFilter[] = [
  "AVAILABLE",
  "SOLD",
];

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

const toNumberOrUndefined = (value: string) => {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
};

const sanitizeFileName = (name: string) =>
  name
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "_");

export const UpdatePropertyModal: React.FC<UpdatePropertyModalProps> = ({
  isOpen,
  onClose,
  property,
  onUpdate,
  onDelete,
}) => {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<PropertyStatusFilter>("AVAILABLE");
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [areaSqft, setAreaSqft] = useState("");
  const [expectedRoi, setExpectedRoi] = useState("");
  const [totalFractions, setTotalFractions] = useState("");
  const [fractionPrice, setFractionPrice] = useState("");
  const [projectValue, setProjectValue] = useState("");
  const [isOffPlan, setIsOffPlan] = useState(false);
  const [offPlanDurationMonths, setOffPlanDurationMonths] = useState("");
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!property) return;
    setStatus((property.status as PropertyStatusFilter) || "AVAILABLE");
    setTitle(property.title ?? "");
    setLocation(property.location ?? "");
    setDescription(property.description ?? "");
    setMediaUrls((property.image_urls ?? []).filter(Boolean));
    setAreaSqft(property.area_sqft?.toString() ?? "");
    setExpectedRoi(property.expected_roi?.toString() ?? "");
    setTotalFractions(property.total_fractions?.toString() ?? "");
    setFractionPrice(property.fraction_price?.toString() ?? "");
    setProjectValue(property.project_value?.toString() ?? "");
    setIsOffPlan(Boolean(property.is_off_plan));
    setOffPlanDurationMonths(property.off_plan_duration_months?.toString() ?? "");
  }, [property]);

  const resolvedMediaUrls = usePresignedMediaUrls(mediaUrls);

  const removeMedia = (url: string) => {
    setMediaUrls((prev) => prev.filter((item) => item !== url));
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
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

    try {
      setLoading(true);
      const uploadedKeys: string[] = [];

      for (const file of validFiles) {
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

        await axios.post(upload_url, file, { headers });

        uploadedKeys.push(file_key);
      }

      if (uploadedKeys.length > 0) {
        setMediaUrls((prev) => [...prev, ...uploadedKeys]);
        toast.success("Media uploaded");
      }
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to upload media"));
    } finally {
      setLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!property) return;

    if (!title.trim() || !location.trim() || !description.trim()) {
      toast.error("Title, location, and description are required");
      return;
    }

    setLoading(true);
    try {
      const payload: UpdateAdminPropertyPayload = {
        title: title.trim(),
        location: location.trim(),
        description: description.trim(),
        status,
        image_urls: mediaUrls.length ? mediaUrls : undefined,
        primary_image: mediaUrls[0] ?? "",
        area_sqft: toNumberOrUndefined(areaSqft),
        expected_roi: toNumberOrUndefined(expectedRoi),
        total_fractions: toNumberOrUndefined(totalFractions),
        fraction_price: toNumberOrUndefined(fractionPrice),
        project_value: toNumberOrUndefined(projectValue),
        is_off_plan: isOffPlan,
        off_plan_duration_months: isOffPlan
          ? toNumberOrUndefined(offPlanDurationMonths) ?? null
          : null,
      };

      const updated = await updateAdminProperty(property.id, payload);
      toast.success("Property updated successfully");
      onUpdate(updated);
      onClose();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to update property"));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteOpen = () => {
    setIsDeleteOpen(true);
  };

  const handleDeleteCancel = () => {
    setIsDeleteOpen(false);
  };

  const handleDeleteConfirm = async () => {
    if (!property) return;
    try {
      setIsDeleting(true);
      await deleteAdminProperty(property.id);
      toast.success("Property deleted");
      onDelete(property.id);
      onClose();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to delete property"));
    } finally {
      setIsDeleting(false);
      setIsDeleteOpen(false);
    }
  };

  if (!isOpen || !property) return null;

  return (
    <>
      <div className="fixed inset-0 bg-gray-500 bg-opacity-100 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Update Property</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-xl"
              disabled={loading}
            >
              ✕
            </button>
          </div>

          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-sm font-medium">{property.title}</p>
            <p className="text-sm text-gray-600">{property.location}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  Location *
                </label>
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description *
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                required
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as PropertyStatusFilter)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                disabled={loading}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Media
              </label>
              <div className="border border-dashed border-gray-300 rounded-lg p-4 space-y-3">
                <div className="flex flex-wrap gap-3">
                    {resolvedMediaUrls.length === 0 ? (
                    <p className="text-sm text-gray-500">
                      No media uploaded.
                    </p>
                  ) : (
                      resolvedMediaUrls.map(({ raw, url }) => (
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
                            alt="Property media"
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Area (sqft)
              </label>
              <input
                type="number"
                value={areaSqft}
                onChange={(e) => setAreaSqft(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                disabled={loading}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expected ROI
                </label>
                <input
                  type="number"
                  value={expectedRoi}
                  onChange={(e) => setExpectedRoi(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  disabled={loading}
                />
              </div>

              <div className="col-span-2">
                <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={isOffPlan}
                    onChange={(e) => setIsOffPlan(e.target.checked)}
                    disabled={loading}
                  />
                  Off-plan property
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Off-plan duration (months)
                </label>
                <input
                  type="number"
                  value={offPlanDurationMonths}
                  onChange={(e) => setOffPlanDurationMonths(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  disabled={loading || !isOffPlan}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Total Fractions
                </label>
                <input
                  type="number"
                  value={totalFractions}
                  onChange={(e) => setTotalFractions(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fraction Price
                </label>
                <input
                  type="number"
                  value={fractionPrice}
                  onChange={(e) => setFractionPrice(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Project Value
              </label>
              <input
                type="number"
                value={projectValue}
                onChange={(e) => setProjectValue(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                disabled={loading}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={handleDeleteOpen}
                className="px-4 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
                disabled={loading || isDeleting}
              >
                Delete Property
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                disabled={loading || isDeleting}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || isDeleting}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? "Updating..." : "Update Property"}
              </button>
            </div>
          </form>
          </div>
        </div>
      </div>
      {isDeleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-blue-900">Delete property</h3>
              <p className="mt-2 text-sm text-gray-600">
                Are you sure you want to delete this property? This action cannot be undone.
              </p>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleDeleteCancel}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteConfirm}
                  className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                  disabled={isDeleting}
                >
                  {isDeleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
