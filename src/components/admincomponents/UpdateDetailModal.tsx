import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { fetchAdminUpdateDetail } from "../../api/admin.updates";
import type { AdminUpdateDetailResponse, UpdateComment, UpdateItem } from "../../types/updates";
import { getErrorMessage } from "../../util/getErrorMessage";
import { isVideoUrl, normalizeMediaUrl } from "../../util/normalizeMediaUrl";

interface UpdateDetailModalProps {
  isOpen: boolean;
  updateId: number | null;
  onClose: () => void;
}

const DEFAULT_PAGE_SIZE = 50;

export const UpdateDetailModal = ({ isOpen, updateId, onClose }: UpdateDetailModalProps) => {
  const [loading, setLoading] = useState(false);
  const [update, setUpdate] = useState<UpdateItem | null>(null);
  const [comments, setComments] = useState<UpdateComment[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(0);

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
        const resolvedComments =
          Array.isArray(res.comments)
            ? res.comments
            : Array.isArray((res as any)?.comments?.comments)
              ? (res as any).comments.comments
              : Array.isArray((res as any)?.comments?.data)
                ? (res as any).comments.data
                : Array.isArray((res as any)?.update?.comments)
                  ? (res as any).update.comments
                  : [];
        const resolvedTotal =
          typeof res.total === "number"
            ? res.total
            : typeof (res as any)?.comments?.total === "number"
              ? (res as any).comments.total
              : resolvedComments.length;
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
    }
  }, [isOpen]);

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
                  <h5 className="font-semibold text-gray-900">Comments</h5>
                  <span className="text-xs text-gray-500">
                    {total > 0 ? `${total} total` : "No comments"}
                  </span>
                </div>

                {comments.length === 0 ? (
                  <p className="text-sm text-gray-500">No comments yet.</p>
                ) : (
                  <div className="space-y-3">
                    {(Array.isArray(comments) ? comments : []).map((comment) => (
                      <div key={comment.id} className="border border-gray-200 rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-gray-900">{comment.user_name}</p>
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
    </div>
  );
};
