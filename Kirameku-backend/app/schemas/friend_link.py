from datetime import datetime
from pydantic import BaseModel, Field, field_validator
import re


class FriendLinkCreate(BaseModel):
    name: str
    url: str
    avatar: str = ""
    description: str = ""
    sort: int = 0
    # 管理端创建可指定；公开 apply 不走此 schema
    is_approved: bool = True


class FriendLinkApply(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    url: str = Field(min_length=1, max_length=300)
    avatar: str = Field(default="", max_length=500)
    description: str = Field(default="", max_length=300)
    # 蜜罐：人类不可见；填了则假成功不落库
    website: str = ""

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        v = (v or "").strip()
        if not v:
            raise ValueError("站点名称不能为空")
        return v

    @field_validator("url")
    @classmethod
    def validate_url(cls, v: str) -> str:
        v = (v or "").strip()
        if not re.match(r"^https?://", v, re.IGNORECASE):
            raise ValueError("站点链接须以 http:// 或 https:// 开头")
        if len(v) > 300:
            raise ValueError("站点链接过长")
        return v

    @field_validator("avatar")
    @classmethod
    def validate_avatar(cls, v: str) -> str:
        v = (v or "").strip()
        if not v:
            return ""
        if not re.match(r"^https?://", v, re.IGNORECASE):
            raise ValueError("头像链接须为 http(s) URL")
        if len(v) > 500:
            raise ValueError("头像链接过长")
        return v

    @field_validator("description")
    @classmethod
    def strip_description(cls, v: str) -> str:
        v = (v or "").strip()
        if len(v) > 300:
            raise ValueError("简介过长")
        return v


class FriendLinkUpdate(BaseModel):
    name: str | None = None
    url: str | None = None
    avatar: str | None = None
    description: str | None = None
    sort: int | None = None
    is_approved: bool | None = None


class FriendLinkOut(BaseModel):
    id: int
    name: str
    url: str
    avatar: str
    description: str
    sort: int
    is_approved: bool
    created_at: datetime
    updated_at: datetime | None = None
