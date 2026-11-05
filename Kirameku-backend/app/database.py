from sqlmodel import SQLModel, create_engine, Session
from app.config import DATABASE_URL

engine = create_engine(DATABASE_URL, echo=False, pool_pre_ping=True)


def _ensure_live2d_skin_columns() -> None:
    """Add entry_json / cubism_family for existing DBs (create_all does not ALTER)."""
    with engine.begin() as conn:
        dialect = engine.dialect.name
        if dialect == "sqlite":
            rows = conn.exec_driver_sql("PRAGMA table_info(live2d_skin)").fetchall()
            existing = {r[1] for r in rows} if rows else set()
            if "entry_json" not in existing:
                conn.exec_driver_sql(
                    "ALTER TABLE live2d_skin ADD COLUMN entry_json VARCHAR(200) DEFAULT 'index.json'"
                )
            if "cubism_family" not in existing:
                conn.exec_driver_sql(
                    "ALTER TABLE live2d_skin ADD COLUMN cubism_family VARCHAR(20) DEFAULT 'cubism2'"
                )
            return
        # Postgres and other dialects supporting IF NOT EXISTS on ADD COLUMN
        for sql in (
            "ALTER TABLE live2d_skin ADD COLUMN IF NOT EXISTS entry_json VARCHAR(200) DEFAULT 'index.json'",
            "ALTER TABLE live2d_skin ADD COLUMN IF NOT EXISTS cubism_family VARCHAR(20) DEFAULT 'cubism2'",
        ):
            try:
                conn.exec_driver_sql(sql)
            except Exception:
                pass


def _ensure_github_user_ban_columns() -> None:
    """Add ban fields for existing github_user tables (create_all does not ALTER)."""
    with engine.begin() as conn:
        dialect = engine.dialect.name
        if dialect == "sqlite":
            rows = conn.exec_driver_sql("PRAGMA table_info(github_user)").fetchall()
            existing = {r[1] for r in rows} if rows else set()
            if "is_banned" not in existing:
                conn.exec_driver_sql(
                    "ALTER TABLE github_user ADD COLUMN is_banned BOOLEAN NOT NULL DEFAULT 0"
                )
            if "banned_at" not in existing:
                conn.exec_driver_sql(
                    "ALTER TABLE github_user ADD COLUMN banned_at TIMESTAMP NULL"
                )
            if "ban_reason" not in existing:
                conn.exec_driver_sql(
                    "ALTER TABLE github_user ADD COLUMN ban_reason VARCHAR(200) DEFAULT ''"
                )
            # SQLite has limited CREATE INDEX IF NOT EXISTS support; ignore failures
            try:
                conn.exec_driver_sql(
                    "CREATE INDEX IF NOT EXISTS idx_github_user_banned ON github_user(is_banned)"
                )
            except Exception:
                pass
            return
        for sql in (
            "ALTER TABLE github_user ADD COLUMN IF NOT EXISTS is_banned BOOLEAN NOT NULL DEFAULT FALSE",
            "ALTER TABLE github_user ADD COLUMN IF NOT EXISTS banned_at TIMESTAMP NULL",
            "ALTER TABLE github_user ADD COLUMN IF NOT EXISTS ban_reason VARCHAR(200) DEFAULT ''",
            "CREATE INDEX IF NOT EXISTS idx_github_user_banned ON github_user(is_banned)",
        ):
            try:
                conn.exec_driver_sql(sql)
            except Exception:
                pass


def init_db():
    SQLModel.metadata.create_all(engine)
    try:
        _ensure_live2d_skin_columns()
    except Exception:
        # Soft-fail: brand-new DB or missing table before create_all race.
        pass
    try:
        _ensure_github_user_ban_columns()
    except Exception:
        pass


def get_session():
    with Session(engine) as session:
        yield session
