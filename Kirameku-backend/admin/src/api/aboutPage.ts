import { http } from "@/utils/http";

export type AboutPageItem = {
  id?: number;
  content: string;
  cover: string;
  updated_at?: string;
};

export const getAbout = () => {
  return http.request<AboutPageItem>("get", "/api/about");
};

export const saveAbout = (data: { content: string; cover: string }) => {
  return http.request<AboutPageItem>("put", "/api/about", { data });
};
