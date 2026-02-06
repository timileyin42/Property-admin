import { useEffect, useMemo, useRef, useState } from "react";
import { Resolver, useForm, SubmitHandler } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import toast, { Toaster } from "react-hot-toast";
import { FiUpload } from "react-icons/fi";

import { api } from "../../api/axios";
import {
  fetchAdminProperties,
  deleteAdminPropertiesBulk,
  deleteAdminProperty,
  updateAdminProperty,
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
  bedrooms: optionalNumber,
  bathrooms: optionalNumber,
  area_sqft: optionalNumber,
  expected_roi: optionalNumber,
  is_off_plan: z.boolean().optional(),
  off_plan_duration_months: optionalNumber,
});

type PropertyFormValues = z.infer<typeof propertySchema>;

type UploadSignature = {
  upload_url: string;
  api_key: string;
  timestamp: number;
  signature: string;
  folder: string;
  resource_type: string;
  allowed_formats?: string;
  chunk_size?: number;
};

/* =======================
   Constants
======================= */

const MAX_IMAGE_SIZE = 100 * 1024 * 1024;
const MAX_VIDEO_SIZE = 500 * 1024 * 1024;
const CHUNK_SIZE = 6 * 1024 * 1024;
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

/* =======================
   Component
======================= */

const AdminInvestmentsPage: React.FC = () => {
  const [properties, setProperties] = useState<ApiProperty[]>([]);
  const [loadingProperties, setLoadingProperties] = useState(true);
  const [files, setFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
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
      bedrooms: undefined,
      bathrooms: undefined,
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
     Upload to Cloudinary
  ======================= */

  const uploadImages = async (
    propertyId?: number
  ): Promise<string[]> => {
    const token = localStorage.getItem("token");
    if (!token) {
      throw new Error("Unauthorized");
    }

    const uploadedUrls: string[] = [];

    const uploadVideoInChunks = async (
      file: File,
      sig: UploadSignature
    ): Promise<string> => {
      const totalSize = file.size;
      let start = 0;
      let end = Math.min(CHUNK_SIZE, totalSize);
      const uploadId = `${file.name}-${Date.now()}`;
      let secureUrl = "";

      while (start < totalSize) {
        const chunk = file.slice(start, end);
        const formData = new FormData();
        formData.append("file", chunk);
        formData.append("api_key", sig.api_key);
        formData.append("timestamp", String(sig.timestamp));
        formData.append("signature", sig.signature);
        formData.append("folder", sig.folder);
        formData.append("resource_type", sig.resource_type);

        if (sig.allowed_formats) {
          formData.append("allowed_formats", sig.allowed_formats);
        }

        const uploadRes = await axios.post(sig.upload_url, formData, {
          headers: {
            "Content-Range": `bytes ${start}-${end - 1}/${totalSize}`,
            "X-Unique-Upload-Id": uploadId,
          },
        });

        if (uploadRes.data?.secure_url) {
          secureUrl = uploadRes.data.secure_url;
        }

        start = end;
        end = Math.min(start + CHUNK_SIZE, totalSize);
      }

      if (!secureUrl) {
        throw new Error("Cloudinary upload failed");
      }

      return secureUrl;
    };

    for (const file of files) {
      const resourceType = file.type.startsWith("video") ? "video" : "image";
      const payload = {
        resource_type: resourceType,
        file_size_bytes: file.size,
        ...(propertyId !== undefined && { property_id: propertyId }),
      };

      // 1️⃣ Get upload signature
      const { data: sig } = await api.post(
        "/media/upload-signature",
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      // 2️⃣ Upload to Cloudinary
      const isVideo = file.type.startsWith("video");
      const shouldChunk = isVideo && file.size > MAX_IMAGE_SIZE;

      if (shouldChunk) {
        const secureUrl = await uploadVideoInChunks(file, sig);
        uploadedUrls.push(secureUrl);
        continue;
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("api_key", sig.api_key);
      formData.append("timestamp", String(sig.timestamp));
      formData.append("signature", sig.signature);
      formData.append("folder", sig.folder);
      formData.append("resource_type", sig.resource_type);

      if (sig.allowed_formats) {
        formData.append("allowed_formats", sig.allowed_formats);
      }

      const uploadRes = await axios.post(sig.upload_url, formData);

      if (!uploadRes.data?.secure_url) {
        throw new Error("Cloudinary upload failed");
      }

      uploadedUrls.push(uploadRes.data.secure_url);
    }

    return uploadedUrls;
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

    const uploadPromise = uploadImages();

    try {
      const payload = {
        ...data,
        off_plan_duration_months: data.off_plan_duration_months ?? null,
        status: "AVAILABLE" as ApiProperty["status"],
        image_urls: [] as string[],
        primary_image: "",
      };

      let res: { data: ApiProperty } | null = null;

      try {
        res = await api.post<ApiProperty>("/admin/properties", payload);
      } catch (createError: unknown) {
        // Fallback to blocking upload if server requires images on create
        const imageUrls = await uploadPromise;
        const retryPayload = {
          ...data,
          off_plan_duration_months: data.off_plan_duration_months ?? null,
          status: "AVAILABLE" as ApiProperty["status"],
          image_urls: imageUrls,
          primary_image: imageUrls[0] || "",
        };
        res = await api.post<ApiProperty>("/admin/properties", retryPayload);
      }

      if (res) {
        setProperties((prev) => [res!.data, ...prev]);
        toast.success("Property created successfully");

        uploadPromise
          .then((imageUrls) => {
            if (!imageUrls.length) return null;
            return updateAdminProperty(res!.data.id, {
              image_urls: imageUrls,
              primary_image: imageUrls[0],
            });
          })
          .then((updated) => {
            if (!updated) return;
            setProperties((prev) =>
              prev.map((property) =>
                property.id === updated.id ? updated : property
              )
            );
          })
          .catch((error) => {
            console.error(error);
            toast.error("Background media upload failed");
          });

        // Clear everything
        reset();
        setFiles([]);
        previews.forEach((p) => URL.revokeObjectURL(p.url));
      }
    } catch (err: unknown) {
      console.error(err);
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        toast.error("Please login as admin to upload media");
        return;
      }
      toast.error(getErrorMessage(err, "Failed to create property"));
    } finally {
      setIsSubmitting(false);
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