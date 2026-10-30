from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.deps import get_session
from app.services import external_api_service, site_setting_service, about_page_service

router = APIRouter(prefix="/api/public", tags=["公开配置"])


@router.get("/config")
def get_public_config(session: Session = Depends(get_session)):
    """一次性返回前端需要的所有公开配置。"""
    return {
        "external_apis": external_api_service.get_public_apis(session),
        "site_settings": site_setting_service.get_public_settings(session),
        "about": about_page_service.get_about(session),
    }
