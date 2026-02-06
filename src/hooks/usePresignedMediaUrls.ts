import { useEffect, useMemo, useState } from "react";

import { presignDownload } from "../api/files";
import { normalizeMediaUrl } from "../util/normalizeMediaUrl";

export type ResolvedMediaItem = {
  raw: string;
  url: string;
};

const cache = new Map<string, string>();

const isDirectUrl = (value: string) =>
  value.startsWith("http") ||
  value.startsWith("blob:") ||
  value.startsWith("data:") ||
  value.startsWith("//");

export const usePresignedMediaUrls = (mediaRefs: string[]) => {
  const [resolved, setResolved] = useState<ResolvedMediaItem[]>([]);

  const uniqueRefs = useMemo(
    () => Array.from(new Set(mediaRefs.filter(Boolean))),
    [mediaRefs]
  );

  useEffect(() => {
    let cancelled = false;

    const resolveAll = async () => {
      if (uniqueRefs.length === 0) {
        setResolved([]);
        return;
      }

      const items = await Promise.all(
        uniqueRefs.map(async (raw) => {
          const cached = cache.get(raw);
          if (cached) {
            return { raw, url: cached };
          }

          if (isDirectUrl(raw)) {
            const normalized = normalizeMediaUrl(raw) || raw;
            cache.set(raw, normalized);
            return { raw, url: normalized };
          }

          const normalizedFallback = normalizeMediaUrl(raw);

          try {
            const res = await presignDownload({ file_key: raw });
            const url = res.download_url || normalizedFallback || "";
            if (url) {
              cache.set(raw, url);
            }
            return { raw, url };
          } catch {
            return { raw, url: normalizedFallback || "" };
          }
        })
      );

      if (!cancelled) {
        setResolved(items.filter((item) => item.url));
      }
    };

    resolveAll();

    return () => {
      cancelled = true;
    };
  }, [uniqueRefs]);

  return resolved;
};
