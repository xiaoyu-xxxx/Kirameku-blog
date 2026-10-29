import { http } from "@/utils/http";

export type DemoCaseItem = {
  id: number;
  name: string;
  slug: string;
  entry_path: string;
  entry_query: string;
  base_url: string;
  status: number;
  package_size: number;
  file_count: number;
  remark: string;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
  public_url: string;
  iframe_snippet: string;
};

export type DemoIframeResult = {
  url: string;
  snippet: string;
  sandbox: string;
};

export const getDemoCases = () =>
  http.request<DemoCaseItem[]>("get", "/api/demo-cases");

export const getDemoCase = (id: number) =>
  http.request<DemoCaseItem>("get", `/api/demo-cases/${id}`);

export const createDemoCase = (data: {
  name: string;
  slug: string;
  entry_path?: string;
  entry_query?: string;
  base_url?: string;
  status?: number;
  remark?: string;
}) => http.request<DemoCaseItem>("post", "/api/demo-cases", { data });

export const updateDemoCase = (
  id: number,
  data: Partial<{
    name: string;
    slug: string;
    entry_path: string;
    entry_query: string;
    base_url: string;
    status: number;
    remark: string;
  }>
) => http.request<DemoCaseItem>("put", `/api/demo-cases/${id}`, { data });

export const deleteDemoCase = (id: number) =>
  http.request<{ ok: boolean }>("delete", `/api/demo-cases/${id}`);

export const uploadDemoPackage = (id: number, file: File) => {
  const form = new FormData();
  form.append("file", file);
  return http.request<DemoCaseItem>("post", `/api/demo-cases/${id}/upload`, {
    data: form,
    headers: { "Content-Type": "multipart/form-data" }
  });
};

export const getDemoIframeSnippet = (id: number) =>
  http.request<DemoIframeResult>("get", `/api/demo-cases/${id}/iframe-snippet`);
