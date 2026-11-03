import { request, ApiError } from "./client";

export interface FriendLinkItem {
  id: number;
  name: string;
  url: string;
  avatar: string;
  description: string;
  sort: number;
  is_approved: boolean;
  created_at: string;
}

export function getFriendLinks() {
  return request<FriendLinkItem[]>("/api/friend-links");
}

export type FriendLinkApplyPayload = {
  name: string;
  url: string;
  avatar?: string;
  description?: string;
  website?: string;
};

export async function applyFriendLink(data: FriendLinkApplyPayload) {
  try {
    return await request<FriendLinkItem>("/api/friend-links/apply", {
      method: "POST",
      body: JSON.stringify(data),
    });
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.status === 409) throw new ApiError("已有待审申请", 409);
      if (e.status === 429) throw new ApiError("提交过于频繁，请稍后再试", 429);
      if (e.status === 400 || e.status === 422) {
        throw new ApiError("请检查填写内容（链接须为 http/https）", e.status);
      }
    }
    throw e;
  }
}
