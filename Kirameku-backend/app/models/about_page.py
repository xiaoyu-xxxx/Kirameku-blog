from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field


class AboutPage(SQLModel, table=True):
    __tablename__ = "about_page"

    id: Optional[int] = Field(default=None, primary_key=True)
    content: str = Field(default="")
    cover: str = Field(default="")
    updated_at: datetime = Field(default_factory=datetime.now)
