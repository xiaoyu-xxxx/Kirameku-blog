from datetime import datetime
from pydantic import BaseModel


class ExternalApiCreate(BaseModel):
    key: str
    name: str = ""
    base_url: str = ""
    path: str = ""
    method: str = "GET"
    enabled: bool = True
    params: str = "{}"
    description: str = ""
    sort: int = 0


class ExternalApiUpdate(BaseModel):
    name: str | None = None
    base_url: str | None = None
    path: str | None = None
    method: str | None = None
    enabled: bool | None = None
    params: str | None = None
    description: str | None = None
    sort: int | None = None


class ExternalApiOut(BaseModel):
    id: int
    key: str
    name: str
    base_url: str
    path: str
    method: str
    enabled: bool
    params: str
    description: str
    sort: int
    updated_at: datetime
