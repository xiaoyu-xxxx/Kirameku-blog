import re
from html import unescape
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup
from markdownify import markdownify as md
from readability import Document

from app.api.upload import make_object_key, upload_object
from app.config import (
    EXTRACT_HTTP_TIMEOUT,
    EXTRACT_MAX_HTML_BYTES,
    JINA_READER_BASE,
    UPLOAD_PREFIX,
)
from app.utils.ssrf_guard import validate_http_url

_IMAGE_MD_RE = re.compile(r"!\[[^\]]*\]\(([^)]+)\)")
_IMAGE_HTML_RE = re.compile(r'<img[^>]+src=["\']([^"\']+)["\']', re.I)


def _insufficient(title: str, content: str) -> bool:
    if not (title or "").strip():
        return True
    text = (content or "").strip()
    return len(text) < 80


async def _fetch_bytes(client: httpx.AsyncClient, url: str) -> tuple[bytes, str | None]:
    async with client.stream("GET", url, follow_redirects=True) as resp:
        resp.raise_for_status()
        ctype = resp.headers.get("content-type")
        chunks: list[bytes] = []
        size = 0
        async for chunk in resp.aiter_bytes():
            size += len(chunk)
            if size > EXTRACT_MAX_HTML_BYTES:
                raise ValueError("页面体积过大")
            chunks.append(chunk)
        return b"".join(chunks), ctype


async def _extract_via_http(url: str) -> dict:
    validate_http_url(url)
    headers = {
        "User-Agent": "KiramekuBot/1.0 (+https://blog.xiaoyu-hh.cn)",
        "Accept": "text/html,application/xhtml+xml",
    }
    async with httpx.AsyncClient(timeout=EXTRACT_HTTP_TIMEOUT, headers=headers) as client:
        raw, _ = await _fetch_bytes(client, url)
    html = raw.decode("utf-8", errors="replace")
    doc = Document(html)
    title = unescape(doc.short_title() or "").strip()
    article_html = doc.summary(html_partial=True)
    soup = BeautifulSoup(article_html, "lxml")
    description = ""
    meta = soup.find("meta", attrs={"name": "description"})
    if meta and meta.get("content"):
        description = meta["content"].strip()
    content = md(str(soup), heading_style="ATX", bullets="-").strip()
    cover = ""
    og = BeautifulSoup(html, "lxml").find("meta", property="og:image")
    if og and og.get("content"):
        cover = urljoin(url, og["content"].strip())
    images = _collect_image_urls(content, article_html, base_url=url)
    return {
        "title": title,
        "description": description,
        "content": content,
        "cover": cover,
        "images": images,
        "source": "http",
    }


async def _extract_via_jina(url: str) -> dict:
    validate_http_url(url)
    jina_url = f"{JINA_READER_BASE}/{url}"
    headers = {
        "Accept": "text/markdown",
        "User-Agent": "KiramekuBot/1.0 (+https://blog.xiaoyu-hh.cn)",
    }
    async with httpx.AsyncClient(timeout=EXTRACT_HTTP_TIMEOUT, headers=headers) as client:
        resp = await client.get(jina_url, follow_redirects=True)
        resp.raise_for_status()
        text = resp.text.strip()
    title = ""
    content = text
    if text.startswith("Title:"):
        lines = text.split("\n", 2)
        if len(lines) >= 2:
            title = lines[0].replace("Title:", "").strip()
            content = lines[-1].strip() if len(lines) == 3 else lines[1].strip()
    elif text.startswith("# "):
        first, _, rest = text.partition("\n")
        title = first.lstrip("# ").strip()
        content = rest.strip()
    images = _collect_image_urls(content, "", base_url=url)
    cover = images[0] if images else ""
    return {
        "title": title,
        "description": "",
        "content": content,
        "cover": cover,
        "images": images,
        "source": "jina",
    }


