import { useEffect, useMemo, useRef, useState } from "react";
import { Resolver, useForm, SubmitHandler } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import toast, { Toaster } from "react-hot-toast";
import { FiUpload } from "react-icons/fi";

import { api } from "../../api/axios";
import { presignUpload } from "../../api/files";
import {
  fetchAdminProperties,
  deleteAdminPropertiesBulk,
  deleteAdminProperty,
} from "../../api/admin.properties";
import { PropertyTable } from "../../components/PropertyTable";
import type { ApiProperty } from "../../types/property";
import { getErrorMessage } from "../../util/getErrorMessage";

/* =======================
   Schema Definition
======================= */

const optionalNumber = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.coerce.number().optional()
);

const propertySchema = z.object({
  title: z.string().min(1, "Title is required"),
  location: z.string().min(1, "Location is required"),
  description: z.string().min(1, "Description is required"),
  project_value: optionalNumber,
  total_fractions: optionalNumber,
  fraction_price: optionalNumber,
  area_sqft: optionalNumber,
  expected_roi: optionalNumber,
  is_off_plan: z.boolean().optional(),
  off_plan_duration_months: optionalNumber,
});

type PropertyFormValues = z.infer<typeof propertySchema>;

type UploadProgressState = {
  totalBytes: number;
  uploadedBytes: number;
  currentFileName: string | null;
  fileProgress: Record<string, number>;
};

/* =======================
   Constants
======================= */

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

const getFileKey = (file: File) =>
  `${file.name}-${file.size}-${file.lastModified}`;

const sanitizeFileName = (name: string) =>
  name
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "_");

const buildInitialProgress = (selectedFiles: File[]): UploadProgressState => {
  const fileProgress: Record<string, number> = {};
  selectedFiles.forEach((file) => {
    fileProgress[getFileKey(file)] = 0;
  });

  return {
    totalBytes: selectedFiles.reduce((sum, file) => sum + file.size, 0),
    uploadedBytes: 0,
    currentFileName: null,
    fileProgress,
  };
};

/* =======================
   Component
======================= */

