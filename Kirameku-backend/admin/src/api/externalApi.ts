import { http } from "@/utils/http";

export type ExternalApiItem = {
  id: number;
  key: string;
  name: string;
  base_url: string;
  path: string;
  method: string;
  enabled: boolean;
  params: string | Record<string, any>;
  description: string;
  sort: number;
  updated_at: string;
};

export type ExternalApiPayload = {
  key: string;
  name: string;
  base_url: string;
  path: string;
  method: string;
  enabled: boolean;
  params: string;
  description: string;
  sort: number;
};

/** 管理端：全部外部 API（含停用） */
export const listExternalApis = () => {
  return http.request<ExternalApiItem[]>("get", "/api/external-apis/list");
};

export const createExternalApi = (data: ExternalApiPayload) => {
  return http.request<ExternalApiItem>("post", "/api/external-apis", { data });
};

export const updateExternalApi = (id: number, data: Partial<ExternalApiPayload>) => {
  return http.request<ExternalApiItem>("put", `/api/external-apis/${id}`, {
    data
  });
};

export const deleteExternalApi = (id: number) => {
  return http.request<{ ok: boolean }>("delete", `/api/external-apis/${id}`);
};
