import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { fetchUpdates } from "../../api/updates";
import { deleteAdminUpdate, deleteAdminUpdatesBulk } from "../../api/admin.updates";
import type { UpdateItem } from "../../types/updates";
import UpdateNewsModal from "../../components/admincomponents/UpdateNewsModal";
import { UpdateDetailModal } from "../../components/admincomponents/UpdateDetailModal";
import { isVideoUrl, normalizeMediaUrl } from "../../util/normalizeMediaUrl";
import { getErrorMessage } from "../../util/getErrorMessage";

const AdminUpdates = () => {
  const [updates, setUpdates] = useState<UpdateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUpdate, setSelectedUpdate] = useState<UpdateItem | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailUpdateId, setDetailUpdateId] = useState<number | null>(null);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [deleteTargetIds, setDeleteTargetIds] = useState<number[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedUpdateIds, setSelectedUpdateIds] = useState<number[]>([]);
  const selectAllRef = useRef<HTMLInputElement | null>(null);

  const loadUpdates = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetchUpdates({ page: 1, page_size: 50 });
      setUpdates(res.updates ?? []);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to load updates"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUpdates();
  }, [loadUpdates]);

  const handleOpen = (update?: UpdateItem) => {
    setSelectedUpdate(update ?? null);
    setIsModalOpen(true);
  };

  const handleClose = () => {
    setIsModalOpen(false);
    setSelectedUpdate(null);
  };

  const handleDeleteOpen = (updateId: number) => {
    setDeleteTargetIds([updateId]);
    setOpenMenuId(null);
  };

  const handleDeleteCancel = () => {
    setDeleteTargetIds([]);
  };

  const handleBulkDeleteOpen = () => {
    if (selectedUpdateIds.length === 0) return;
    setDeleteTargetIds(selectedUpdateIds);
    setOpenMenuId(null);
  };

  const handleDeleteConfirm = async () => {
    if (deleteTargetIds.length === 0) return;
    try {
      setIsDeleting(true);
      if (deleteTargetIds.length === 1) {
        await deleteAdminUpdate(deleteTargetIds[0]);
        setUpdates((prev) => prev.filter((item) => item.id !== deleteTargetIds[0]));
        setSelectedUpdateIds((prev) => prev.filter((id) => id !== deleteTargetIds[0]));
        toast.success("Update deleted");
      } else {
        const result = await deleteAdminUpdatesBulk(deleteTargetIds);
        setUpdates((prev) => prev.filter((item) => !deleteTargetIds.includes(item.id)));
        setSelectedUpdateIds([]);
        toast.success(`Deleted ${result.deleted_count} updates`);
        if (result.missing_ids.length > 0) {
          toast.error(`Missing updates: ${result.missing_ids.join(", ")}`);
        }
      }
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to delete update"));
    } finally {
      setIsDeleting(false);
      setDeleteTargetIds([]);
    }
  };

  const handleOpenDetail = (updateId: number) => {
    setDetailUpdateId(updateId);
    setIsDetailOpen(true);
  };

  const handleCloseDetail = () => {
    setIsDetailOpen(false);
    setDetailUpdateId(null);
  };

  const handleSuccess = (item: UpdateItem) => {
    setUpdates((prev) => {
      const exists = prev.find((entry) => entry.id === item.id);
      if (exists) {
        return prev.map((entry) => (entry.id === item.id ? item : entry));
      }
      return [item, ...prev];
    });
  };

  const rows = useMemo(() => updates, [updates]);

  const allSelected = rows.length > 0 && rows.every((item) => selectedUpdateIds.includes(item.id));
  const someSelected = rows.some((item) => selectedUpdateIds.includes(item.id)) && !allSelected;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected && !allSelected;
    }
  }, [someSelected, allSelected]);

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedUpdateIds([]);
      return;
    }
    setSelectedUpdateIds(rows.map((item) => item.id));
  };

  const toggleSelect = (id: number) => {
    setSelectedUpdateIds((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]
    );
  };

  return (
    <div className="bg-white rounded-xl p-6">
      <Toaster position="top-right" />
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg font-semibold">Project Updates</h2>
          <p className="text-sm text-gray-500">
            Create and manage updates for your investors
          </p>
        </div>
        <div className="flex items-center gap-3">
          {selectedUpdateIds.length > 0 && (
            <button
              type="button"
              onClick={handleBulkDeleteOpen}
              className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
              disabled={isDeleting}
            >
              Delete selected ({selectedUpdateIds.length})
            </button>
          )}
          <button
            onClick={() => handleOpen()}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg"
          >
            Create Update
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-gray-500">Loading updates...</div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-gray-500">No updates yet.</div>
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
                <th className="text-left p-4">Update</th>
                <th className="text-left p-4">Created</th>
                <th className="text-right p-4">Likes</th>
                <th className="text-right p-4">Comments</th>
                <th className="text-right p-4">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((update) => {
                const urls = [
                  ...(update.media_files?.map((item) => item.url) ?? []),
                  ...(update.media_urls ?? []),
                  ...(update.image_urls ?? []),
                  update.image_url,
                  update.video_url,
                ].filter(Boolean) as string[];
                const normalized = urls
                  .map((url) => normalizeMediaUrl(url))
                  .filter(Boolean) as string[];
                const imageUrl = normalized.find((url) => !isVideoUrl(url));
                const videoUrl = normalized.find((url) => isVideoUrl(url));

                return (
                  <tr key={update.id} className="border-b last:border-b-0">
                    <td className="p-4">
                      <input
                        type="checkbox"
                        checked={selectedUpdateIds.includes(update.id)}
                        onChange={() => toggleSelect(update.id)}
                        aria-label={`Select ${update.title}`}
                      />
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => handleOpenDetail(update.id)}
                          className="h-12 w-16 rounded-md overflow-hidden bg-gray-100 flex items-center justify-center focus:outline-none"
                          title="View update details"
                        >
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={update.title}
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
                        </button>
                        <div>
                          <p className="font-medium text-gray-900">
                            {update.title}
                          </p>
                          <p className="text-xs text-gray-500 line-clamp-1">
                            {update.content}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-gray-500">
                      {new Date(update.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-right text-gray-500">
                      {update.likes_count ?? 0}
                    </td>
                    <td className="p-4 text-right text-gray-500">
                      {update.comments_count ?? 0}
                    </td>
                    <td className="p-4 text-right">
                      <div className="relative inline-block text-left">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenMenuId((prev) => (prev === update.id ? null : update.id))
                          }
                          className="px-2 text-xl font-bold text-gray-700"
                          aria-label="Update actions"
                        >
                          ⋮
                        </button>
                        {openMenuId === update.id && (
                          <div className="absolute right-0 mt-2 w-36 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                            <button
                              type="button"
                              onClick={() => {
                                handleOpen(update);
                                setOpenMenuId(null);
                              }}
                              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteOpen(update.id)}
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

      <UpdateNewsModal
        isOpen={isModalOpen}
        onClose={handleClose}
        update={selectedUpdate}
        onSuccess={handleSuccess}
      />

      <UpdateDetailModal
        isOpen={isDetailOpen}
        updateId={detailUpdateId}
        onClose={handleCloseDetail}
      />

      {deleteTargetIds.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-blue-900">
                {deleteTargetIds.length > 1 ? "Delete updates" : "Delete update"}
              </h3>
              <p className="mt-2 text-sm text-gray-600">
                {deleteTargetIds.length > 1
                  ? `Are you sure you want to delete ${deleteTargetIds.length} updates? This action cannot be undone.`
                  : "Are you sure you want to delete this update? This action cannot be undone."}
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

export default AdminUpdates;