def _collect_image_urls(markdown: str, html: str, *, base_url: str) -> list[str]:
    found: list[str] = []
    for pattern in (_IMAGE_MD_RE, _IMAGE_HTML_RE):
        for m in pattern.finditer(markdown + html):
            src = m.group(1).strip()
            if src.startswith("data:"):
                continue
            found.append(urljoin(base_url, src))
    # dedupe preserve order
    seen = set()
    out = []
    for u in found:
        if u not in seen:
            seen.add(u)
            out.append(u)
    return out


async def _download_image(client: httpx.AsyncClient, url: str) -> tuple[bytes, str] | None:
    try:
        validate_http_url(url)
    except Exception:
        return None
    try:
        resp = await client.get(url, follow_redirects=True)
        resp.raise_for_status()
        ctype = resp.headers.get("content-type", "image/jpeg").split(";")[0]
        if not ctype.startswith("image/"):
            return None
        data = resp.content
        if len(data) > 10 * 1024 * 1024:
            return None
        return data, ctype
    except Exception:
        return None


async def migrate_images_in_result(result: dict) -> dict:
    """Replace remote image URLs in content/cover with R2 public URLs."""
    base_page = result.get("_page_url") or ""
    images: list[str] = list(result.get("images") or [])
    cover = (result.get("cover") or "").strip()
    if cover and cover not in images:
        images.insert(0, cover)

    mapping: dict[str, str] = {}
    async with httpx.AsyncClient(timeout=EXTRACT_HTTP_TIMEOUT) as client:
        for img_url in images:
            if not img_url or img_url in mapping:
                continue
            parsed = urlparse(img_url)
            if parsed.scheme not in {"http", "https"}:
                continue
            # Skip already on our CDN
            if "img.xiaoyu-hh.cn" in parsed.netloc:
                mapping[img_url] = img_url
                continue
            downloaded = await _download_image(client, img_url)
            if not downloaded:
                continue
            data, ctype = downloaded
            ext = "jpg"
            if "png" in ctype:
                ext = "png"
            elif "webp" in ctype:
                ext = "webp"
            elif "gif" in ctype:
                ext = "gif"
            key = make_object_key(UPLOAD_PREFIX, f"extract.{ext}")
            public = upload_object(data, key=key, content_type=ctype)
            mapping[img_url] = public

    content = result.get("content") or ""

    def repl_md(m: re.Match) -> str:
        orig = m.group(1).strip()
        new = mapping.get(orig) or mapping.get(urljoin(base_page, orig))
        if new:
            return m.group(0).replace(orig, new)
        return m.group(0)

    content = _IMAGE_MD_RE.sub(repl_md, content)
    new_cover = mapping.get(cover, cover)
    if new_cover != cover:
        result["cover"] = new_cover
    result["content"] = content
    result["images"] = [mapping.get(u, u) for u in images]
    result.pop("_page_url", None)
    return result


async def extract_article_from_url(url: str, *, use_jina: bool = False) -> dict:
    url = validate_http_url(url)
    result: dict | None = None
    source = "http"

    if not use_jina:
        try:
            result = await _extract_via_http(url)
        except Exception:
            result = None

    if use_jina or result is None or _insufficient(result.get("title", ""), result.get("content", "")):
        try:
            jina_result = await _extract_via_jina(url)
            if result and _insufficient(result.get("title", ""), result.get("content", "")):
                # merge: prefer HTTP title if Jina empty
                if not jina_result.get("title") and result.get("title"):
                    jina_result["title"] = result["title"]
                if len(jina_result.get("content", "")) < len(result.get("content", "")):
                    jina_result["content"] = result.get("content") or jina_result.get("content", "")
                source = "http+jina"
            else:
                source = "jina"
            result = jina_result
        except Exception as exc:
            if result is None:
                raise exc

    assert result is not None
    result["source"] = source
    result["_page_url"] = url
    result = await migrate_images_in_result(result)
    return {
        "title": result.get("title") or "",
        "description": result.get("description") or "",
        "content": result.get("content") or "",
        "cover": result.get("cover") or "",
        "images": result.get("images") or [],
        "source": result.get("source") or source,
    }