const AdminInvestmentsPage: React.FC = () => {
  const [properties, setProperties] = useState<ApiProperty[]>([]);
  const [loadingProperties, setLoadingProperties] = useState(true);
  const [files, setFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgressState | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteTargetIds, setDeleteTargetIds] = useState<number[]>([]);
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<number[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const resolver: Resolver<PropertyFormValues> =
    zodResolver(propertySchema) as Resolver<PropertyFormValues>;
  const { 
    register, 
    handleSubmit, 
    reset, 
    formState: { errors } 
  } = useForm<PropertyFormValues>({
    resolver,
    defaultValues: {
      title: "",
      location: "",
      description: "",
      project_value: undefined,
      total_fractions: undefined,
      fraction_price: undefined,
      area_sqft: undefined,
      expected_roi: undefined,
      is_off_plan: false,
      off_plan_duration_months: undefined,
    }
  });

  /* =======================
     Image Selection
  ======================= */

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);

    const validFiles = selectedFiles.filter((file) => {
      if (!ALLOWED_TYPES.includes(file.type)) return false;

      const isVideo = file.type.startsWith("video");
      const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
      return file.size <= maxSize;
    });

    if (validFiles.length !== selectedFiles.length) {
      toast.error("Some files were rejected (type/size)");
    }

    setFiles((prev) => [...prev, ...validFiles]);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeImage = (index: number) => {
    if (previews[index]?.url) {
      URL.revokeObjectURL(previews[index].url);
    }
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const previews = useMemo(
    () =>
      files.map((file) => ({
        file,
        url: URL.createObjectURL(file),
      })),
    [files]
  );

  useEffect(() => {
    return () => {
      previews.forEach((p) => URL.revokeObjectURL(p.url));
    };
  }, [previews]);

  /* =======================
     Upload to Backblaze B2
  ======================= */

  const uploadImages = async (): Promise<string[]> => {
    const uploadedKeys: string[] = [];
    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
    const fileSizes = new Map<string, number>();
    const fileUploadedBytes = new Map<string, number>();

    files.forEach((file) => {
      fileSizes.set(getFileKey(file), file.size);
    });

    const updateProgress = (
      fileKey: string,
      fileName: string,
      uploadedBytesForFile: number
    ) => {
      fileUploadedBytes.set(fileKey, uploadedBytesForFile);

      let uploadedBytesTotal = 0;
      const nextFileProgress: Record<string, number> = {};

      fileSizes.forEach((size, key) => {
        const uploaded = fileUploadedBytes.get(key) ?? 0;
        uploadedBytesTotal += uploaded;
        nextFileProgress[key] =
          size > 0 ? Math.min(100, Math.round((uploaded / size) * 100)) : 0;
      });

      setUploadProgress({
        totalBytes,
        uploadedBytes: Math.min(uploadedBytesTotal, totalBytes),
        currentFileName: fileName,
        fileProgress: nextFileProgress,
      });
    };

    for (const file of files) {
      const fileKey = getFileKey(file);
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

      await axios.put(upload_url, file, {
        headers,
        onUploadProgress: (event) => {
          if (event.total) {
            updateProgress(fileKey, file.name, event.loaded);
          }
        },
      });

      uploadedKeys.push(file_key);
      updateProgress(fileKey, file.name, file.size);
    }

    return uploadedKeys;
  };

  /* =======================
     Submit Handler
  ======================= */

  const onSubmit: SubmitHandler<PropertyFormValues> = async (data) => {
    if (files.length === 0) {
      toast.error("Please upload at least one image");
      return;
    }

    setIsSubmitting(true);
    setUploadProgress(buildInitialProgress(files));

    try {
      const imageKeys = await uploadImages();
      const payload = {
        ...data,
        off_plan_duration_months: data.off_plan_duration_months ?? null,
        status: "AVAILABLE" as ApiProperty["status"],
        image_urls: imageKeys,
        primary_image: imageKeys[0] || "",
      };
      const res = await api.post<ApiProperty>("/admin/properties", payload);
      setProperties((prev) => [res.data, ...prev]);
      toast.success("Property created successfully");

      // Clear everything
      reset();
      setFiles([]);
      previews.forEach((p) => URL.revokeObjectURL(p.url));
    } catch (err: unknown) {
      console.error(err);
      toast.error(getErrorMessage(err, "Failed to create property"));
    } finally {
      setIsSubmitting(false);
      setUploadProgress(null);
    }
  };

  /* =======================
     Load Properties
  ======================= */

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchAdminProperties({ page: 1, page_size: 50 });
        setProperties(data.properties ?? []);
      } catch (error) {
        console.error("Failed to fetch properties:", error);
        toast.error("Failed to load properties");
      } finally {
        setLoadingProperties(false);
      }
    };
    load();
  }, []);

  const handleDelete = (propertyId: number) => {
    setDeleteTargetIds([propertyId]);
  };

  const handleCancelDelete = () => {
    setDeleteTargetIds([]);
  };

  const handleBulkDelete = () => {
    if (properties.length === 0) return;
    setDeleteTargetIds(properties.map((item) => item.id));
  };

  const handleConfirmDelete = async () => {
    if (deleteTargetIds.length === 0) return;
    try {
      setIsDeleting(true);
      if (deleteTargetIds.length === 1) {
        await deleteAdminProperty(deleteTargetIds[0]);
        setProperties((prev) => prev.filter((item) => item.id !== deleteTargetIds[0]));
        setSelectedPropertyIds((prev) => prev.filter((id) => id !== deleteTargetIds[0]));
        toast.success("Property deleted");
      } else {
        const result = await deleteAdminPropertiesBulk(deleteTargetIds);
        setProperties((prev) => prev.filter((item) => !deleteTargetIds.includes(item.id)));
        setSelectedPropertyIds([]);
        toast.success(`Deleted ${result.deleted_count} properties`);
        if (result.missing_ids.length > 0) {
          toast.error(`Missing properties: ${result.missing_ids.join(", ")}`);
        }
      }
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to delete property"));
    } finally {
      setIsDeleting(false);
      setDeleteTargetIds([]);
    }
  };

  const togglePropertySelection = (id: number) => {
    setSelectedPropertyIds((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]
    );
  };

  const allPropertiesSelected =
    properties.length > 0 && properties.every((item) => selectedPropertyIds.includes(item.id));
  const somePropertiesSelected =
    properties.some((item) => selectedPropertyIds.includes(item.id)) && !allPropertiesSelected;

  const togglePropertySelectAll = () => {
    if (allPropertiesSelected) {
      setSelectedPropertyIds([]);
      return;
    }
    setSelectedPropertyIds(properties.map((item) => item.id));
  };

  /* =======================
     UI
  ======================= */

  return (
    <div className="flex flex-col gap-4">
      <Toaster position="top-center" />
      <h2 className="text-xl font-bold text-blue-900">Upload New Property</h2>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="grid md:grid-cols-2 gap-4 p-6 border rounded-xl bg-white"
      >
        {/* We loop through the schema shape keys to generate inputs */}
        {(Object.keys(propertySchema.shape) as Array<keyof PropertyFormValues>).map((key) => {
          const isNumber =
            key !== "title" &&
            key !== "location" &&
            key !== "description" &&
            key !== "is_off_plan";
          
          return (
            <div key={key} className="flex flex-col gap-1">
              <label className="text-sm font-medium capitalize">
                {key.replace("_", " ")}
              </label>
              {key === "description" ? (
                <textarea
                  {...register(key)}
                  className="bg-gray-100 rounded-lg p-2 min-h-[80px]"
                />
              ) : key === "is_off_plan" ? (
                <label className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" {...register(key)} />
                  Off-plan property
                </label>
              ) : (
                <input
                  type={isNumber ? "number" : "text"}
                  step="any"
                  {...register(key)}
                  className="bg-gray-100 rounded-lg p-2"
                />
              )}
              {errors[key] && (
                <p className="text-red-500 text-sm">{errors[key]?.message}</p>
              )}
            </div>
          );
        })}

        {/* Image Upload Section UI */}
        <div className="col-span-2 border rounded-lg p-4">
          <input
            ref={fileInputRef}
            type="file"
            hidden
            multiple
            accept={ALLOWED_TYPES.join(",")}
            onChange={handleFileChange}
          />

          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2"
              disabled={isSubmitting}
            >
              <FiUpload /> Upload
            </button>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-3">
            {previews.map((preview, index) => (
              <div
                key={preview.url}
                className="relative group rounded overflow-hidden"
              >
                {preview.file.type.startsWith("video") ? (
                  <video
                    src={preview.url}
                    className="w-full h-24 object-cover rounded"
                    muted
                  />
                ) : (
                  <img
                    src={preview.url}
                    className="w-full h-24 object-cover rounded"
                    alt={`Preview ${index + 1}`}
                  />
                )}

                {/* ❌ Remove button */}
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  className="absolute top-1 right-1 bg-black/70 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

        {uploadProgress && (
          <div className="col-span-2 rounded-lg border border-blue-100 bg-blue-50/60 p-4">
            <div className="flex items-center justify-between text-sm text-blue-900">
              <span className="font-semibold">Uploading media</span>
              <span>
                {uploadProgress.totalBytes > 0
                  ? Math.round(
                      (uploadProgress.uploadedBytes / uploadProgress.totalBytes) * 100
                    )
                  : 0}
                %
              </span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded bg-blue-100">
              <div
                className="h-full bg-blue-600 transition-all"
                style={{
                  width: `${
                    uploadProgress.totalBytes > 0
                      ? Math.round(
                          (uploadProgress.uploadedBytes / uploadProgress.totalBytes) * 100
                        )
                      : 0
                  }%`,
                }}
              />
            </div>
            {uploadProgress.currentFileName && (
              <p className="mt-2 text-xs text-blue-900/80 truncate">
                Current: {uploadProgress.currentFileName}
              </p>
            )}
            <div className="mt-3 space-y-1">
              {files.map((file) => {
                const key = getFileKey(file);
                const percent = uploadProgress.fileProgress[key] ?? 0;
                return (
                  <div key={key} className="flex items-center justify-between text-xs text-blue-900/80">
                    <span className="truncate">{file.name}</span>
                    <span>{percent}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="col-span-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-blue-900 text-white px-6 py-2 rounded-lg font-medium disabled:bg-gray-400"
          >
            {isSubmitting ? "Creating..." : "Create Property"}
          </button>
        </div>
      </form>

      {/* Type assertion for PropertyTable to handle the type mismatch */}
      <PropertyTable 
        properties={properties} 
        loading={loadingProperties || isDeleting} 
        onDelete={handleDelete}
        selectedIds={selectedPropertyIds}
        allSelected={allPropertiesSelected}
        someSelected={somePropertiesSelected}
        onToggleSelect={togglePropertySelection}
        onToggleSelectAll={togglePropertySelectAll}
      />

      {selectedPropertyIds.length > 0 && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleBulkDelete}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
            disabled={isDeleting}
          >
            Delete selected ({selectedPropertyIds.length})
          </button>
        </div>
      )}

      {deleteTargetIds.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-blue-900">
                {deleteTargetIds.length > 1 ? "Delete properties" : "Delete property"}
              </h3>
              <p className="mt-2 text-sm text-gray-600">
                {deleteTargetIds.length > 1
                  ? `Are you sure you want to delete ${deleteTargetIds.length} properties? This action cannot be undone.`
                  : "Are you sure you want to delete this property? This action cannot be undone."}
              </p>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCancelDelete}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
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
    </div>
  );
};

export default AdminInvestmentsPage;