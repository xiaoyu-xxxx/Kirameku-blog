from datetime import datetime
from pydantic import BaseModel


class SiteSettingCreate(BaseModel):
    key: str
    value: str = ""
    label: str = ""
    group: str = "basic"
    input_type: str = "text"
    description: str = ""
    sort: int = 0


class SiteSettingUpdate(BaseModel):
    value: str | None = None
    label: str | None = None
    group: str | None = None
    input_type: str | None = None
    description: str | None = None
    sort: int | None = None


class SiteSettingOut(BaseModel):
    id: int
    key: str
    value: str
    label: str
    group: str
    input_type: str
    description: str
    sort: int
    updated_at: datetime
