import axios from "axios";
import { api } from "./axios";
import type { AdminUpdateDetailResponse, UpdateItem } from "../types/updates";
import { fetchUpdateDetail, fetchAdminUpdateComments } from "./updates";

export interface AdminUpdatePayload {
  property_id?: number | null;
  title: string;
  content: string;
  media_files?: Array<{
    media_type: "image" | "video";
    url: string;
  }>;
  image_url?: string;
  video_url?: string;
}

export const createAdminUpdate = async (payload: AdminUpdatePayload) => {
  const res = await api.post<UpdateItem>("/admin/updates", payload);
  return res.data;
};

export const updateAdminUpdate = async (updateId: number, payload: AdminUpdatePayload) => {
  const res = await api.patch<UpdateItem>(`/admin/updates/${updateId}`, payload);
  return res.data;
};

export const fetchAdminUpdateDetail = async (
  updateId: number,
  params?: { page?: number; page_size?: number }
): Promise<AdminUpdateDetailResponse> => {
  try {
    const res = await api.get(`/admin/updates/${updateId}`, { params });
    return res.data;
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response?.status === 405) {
      const [update, commentsRes] = await Promise.all([
        fetchUpdateDetail(updateId),
        fetchAdminUpdateComments(updateId, params),
      ]);

      return {
        update,
        comments: commentsRes.comments,
        total: commentsRes.total,
        page: commentsRes.page,
        page_size: commentsRes.page_size,
      };
    }
    throw error;
  }
};
