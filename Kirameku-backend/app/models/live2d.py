from datetime import datetime
from typing import Optional

from sqlmodel import SQLModel, Field


class Live2DModel(SQLModel, table=True):
    """Live2D character group metadata (one OML2D models[] entry)."""

    __tablename__ = "live2d_model"

    id: Optional[int] = Field(default=None, primary_key=True)
    slug: str = Field(max_length=80, unique=True, index=True)
    name: str = Field(max_length=200)
    sort: int = Field(default=0, index=True)
    enabled: bool = Field(default=True)
    default_skin_id: Optional[int] = Field(default=None)
    package_size: int = Field(default=0)
    file_count: int = Field(default=0)
    source: str = Field(default="builtin", max_length=20)  # builtin | upload
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)


class Live2DSkin(SQLModel, table=True):
    """One Cubism2 package (skin/clothes) under a model group."""

    __tablename__ = "live2d_skin"

    id: Optional[int] = Field(default=None, primary_key=True)
    model_id: int = Field(index=True, foreign_key="live2d_model.id")
    rel_path: str = Field(max_length=300, index=True)
    label: str = Field(default="", max_length=200)
    sort: int = Field(default=0)
    enabled: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
