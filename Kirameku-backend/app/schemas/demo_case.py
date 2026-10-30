from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator
import re

SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


class DemoCaseBase(BaseModel):
    name: str = Field(max_length=100)
    slug: str = Field(max_length=80)
    entry_path: str = Field(default="index.html", max_length=200)
    entry_query: str = Field(default="", max_length=200)
    base_url: str = Field(default="", max_length=300)
    status: int = Field(default=1, ge=0, le=1)
    remark: str = Field(default="", max_length=500)

    @field_validator("slug")
    @classmethod
    def validate_slug(cls, v: str) -> str:
        v = v.strip().lower()
        if not SLUG_RE.match(v):
            raise ValueError("slug 仅允许小写字母、数字与连字符")
        return v


class DemoCaseCreate(DemoCaseBase):
    pass


class DemoCaseUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=100)
    slug: Optional[str] = Field(default=None, max_length=80)
    entry_path: Optional[str] = Field(default=None, max_length=200)
    entry_query: Optional[str] = Field(default=None, max_length=200)
    base_url: Optional[str] = Field(default=None, max_length=300)
    status: Optional[int] = Field(default=None, ge=0, le=1)
    remark: Optional[str] = Field(default=None, max_length=500)

    @field_validator("slug")
    @classmethod
    def validate_slug(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip().lower()
        if not SLUG_RE.match(v):
            raise ValueError("slug 仅允许小写字母、数字与连字符")
        return v


class DemoCaseOut(DemoCaseBase):
    id: int
    package_size: int
    file_count: int
    created_by: str
    updated_by: str
    created_at: datetime
    updated_at: datetime
    public_url: str = ""
    iframe_snippet: str = ""


class DemoIframeOut(BaseModel):
    url: str
    snippet: str
    sandbox: str = "allow-scripts allow-forms"
