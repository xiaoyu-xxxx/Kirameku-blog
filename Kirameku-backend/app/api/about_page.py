from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.deps import get_session, get_current_user
from app.schemas import AboutPageUpdate
from app.services import about_page_service

router = APIRouter(prefix="/api/about", tags=["关于页"])


@router.get("")
def get_about(session: Session = Depends(get_session)):
    """公开只读：返回关于页内容。"""
    return about_page_service.get_about(session)


@router.put("")
def upsert_about(
    data: AboutPageUpdate,
    session: Session = Depends(get_session),
    _: dict = Depends(get_current_user),
):
    return about_page_service.upsert_about(session, data)
