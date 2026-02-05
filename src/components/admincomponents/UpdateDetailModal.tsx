import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { fetchAdminUpdateDetail } from "../../api/admin.updates";
import { deleteAdminUpdateCommentsBulk } from "../../api/updates";
import type { AdminUpdateDetailResponse, UpdateComment, UpdateItem } from "../../types/updates";
import { getErrorMessage } from "../../util/getErrorMessage";
import { isVideoUrl, normalizeMediaUrl } from "../../util/normalizeMediaUrl";

interface UpdateDetailModalProps {
  isOpen: boolean;
  updateId: number | null;
  onClose: () => void;
}

const DEFAULT_PAGE_SIZE = 50;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isUpdateCommentArray = (value: unknown): value is UpdateComment[] =>
  Array.isArray(value);

const readNumber = (value: unknown): number | undefined =>
  typeof value === "number" ? value : undefined;

const resolveComments = (response: unknown): { comments: UpdateComment[]; total: number } => {
  if (!isRecord(response)) {
    return { comments: [], total: 0 };
  }

  const directComments = response.comments;
  if (isUpdateCommentArray(directComments)) {
    return {
      comments: directComments,
      total: readNumber(response.total) ?? directComments.length,
    };
  }

  if (isRecord(directComments)) {
    const nestedComments = isUpdateCommentArray(directComments.comments)
      ? directComments.comments
      : isUpdateCommentArray(directComments.data)
        ? directComments.data
        : [];
    return {
      comments: nestedComments,
      total:
        readNumber(response.total) ?? readNumber(directComments.total) ?? nestedComments.length,
    };
  }

  const updateValue = response.update;
  if (isRecord(updateValue) && isUpdateCommentArray(updateValue.comments)) {
    const fallbackComments = updateValue.comments;
    return {
      comments: fallbackComments,
      total: readNumber(response.total) ?? fallbackComments.length,
    };
  }

  return { comments: [], total: 0 };
};

