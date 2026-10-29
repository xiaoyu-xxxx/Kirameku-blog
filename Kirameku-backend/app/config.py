import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env", override=True)

DATABASE_URL = os.environ["DATABASE_URL"]
SECRET_KEY = os.environ["SECRET_KEY"]
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 72

CORS_ORIGINS = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:3000,http://localhost:5173,https://boke.hiromu.top",
).split(",")

# GitHub OAuth
GITHUB_CLIENT_ID = os.environ.get("GITHUB_CLIENT_ID", "")
GITHUB_CLIENT_SECRET = os.environ.get("GITHUB_CLIENT_SECRET", "")

# Upload backend: cf = Cloudflare R2 (default for this deploy)
UPLOADTYPE = os.getenv("UPLOADTYPE", "cf").strip().lower()

# Cloudflare R2 (preferred). Secrets from env only — never hardcode.
# Fallback order for keys: CLOUDFLARE_* → R2_* → OSS_*
CLOUDFLARE_ACCOUNT_ID = os.getenv(
    "CLOUDFLARE_ACCOUNT_ID",
    os.getenv("R2_ACCOUNT_ID", "9bd6393269b0934e28f5379a36e972f3"),
)
CLOUDFLARE_ACCESS_KEY = (
    os.getenv("CLOUDFLARE_ACCESS_KEY")
    or os.getenv("R2_ACCESS_KEY_ID")
    or os.getenv("OSS_ACCESS_KEY_ID")
    or ""
)
CLOUDFLARE_SECRET_KEY = (
    os.getenv("CLOUDFLARE_SECRET_KEY")
    or os.getenv("R2_SECRET_ACCESS_KEY")
    or os.getenv("OSS_ACCESS_KEY_SECRET")
    or ""
)
CLOUDFLARE_BUCKET = os.getenv(
    "CLOUDFLARE_BUCKET",
    os.getenv("R2_BUCKET", os.getenv("OSS_BUCKET_NAME", "blog")),
)
CLOUDFLARE_ENDPOINT = os.getenv(
    "CLOUDFLARE_ENDPOINT",
    os.getenv(
        "R2_ENDPOINT",
        os.getenv(
            "OSS_ENDPOINT",
            f"https://{CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com",
        ),
    ),
)
CLOUDFLARE_PUBLIC_BASE_URL = os.getenv(
    "CLOUDFLARE_PUBLIC_BASE_URL",
    os.getenv("R2_PUBLIC_BASE_URL", os.getenv("OSS_CUSTOM_DOMAIN", "https://img.xiaoyu-hh.cn")),
)
CLOUDFLARE_REGION = os.getenv("CLOUDFLARE_REGION", os.getenv("OSS_REGION", "auto"))

# Object key prefixes (do not overwrite historical OSS/ keys)
UPLOAD_PREFIX = os.getenv("UPLOAD_PREFIX", os.getenv("OSS_PREFIX", "kirameku/"))
PHOTOWALL_PREFIX = os.getenv(
    "PHOTOWALL_PREFIX", os.getenv("OSS_PHOTOWALL_PREFIX", "photowall/")
)

# Legacy OSS_* aliases (fallback / ops compatibility)
OSS_ACCESS_KEY_ID = CLOUDFLARE_ACCESS_KEY
OSS_ACCESS_KEY_SECRET = CLOUDFLARE_SECRET_KEY
OSS_BUCKET_NAME = CLOUDFLARE_BUCKET
OSS_ENDPOINT = CLOUDFLARE_ENDPOINT
OSS_CUSTOM_DOMAIN = CLOUDFLARE_PUBLIC_BASE_URL
OSS_PREFIX = UPLOAD_PREFIX
OSS_REGION = CLOUDFLARE_REGION
OSS_PHOTOWALL_PREFIX = PHOTOWALL_PREFIX
