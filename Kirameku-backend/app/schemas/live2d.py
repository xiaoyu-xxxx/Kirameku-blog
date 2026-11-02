from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class Live2DSkinOut(BaseModel):
    id: int
    model_id: int
    rel_path: str
    entry_json: str = "index.json"
    cubism_family: str = "cubism2"
    label: str
    sort: int
    enabled: bool
    preview_url: Optional[str] = None
    preview_kind: Optional[str] = None  # assembled|bundle|atlas
    created_at: datetime
    updated_at: datetime


class Live2DModelOut(BaseModel):
    id: int
    slug: str
    name: str
    sort: int
    enabled: bool
    default_skin_id: Optional[int] = None
    package_size: int
    file_count: int
    source: str
    skin_count: int = 0
    preview_url: Optional[str] = None
    preview_kind: Optional[str] = None  # assembled|bundle|atlas
    created_at: datetime
    updated_at: datetime


class Live2DModelDetailOut(Live2DModelOut):
    skins: list[Live2DSkinOut] = Field(default_factory=list)


class Live2DModelUpdate(BaseModel):
    name: Optional[str] = None
    sort: Optional[int] = None
    enabled: Optional[bool] = None
    default_skin_id: Optional[int] = None


class Live2DSkinUpdate(BaseModel):
    label: Optional[str] = None
    sort: Optional[int] = None
    enabled: Optional[bool] = None


class Live2DDefaultsOut(BaseModel):
    default_model_id: Optional[int] = None
    default_skin_id: Optional[int] = None
    default_model_index: int = 0
    default_clothes_index: int = 0


class Live2DDefaultsUpdate(BaseModel):
    default_model_id: int
    default_skin_id: Optional[int] = None


class Live2DCatalogOut(BaseModel):
    # Option A: each string is a loadable relative path including the entry file
    # (e.g. "za/.../index.json" or ".../foo.model3.json"). Frontend must NOT append /index.json.
    models: list[list[str]]
    messages: list[str]
    default_model_index: int
    default_clothes_index: int
    asset_base: str


class Live2DImportResult(BaseModel):
    models: int
    skins: int
    skipped: bool = False
    message: str = ""