export const UpdateDetailModal = ({ isOpen, updateId, onClose }: UpdateDetailModalProps) => {
  const [loading, setLoading] = useState(false);
  const [update, setUpdate] = useState<UpdateItem | null>(null);
  const [comments, setComments] = useState<UpdateComment[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const [selectedCommentIds, setSelectedCommentIds] = useState<number[]>([]);
  const [deleteTargetIds, setDeleteTargetIds] = useState<number[]>([]);
  const [isDeletingComments, setIsDeletingComments] = useState(false);

  useEffect(() => {
    if (!isOpen || !updateId) return;

    const load = async () => {
      try {
        setLoading(true);
        const res: AdminUpdateDetailResponse = await fetchAdminUpdateDetail(updateId, {
          page,
          page_size: pageSize,
        });
        setUpdate(res.update);
        const { comments: resolvedComments, total: resolvedTotal } = resolveComments(res);
        setComments(resolvedComments);
        setTotal(resolvedTotal);
      } catch (error: unknown) {
        toast.error(getErrorMessage(error, "Failed to load update details"));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [isOpen, updateId, page, pageSize]);

  useEffect(() => {
    if (!isOpen) {
      setUpdate(null);
      setComments([]);
      setTotal(0);
      setPage(1);
      setSelectedCommentIds([]);
      setDeleteTargetIds([]);
      setIsDeletingComments(false);
    }
  }, [isOpen]);

  const allCommentsSelected =
    comments.length > 0 && comments.every((comment) => selectedCommentIds.includes(comment.id));
  const someCommentsSelected =
    comments.some((comment) => selectedCommentIds.includes(comment.id)) && !allCommentsSelected;

  const toggleCommentSelection = (id: number) => {
    setSelectedCommentIds((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]
    );
  };

  const toggleCommentSelectAll = () => {
    if (allCommentsSelected) {
      setSelectedCommentIds([]);
      return;
    }
    setSelectedCommentIds(comments.map((comment) => comment.id));
  };

  const handleBulkDeleteComments = () => {
    if (selectedCommentIds.length === 0) return;
    setDeleteTargetIds(selectedCommentIds);
  };

  const handleCancelDeleteComments = () => {
    setDeleteTargetIds([]);
  };

  const handleConfirmDeleteComments = async () => {
    if (deleteTargetIds.length === 0) return;
    try {
      setIsDeletingComments(true);
      const result = await deleteAdminUpdateCommentsBulk(deleteTargetIds);
      setComments((prev) => prev.filter((comment) => !deleteTargetIds.includes(comment.id)));
      setSelectedCommentIds([]);
      setDeleteTargetIds([]);
      setTotal((prev) => Math.max(prev - result.deleted_count, 0));
      toast.success(`Deleted ${result.deleted_count} comments`);
      if (result.missing_ids.length > 0) {
        toast.error(`Missing comments: ${result.missing_ids.join(", ")}`);
      }
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to delete comments"));
    } finally {
      setIsDeletingComments(false);
    }
  };

  const mediaUrls = useMemo(() => {
    if (!update) return [] as string[];
    const urls = [
      ...(update.media_files?.map((item) => item.url) ?? []),
      ...(update.media_urls ?? []),
      ...(update.image_urls ?? []),
      update.image_url,
      update.video_url,
    ].filter(Boolean) as string[];
    return urls
      .map((url) => normalizeMediaUrl(url))
      .filter(Boolean) as string[];
  }, [update]);

  const imageUrl = mediaUrls.find((url) => !isVideoUrl(url));
  const videoUrl = mediaUrls.find((url) => isVideoUrl(url));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Update Details</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-xl"
              disabled={loading}
            >
              ✕
            </button>
          </div>

          {loading ? (
            <p className="text-sm text-gray-500">Loading update...</p>
          ) : !update ? (
            <p className="text-sm text-gray-500">Update not found.</p>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="h-40 w-full md:w-56 rounded-md overflow-hidden bg-gray-100 flex items-center justify-center">
                  {imageUrl ? (
                    <img src={imageUrl} alt={update.title} className="h-full w-full object-cover" />
                  ) : videoUrl ? (
                    <video className="h-full w-full object-cover" src={videoUrl} muted playsInline loop autoPlay />
                  ) : (
                    <span className="text-xs text-gray-400">No media</span>
                  )}
                </div>
                <div className="flex-1">
                  <h4 className="text-lg font-semibold text-gray-900">{update.title}</h4>
                  <p className="text-sm text-gray-500 mt-1">
                    {new Date(update.created_at).toLocaleDateString()}
                  </p>
                  <p className="text-sm text-gray-700 mt-4 whitespace-pre-line">
                    {update.content}
                  </p>
                  <div className="flex items-center gap-6 text-sm text-gray-500 mt-4">
                    <span>Likes: {update.likes_count ?? 0}</span>
                    <span>Comments: {update.comments_count ?? 0}</span>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={allCommentsSelected}
                      onChange={toggleCommentSelectAll}
                      aria-label="Select all comments"
                      ref={(node) => {
                        if (node) {
                          node.indeterminate = someCommentsSelected && !allCommentsSelected;
                        }
                      }}
                    />
                    <h5 className="font-semibold text-gray-900">Comments</h5>
                  </div>
                  <div className="flex items-center gap-3">
                    {selectedCommentIds.length > 0 && (
                      <button
                        type="button"
                        onClick={handleBulkDeleteComments}
                        className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-md hover:bg-red-700"
                        disabled={isDeletingComments}
                      >
                        Delete selected ({selectedCommentIds.length})
                      </button>
                    )}
                    <span className="text-xs text-gray-500">
                      {total > 0 ? `${total} total` : "No comments"}
                    </span>
                  </div>
                </div>

                {comments.length === 0 ? (
                  <p className="text-sm text-gray-500">No comments yet.</p>
                ) : (
                  <div className="space-y-3">
                    {(Array.isArray(comments) ? comments : []).map((comment) => (
                      <div key={comment.id} className="border border-gray-200 rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={selectedCommentIds.includes(comment.id)}
                              onChange={() => toggleCommentSelection(comment.id)}
                              aria-label={`Select comment by ${comment.user_name}`}
                            />
                            <p className="text-sm font-medium text-gray-900">{comment.user_name}</p>
                          </div>
                          <span className="text-xs text-gray-400">
                            {new Date(comment.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{comment.content}</p>
                      </div>
                    ))}
                  </div>
                )}

                {total > page * pageSize && (
                  <div className="flex justify-end mt-4">
                    <button
                      type="button"
                      onClick={() => setPage((prev) => prev + 1)}
                      className="px-3 py-1.5 text-sm border border-gray-200 rounded-md hover:bg-gray-50"
                      disabled={loading}
                    >
                      Load more
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {deleteTargetIds.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-blue-900">Delete comments</h3>
              <p className="mt-2 text-sm text-gray-600">
                Are you sure you want to delete {deleteTargetIds.length} comments? This action cannot be undone.
              </p>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCancelDeleteComments}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                  disabled={isDeletingComments}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteComments}
                  className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                  disabled={isDeletingComments}
                >
                  {isDeletingComments ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
