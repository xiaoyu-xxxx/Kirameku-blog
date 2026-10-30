from datetime import datetime
from pydantic import BaseModel


class AboutPageUpdate(BaseModel):
    content: str = ""
    cover: str = ""


class AboutPageOut(BaseModel):
    id: int
    content: str
    cover: str
    updated_at: datetime
