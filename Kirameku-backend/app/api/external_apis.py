from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.deps import get_session, get_current_user
from app.schemas import ExternalApiCreate, ExternalApiUpdate, ExternalApiOut
from app.services import external_api_service

router = APIRouter(prefix="/api/external-apis", tags=["外部 API 配置"])


@router.get("")
def list_public_apis(session: Session = Depends(get_session)):
    """公开只读：仅返回已启用的外部 API，供前端直连使用。"""
    return external_api_service.get_public_apis(session)


@router.get("/list")
def list_all_apis(
    session: Session = Depends(get_session),
    _: dict = Depends(get_current_user),
):
    """管理端：返回全部（含停用）。"""
    return external_api_service.list_apis(session)


@router.post("", response_model=ExternalApiOut)
def create_api(
    data: ExternalApiCreate,
    session: Session = Depends(get_session),
    _: dict = Depends(get_current_user),
):
    return external_api_service.create_api(session, data)


@router.put("/{api_id}", response_model=ExternalApiOut)
def update_api(
    api_id: int,
    data: ExternalApiUpdate,
    session: Session = Depends(get_session),
    _: dict = Depends(get_current_user),
):
    return external_api_service.update_api(session, api_id, data)


@router.delete("/{api_id}")
def delete_api(
    api_id: int,
    session: Session = Depends(get_session),
    _: dict = Depends(get_current_user),
):
    external_api_service.delete_api(session, api_id)
    return {"ok": True}
