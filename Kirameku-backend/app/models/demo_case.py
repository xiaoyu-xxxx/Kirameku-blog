from datetime import datetime
from typing import Optional

from sqlmodel import SQLModel, Field


class DemoCase(SQLModel, table=True):
    """Interactive demo package metadata (static files on demos.* / R2 prefix demos/)."""

    __tablename__ = "demo_case"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(max_length=100)
    slug: str = Field(max_length=80, unique=True, index=True)
    entry_path: str = Field(default="index.html", max_length=200)
    entry_query: str = Field(default="", max_length=200)
    base_url: str = Field(default="", max_length=300)
    status: int = Field(default=1, description="1=enabled, 0=disabled")
    package_size: int = Field(default=0)
    file_count: int = Field(default=0)
    remark: str = Field(default="", max_length=500)
    created_by: str = Field(default="", max_length=50)
    updated_by: str = Field(default="", max_length=50)
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
