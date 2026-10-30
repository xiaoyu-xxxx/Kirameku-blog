from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field


class ExternalApi(SQLModel, table=True):
    __tablename__ = "external_api"

    id: Optional[int] = Field(default=None, primary_key=True)
    key: str = Field(max_length=100, unique=True)
    name: str = Field(default="", max_length=100)
    base_url: str = Field(default="", max_length=500)
    path: str = Field(default="", max_length=200)
    method: str = Field(default="GET", max_length=10)
    enabled: bool = Field(default=True)
    params: str = Field(default="{}")
    description: str = Field(default="", max_length=200)
    sort: int = Field(default=0)
    updated_at: datetime = Field(default_factory=datetime.now)
