from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field


class SiteSetting(SQLModel, table=True):
    __tablename__ = "site_setting"

    id: Optional[int] = Field(default=None, primary_key=True)
    key: str = Field(max_length=100, unique=True)
    value: str = Field(default="")
    label: str = Field(default="", max_length=100)
    group: str = Field(default="basic", max_length=50)
    input_type: str = Field(default="text", max_length=20)
    description: str = Field(default="", max_length=200)
    sort: int = Field(default=0)
    updated_at: datetime = Field(default_factory=datetime.now)
