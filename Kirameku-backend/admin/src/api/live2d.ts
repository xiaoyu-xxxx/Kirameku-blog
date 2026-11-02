import { http } from "@/utils/http";

export type Live2DSkinItem = {
  id: number;
  model_id: number;
  rel_path: string;
  label: string;
  sort: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type Live2DModelItem = {
  id: number;
  slug: string;
  name: string;
  sort: number;
  enabled: boolean;
  default_skin_id: number | null;
  package_size: number;
  file_count: number;
  source: string;
  skin_count: number;
  created_at: string;
  updated_at: string;
};

export type Live2DModelDetail = Live2DModelItem & {
  skins: Live2DSkinItem[];
};

export type Live2DDefaults = {
  default_model_id: number | null;
  default_skin_id: number | null;
  default_model_index: number;
  default_clothes_index: number;
};

export const getLive2DModels = () =>
  http.request<Live2DModelItem[]>("get", "/api/live2d/models");

export const getLive2DModel = (id: number) =>
  http.request<Live2DModelDetail>("get", `/api/live2d/models/${id}`);

export const updateLive2DModel = (
  id: number,
  data: Partial<{
    name: string;
    sort: number;
    enabled: boolean;
    default_skin_id: number | null;
  }>
) => http.request<Live2DModelItem>("put", `/api/live2d/models/${id}`, { data });

export const deleteLive2DModel = (id: number) =>
  http.request<{ ok: boolean }>("delete", `/api/live2d/models/${id}`);

export const updateLive2DSkin = (
  id: number,
  data: Partial<{ label: string; sort: number; enabled: boolean }>
) => http.request<Live2DSkinItem>("put", `/api/live2d/skins/${id}`, { data });

export const getLive2DDefaults = () =>
  http.request<Live2DDefaults>("get", "/api/live2d/defaults");

export const setLive2DDefaults = (data: {
  default_model_id: number;
  default_skin_id?: number | null;
}) => http.request<Live2DDefaults>("put", "/api/live2d/defaults", { data });

export const importLive2DModels = (force = false) =>
  http.request<{ models: number; skins: number; skipped: boolean; message: string }>(
    "post",
    `/api/live2d/import?force=${force ? "true" : "false"}`
  );

export const uploadLive2DZip = (payload: {
  file: File;
  name: string;
  slug: string;
  enabled?: boolean;
}) => {
  const form = new FormData();
  form.append("file", payload.file);
  form.append("name", payload.name);
  form.append("slug", payload.slug);
  form.append("enabled", String(payload.enabled ?? true));
  return http.request<Live2DModelDetail>("post", "/api/live2d/upload", {
    data: form,
    headers: { "Content-Type": "multipart/form-data" }
  });
};
