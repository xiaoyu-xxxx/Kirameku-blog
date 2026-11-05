from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field


class GitHubUser(SQLModel, table=True):
    __tablename__ = "github_user"

    id: Optional[int] = Field(default=None, primary_key=True)
    github_id: int = Field(unique=True, index=True)
    login: str = Field(max_length=100)
    avatar: str = Field(default="", max_length=500)
    bio: str = Field(default="", max_length=500)
    created_at: datetime = Field(default_factory=datetime.now)
    # 管理端禁用（一期）：禁用不删行，旧 JWT 仍可识别，写操作拒绝
    is_banned: bool = Field(default=False, index=True)
    banned_at: Optional[datetime] = Field(default=None)
    ban_reason: str = Field(default="", max_length=200)
