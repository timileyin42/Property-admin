import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast, { Toaster } from "react-hot-toast";

import { ApiProperty } from "../../types/property";
import { StatusBadge } from "../../components/StatusBadge";
import { isVideoUrl } from "../../util/normalizeMediaUrl";
import {
  deleteAdminPropertiesBulk,
  deleteAdminProperty,
  fetchAdminProperties,
  PropertyStatusFilter,
} from "../../api/admin.properties";
import { UpdatePropertyModal } from "../../components/admincomponents/UpdatePropertyModal";
import { getErrorMessage } from "../../util/getErrorMessage";
import { usePresignedMediaUrls } from "../../hooks/usePresignedMediaUrls";

const STATUS_TABS: Array<"ALL" | PropertyStatusFilter> = [
  "ALL",
  "AVAILABLE",
  "SOLD",
];

const AdminProperties = () => {
  const [properties, setProperties] = useState<ApiProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState<"ALL" | PropertyStatusFilter>("ALL");
  const [selectedProperty, setSelectedProperty] = useState<ApiProperty | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<number[]>([]);
  const selectAllRef = useRef<HTMLInputElement | null>(null);

  const loadProperties = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchAdminProperties({
        page: 1,
        page_size: 50,
        status: activeStatus === "ALL" ? undefined : activeStatus,
      });
      setProperties(response.properties ?? []);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to load properties"));
    } finally {
      setLoading(false);
    }
  }, [activeStatus]);

  useEffect(() => {
    loadProperties();
  }, [loadProperties]);

  const handleOpenModal = (property: ApiProperty) => {
    setSelectedProperty(property);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedProperty(null);
  };

  const handleUpdate = (updated: ApiProperty) => {
    setProperties((prev) =>
      prev.map((item) => (item.id === updated.id ? updated : item))
    );
  };

  const handleDelete = (deletedId: number) => {
    setProperties((prev) => prev.filter((item) => item.id !== deletedId));
  };

  const handleDeleteOpen = (propertyId: number) => {
    setDeleteTargetId(propertyId);
    setOpenMenuId(null);
  };

  const handleDeleteCancel = () => {
    setDeleteTargetId(null);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTargetId) return;
    try {
      setIsDeleting(true);
      await deleteAdminProperty(deleteTargetId);
      handleDelete(deleteTargetId);
      toast.success("Property deleted");
      await loadProperties();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to delete property"));
    } finally {
      setIsDeleting(false);
      setDeleteTargetId(null);
    }
  };

  const rows = useMemo(() => properties, [properties]);
  const allMediaRefs = useMemo(
    () =>
      rows.flatMap((property) =>
        [property.primary_image, ...(property.image_urls ?? [])].filter(Boolean) as string[]
      ),
    [rows]
  );
  const resolvedMedia = usePresignedMediaUrls(allMediaRefs);
  const resolvedMap = useMemo(
    () => new Map(resolvedMedia.map((item) => [item.raw, item.url])),
    [resolvedMedia]
  );

  const allSelected = rows.length > 0 && rows.every((item) => selectedPropertyIds.includes(item.id));
  const someSelected = rows.some((item) => selectedPropertyIds.includes(item.id)) && !allSelected;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected && !allSelected;
    }
  }, [someSelected, allSelected]);

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedPropertyIds([]);
      return;
    }
    setSelectedPropertyIds(rows.map((item) => item.id));
  };

  const toggleSelect = (id: number) => {
    setSelectedPropertyIds((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    if (selectedPropertyIds.length === 0) return;
    try {
      setIsDeleting(true);
      const result = await deleteAdminPropertiesBulk(selectedPropertyIds);
      setProperties((prev) => prev.filter((item) => !selectedPropertyIds.includes(item.id)));
      setSelectedPropertyIds([]);
      toast.success(`Deleted ${result.deleted_count} properties`);
      if (result.missing_ids.length > 0) {
        toast.error(`Missing properties: ${result.missing_ids.join(", ")}`);
      }
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to delete properties"));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl p-6">
      <Toaster position="top-right" />

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg font-semibold">Properties</h2>
          <p className="text-sm text-gray-500">
            View and update all uploaded properties
          </p>
        </div>
        {selectedPropertyIds.length > 0 && (
          <button
            type="button"
            onClick={handleBulkDelete}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
            disabled={isDeleting}
          >
            Delete selected ({selectedPropertyIds.length})
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveStatus(tab)}
            className={`px-4 py-2 text-sm rounded-lg border transition ${
              activeStatus === tab
                ? "bg-blue-900 text-white border-blue-900"
                : "border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {tab === "ALL" ? "All Status" : tab}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-sm text-gray-500">Loading properties...</div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-gray-500">No properties found.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left p-4">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    aria-label="Select all"
                  />
                </th>
                <th className="text-left p-4">Property</th>
                <th className="text-left p-4">Status</th>
                <th className="text-left p-4">Location</th>
                <th className="text-right p-4">Total Value</th>
                <th className="text-right p-4">Fractions</th>
                <th className="text-right p-4">Updated</th>
                <th className="text-right p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((property) => {
                const mediaUrls = [
                  property.primary_image,
                  ...(property.image_urls ?? []),
                ]
                  .map((url) => resolvedMap.get(url ?? "") ?? url)
                  .filter(Boolean) as string[];
                const imageUrl = mediaUrls.find((url) => !isVideoUrl(url));
                const videoUrl = mediaUrls.find((url) => isVideoUrl(url));

                return (
                  <tr
                    key={property.id}
                    className="border-b last:border-b-0"
                  >
                    <td className="p-4">
                      <input
                        type="checkbox"
                        checked={selectedPropertyIds.includes(property.id)}
                        onChange={() => toggleSelect(property.id)}
                        aria-label={`Select ${property.title}`}
                      />
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-16 rounded-md overflow-hidden bg-gray-100 flex items-center justify-center">
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={property.title}
                              className="h-full w-full object-cover"
                            />
                          ) : videoUrl ? (
                            <video
                              className="h-full w-full object-cover"
                              src={videoUrl}
                              muted
                              playsInline
                              loop
                              autoPlay
                            />
                          ) : (
                            <span className="text-xs text-gray-400">No media</span>
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {property.title}
                          </p>
                          <p className="text-xs text-gray-500">
                            ID {property.id}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <StatusBadge status={property.status} />
                    </td>
                    <td className="p-4 text-gray-600">{property.location}</td>
                    <td className="p-4 text-right text-gray-600">
                      ₦{property.project_value?.toLocaleString() ?? "-"}
                    </td>
                    <td className="p-4 text-right text-gray-600">
                      {property.total_fractions ?? "-"}
                    </td>
                    <td className="p-4 text-right text-gray-600">
                      {property.updated_at
                        ? new Date(property.updated_at).toLocaleDateString()
                        : "-"}
                    </td>
                    <td className="p-4 text-right">
                      <div className="relative inline-block text-left">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenMenuId((prev) => (prev === property.id ? null : property.id))
                          }
                          className="px-2 text-xl font-bold text-gray-700"
                          aria-label="Property actions"
                        >
                          ⋮
                        </button>
                        {openMenuId === property.id && (
                          <div className="absolute right-0 mt-2 w-36 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                            <button
                              type="button"
                              onClick={() => {
                                handleOpenModal(property);
                                setOpenMenuId(null);
                              }}
                              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteOpen(property.id)}
                              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-50"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <UpdatePropertyModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        property={selectedProperty}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />

      {deleteTargetId !== null && (
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
    </div>
  );
};

export default AdminProperties;
