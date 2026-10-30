from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.deps import get_session, get_current_user
from app.schemas import SiteSettingCreate, SiteSettingUpdate, SiteSettingOut
from app.services import site_setting_service

router = APIRouter(prefix="/api/site-settings", tags=["站点设置"])


@router.get("")
def get_public_settings(session: Session = Depends(get_session)):
    """公开只读：返回 key -> value 字典，供前端消费。"""
    return site_setting_service.get_public_settings(session)


@router.get("/list")
def list_settings(
    session: Session = Depends(get_session),
    _: dict = Depends(get_current_user),
):
    """管理端：返回完整设置列表（含 label/group 等元信息）。"""
    return site_setting_service.list_settings(session)


@router.post("", response_model=SiteSettingOut)
def create_setting(
    data: SiteSettingCreate,
    session: Session = Depends(get_session),
    _: dict = Depends(get_current_user),
):
    return site_setting_service.create_setting(session, data)


@router.put("/{setting_id}", response_model=SiteSettingOut)
def update_setting(
    setting_id: int,
    data: SiteSettingUpdate,
    session: Session = Depends(get_session),
    _: dict = Depends(get_current_user),
):
    return site_setting_service.update_setting(session, setting_id, data)


@router.delete("/{setting_id}")
def delete_setting(
    setting_id: int,
    session: Session = Depends(get_session),
    _: dict = Depends(get_current_user),
):
    site_setting_service.delete_setting(session, setting_id)
    return {"ok": True}
