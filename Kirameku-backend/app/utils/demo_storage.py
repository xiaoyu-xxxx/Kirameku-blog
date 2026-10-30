"""Demo case static file storage.

Default (``DEMO_STORAGE=local``): write under ``DEMO_LOCAL_ROOT`` on the server.
``DEMO_PUBLIC_BASE`` (e.g. https://demos.xiaoyu-hh.cn) should serve those files via nginx/CDN.
Do not use R2 for new demo uploads; keep the R2 ``demos/`` prefix empty.
``DEMO_STORAGE=r2`` remains for legacy cleanup only.
"""

from pathlib import Path

import boto3
from botocore.exceptions import ClientError
from fastapi import HTTPException

from app.config import (
    DEMO_LOCAL_ROOT,
    DEMO_PUBLIC_BASE,
    DEMO_R2_PREFIX,
    DEMO_STORAGE,
    CLOUDFLARE_BUCKET,
)
from app.api.upload import _get_s3_client, _normalize_prefix
from app.utils.demo_package import guess_content_type


def _demo_prefix(slug: str) -> str:
    base = _normalize_prefix(DEMO_R2_PREFIX)
    return f"{base}{slug.strip('/')}/"


def _local_root(slug: str) -> Path:
    root = DEMO_LOCAL_ROOT / slug.strip("/")
    root.mkdir(parents=True, exist_ok=True)
    return root


def delete_demo_files(slug: str) -> None:
    if DEMO_STORAGE == "local":
        root = DEMO_LOCAL_ROOT / slug.strip("/")
        if root.exists():
            for p in sorted(root.rglob("*"), reverse=True):
                if p.is_file():
                    p.unlink()
                elif p.is_dir():
                    p.rmdir()
            try:
                root.rmdir()
            except OSError:
                pass
        return

    client = _get_s3_client()
    prefix = _demo_prefix(slug)
    token = None
    while True:
        kwargs = {"Bucket": CLOUDFLARE_BUCKET, "Prefix": prefix}
        if token:
            kwargs["ContinuationToken"] = token
        resp = client.list_objects_v2(**kwargs)
        contents = resp.get("Contents") or []
        if not contents:
            break
        delete_keys = [{"Key": o["Key"]} for o in contents]
        client.delete_objects(Bucket=CLOUDFLARE_BUCKET, Delete={"Objects": delete_keys})
        if not resp.get("IsTruncated"):
            break
        token = resp.get("NextContinuationToken")


def upload_demo_files(slug: str, files: list[tuple[str, bytes]]) -> int:
    total_size = sum(len(b) for _, b in files)
    if DEMO_STORAGE == "local":
        root = _local_root(slug)
        for rel, data in files:
            dest = root / rel
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(data)
        return total_size

    client = _get_s3_client()
    prefix = _demo_prefix(slug)
    for rel, data in files:
        key = f"{prefix}{rel}"
        extra = {}
        ct = guess_content_type(rel)
        if ct:
            extra["ContentType"] = ct
        try:
            client.put_object(Bucket=CLOUDFLARE_BUCKET, Key=key, Body=data, **extra)
        except ClientError as e:
            raise HTTPException(500, f"上传到 R2 失败: {e}") from e
    return total_size


def build_public_url(slug: str, entry_path: str, entry_query: str, base_url: str) -> str:
    base = (base_url or DEMO_PUBLIC_BASE).rstrip("/")
    path = f"{slug.strip('/')}/{entry_path.lstrip('/')}"
    url = f"{base}/{path}"
    q = (entry_query or "").strip()
    if q:
        url += q if q.startswith("?") else f"?{q}"
    return url


def build_iframe_snippet(
    *,
    name: str,
    url: str,
    sandbox: str = "allow-scripts allow-forms",
) -> str:
    title = name.replace('"', "&quot;")
    return (
        f'<iframe src="{url}" title="{title}" '
        f'sandbox="{sandbox}" loading="lazy" '
        f'class="demo-embed kirameku-demo-embed" '
        f'style="width:100%;min-height:420px;border:0;border-radius:1rem;"></iframe>'
    )
