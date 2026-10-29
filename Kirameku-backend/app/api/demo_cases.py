from fastapi import APIRouter, Depends, File, UploadFile, HTTPException
from sqlmodel import Session

from app.deps import get_current_user, get_session
from app.schemas.demo_case import (
    DemoCaseCreate,
    DemoCaseUpdate,
    DemoCaseOut,
    DemoIframeOut,
)
from app.services import demo_case_service
from app.utils.demo_package import extract_demo_zip
from app.utils.rate_limit import check_rate_limit

router = APIRouter(prefix="/api/demo-cases", tags=["案例 Demo"])


def _serialize(row) -> DemoCaseOut:
    data = row.model_dump()
    data["public_url"] = demo_case_service.demo_case_public_url(row)
    data["iframe_snippet"] = demo_case_service.demo_case_iframe_snippet(row)
    return DemoCaseOut(**data)


@router.get("", response_model=list[DemoCaseOut])
def list_demo_cases(
    session: Session = Depends(get_session),
    _: dict = Depends(get_current_user),
):
    return [_serialize(r) for r in demo_case_service.list_demo_cases(session)]


@router.get("/{case_id}", response_model=DemoCaseOut)
def get_demo_case(
    case_id: int,
    session: Session = Depends(get_session),
    _: dict = Depends(get_current_user),
):
    return _serialize(demo_case_service.get_demo_case(session, case_id))


@router.post("", response_model=DemoCaseOut)
def create_demo_case(
    data: DemoCaseCreate,
    session: Session = Depends(get_session),
    user: dict = Depends(get_current_user),
):
    username = user.get("sub") or ""
    row = demo_case_service.create_demo_case(session, data, username=username)
    return _serialize(row)


@router.put("/{case_id}", response_model=DemoCaseOut)
def update_demo_case(
    case_id: int,
    data: DemoCaseUpdate,
    session: Session = Depends(get_session),
    user: dict = Depends(get_current_user),
):
    username = user.get("sub") or ""
    row = demo_case_service.update_demo_case(session, case_id, data, username=username)
    return _serialize(row)


@router.delete("/{case_id}")
def delete_demo_case(
    case_id: int,
    session: Session = Depends(get_session),
    _: dict = Depends(get_current_user),
):
    demo_case_service.delete_demo_case(session, case_id)
    return {"ok": True}


@router.post("/{case_id}/upload", response_model=DemoCaseOut)
async def upload_demo_package(
    case_id: int,
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
    user: dict = Depends(get_current_user),
):
    username = user.get("sub") or "admin"
    check_rate_limit(f"demo-upload:{username}")
    if not file.filename or not file.filename.lower().endswith(".zip"):
        raise HTTPException(400, "仅支持 zip 格式")
    raw = await file.read()
    files = extract_demo_zip(raw)
    row = demo_case_service.apply_demo_package(
        session, case_id, files, username=username
    )
    return _serialize(row)


@router.get("/{case_id}/iframe-snippet", response_model=DemoIframeOut)
def iframe_snippet(
    case_id: int,
    session: Session = Depends(get_session),
    _: dict = Depends(get_current_user),
):
    row = demo_case_service.get_demo_case(session, case_id)
    if row.status != 1:
        raise HTTPException(400, "案例已禁用")
    url = demo_case_service.demo_case_public_url(row)
    snippet = demo_case_service.demo_case_iframe_snippet(row)
    return DemoIframeOut(url=url, snippet=snippet)
