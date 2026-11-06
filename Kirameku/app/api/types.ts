export interface GitHubUser {
  id: number;
  login: string;
  avatar: string;
  bio: string;
  /** 管理端禁用：禁言仍可登录看内容（含简历） */
  is_banned: boolean;
  /** 若后端返回则透传；未返回勿编造 */
  ban_reason?: string;
}
