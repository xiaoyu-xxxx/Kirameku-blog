import { http } from "@/utils/http";

export type SiteSettingItem = {
  id: number;
  key: string;
  value: string;
  label: string;
  group: string;
  input_type: string;
  description: string;
  sort: number;
  updated_at: string;
};

export type SiteSettingPayload = {
  key: string;
  value: string;
  label: string;
  group: string;
  input_type: string;
  description: string;
  sort: number;
};

/** 管理端：全部站点设置 */
export const listSiteSettings = () => {
  return http.request<SiteSettingItem[]>("get", "/api/site-settings/list");
};

export const createSiteSetting = (data: SiteSettingPayload) => {
  return http.request<SiteSettingItem>("post", "/api/site-settings", { data });
};

export const updateSiteSetting = (
  id: number,
  data: Partial<SiteSettingPayload>
) => {
  return http.request<SiteSettingItem>("put", `/api/site-settings/${id}`, {
    data
  });
};

export const deleteSiteSetting = (id: number) => {
  return http.request<{ ok: boolean }>("delete", `/api/site-settings/${id}`);
};
