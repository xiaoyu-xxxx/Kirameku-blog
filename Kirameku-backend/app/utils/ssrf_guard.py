import ipaddress
import socket
from urllib.parse import urlparse

from fastapi import HTTPException

_BLOCKED_HOSTS = {
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
    "::1",
    "metadata.google.internal",
}


def _is_blocked_ip(ip_str: str) -> bool:
    try:
        ip = ipaddress.ip_address(ip_str)
    except ValueError:
        return True
    if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
        return True
    if ip.is_multicast or ip.is_unspecified:
        return True
    # Cloud metadata
    if ip_str == "169.254.169.254":
        return True
    return False


def validate_http_url(url: str) -> str:
    """Reject SSRF-prone targets; returns normalized URL string."""
    url = (url or "").strip()
    if not url:
        raise HTTPException(400, "URL 不能为空")
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"}:
        raise HTTPException(400, "仅支持 http/https URL")
    if not parsed.netloc:
        raise HTTPException(400, "URL 无效")
    host = parsed.hostname
    if not host:
        raise HTTPException(400, "URL 无效")
    host_lower = host.lower()
    if host_lower in _BLOCKED_HOSTS:
        raise HTTPException(400, "不允许访问该主机")
    if host_lower.endswith(".local") or host_lower.endswith(".internal"):
        raise HTTPException(400, "不允许访问该主机")

    # Resolve hostnames and block private ranges (DNS rebinding mitigation)
    try:
        infos = socket.getaddrinfo(host, parsed.port or (443 if parsed.scheme == "https" else 80))
    except socket.gaierror:
        raise HTTPException(400, "无法解析主机名")
    for info in infos:
        addr = info[4][0]
        if _is_blocked_ip(addr):
            raise HTTPException(400, "不允许访问内网或保留地址")

    return url
