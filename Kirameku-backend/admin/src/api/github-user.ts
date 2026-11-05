import { http } from "@/utils/http";

export type GithubUserItem = {
  id: number;
  github_id: number;
  login: string;
  avatar: string;
  bio: string;
  created_at: string;
  is_banned: boolean;
  banned_at: string | null;
  ban_reason: string;
  comment_count: number;
  message_count: number;
};

export type GithubUserActivity = {
  id: number;
  content: string;
  status: string;
  created_at: string;
  type: "comment" | "message" | string;
};

export type GithubUserDetail = GithubUserItem & {
  recent_comments: GithubUserActivity[];
  recent_messages: GithubUserActivity[];
};

export type GithubUserListResponse = {
  items: GithubUserItem[];
  total: number;
};

/** 管理-前台用户列表 */
export const getAdminGithubUsers = (params?: {
  q?: string;
  is_banned?: boolean;
  page?: number;
  size?: number;
}) => {
  return http.request<GithubUserListResponse>("get", "/api/github-users/admin", {
    params
  });
};

/** 管理-前台用户详情 */
export const getAdminGithubUser = (id: number) => {
  return http.request<GithubUserDetail>("get", `/api/github-users/admin/${id}`);
};

/** 禁用 */
export const banGithubUser = (id: number, reason = "") => {
  return http.request<GithubUserItem>("put", `/api/github-users/admin/${id}/ban`, {
    data: { reason }
  });
};

/** 解禁 */
export const unbanGithubUser = (id: number) => {
  return http.request<GithubUserItem>(
    "put",
    `/api/github-users/admin/${id}/unban`
  );
};
