import { 
  useGetAdminStats, 
  useGetAdminDocuments, 
  useGetLowConfidenceQuestions,
  useGetAdminSources,
  useAddSource,
  useRemoveSource,
  useStartCrawl,
  useRecrawlStale
} from "@workspace/api-client-react";
import { useMutation } from "@tanstack/react-query";
import { useCallback } from "react";
import { getAuthHeaders } from "./use-auth";

const API_BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "") + "/api";

async function adminFetch(path: string, method = "POST", body?: unknown) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || "Request failed");
  }
  return res.json();
}

export function useAdminStats() {
  return useGetAdminStats({ request: { headers: getAuthHeaders() } });
}

export function useAdminDocuments(params?: { page?: number; limit?: number; source?: string; status?: string }) {
  return useGetAdminDocuments(params, { request: { headers: getAuthHeaders() } });
}

export function useAdminLowConfidenceQuestions(params?: { page?: number; limit?: number }) {
  return useGetLowConfidenceQuestions(params, { request: { headers: getAuthHeaders() } });
}

export function useAdminSources() {
  return useGetAdminSources({ request: { headers: getAuthHeaders() } });
}

export function useAdminAddSource() {
  return useAddSource({ request: { headers: getAuthHeaders() } });
}

export function useAdminRemoveSource() {
  return useRemoveSource({ request: { headers: getAuthHeaders() } });
}

export function useAdminStartCrawl() {
  return useStartCrawl({ request: { headers: getAuthHeaders() } });
}

export function useAdminRecrawlStale() {
  return useRecrawlStale({ request: { headers: getAuthHeaders() } });
}

export function useAdminCancelCrawl() {
  return useMutation({
    mutationFn: () => adminFetch("/admin/crawl/cancel"),
  });
}

export function useAdminDeleteDocument() {
  return useMutation({
    mutationFn: (id: number) => adminFetch(`/admin/documents/${id}`, "DELETE"),
  });
}

export function useAdminToggleSource() {
  return useMutation({
    mutationFn: (id: number) => adminFetch(`/admin/sources/${id}/toggle`, "PATCH"),
  });
}

// Generic hook that returns a fetch-like function for custom admin API calls.
// adminFetch is stable across renders (memoized with useCallback) to prevent
// infinite polling loops in components that use it as a useEffect dependency.
export function useAdminApi() {
  const adminFetchRaw = useCallback((path: string, options?: RequestInit): Promise<Response> => {
    return fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        ...getAuthHeaders(),
        ...(options?.headers ?? {}),
      },
    });
  }, []); // stable — getAuthHeaders reads from localStorage at call time

  return { adminFetch: adminFetchRaw };
}
