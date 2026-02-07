import { api, API_BASE_URL } from "./axios";

export type PresignUploadResponse = {
  upload_url: string;
  file_key: string;
  upload_headers: Record<string, string>;
};

export type PresignDownloadResponse = {
  download_url: string;
};

const FILES_BASE_URL = API_BASE_URL.replace(/\/api\/?$/, "");

export const presignUpload = async (payload: {
  filename: string;
  content_type: string;
}): Promise<PresignUploadResponse> => {
  const res = await api.post<PresignUploadResponse>(
    `${FILES_BASE_URL}/files/presign-upload`,
    payload
  );
  return res.data;
};

export const presignDownload = async (payload: {
  file_key: string;
}): Promise<PresignDownloadResponse> => {
  const encoded = encodeURIComponent(payload.file_key);
  const res = await api.get<{ url?: string }>(
    `${FILES_BASE_URL}/media/${encoded}`
  );
  return { download_url: res.data?.url ?? "" };
};
