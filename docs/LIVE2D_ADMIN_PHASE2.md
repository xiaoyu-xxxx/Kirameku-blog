# Live2D Admin Phase 2 (list / upload / site default)

## Env

| Var | Default | Notes |
|-----|---------|-------|
| `LIVE2D_LOCAL_ROOT` | `<repo>/Kirameku/public/live2d` | Disk root; uploads go to `model/<slug>/<version>/...` |
| `LIVE2D_ASSET_BASE` | `/live2d/` | Browser prefix (`catalog.asset_base`) |
| `LIVE2D_MODEL_LIST_PATH` | `$LIVE2D_LOCAL_ROOT/model_list.json` | Builtin import source |
| `LIVE2D_MAX_ZIP_BYTES` | 40MB | Zip cap |
| `LIVE2D_MAX_FILES` | 200 | Files per package |
| `LIVE2D_MAX_FILE_BYTES` | 12MB | Per-file cap |
| `LIVE2D_UPLOAD_RATE_LIMIT` | 10 | Per admin per window |
| `LIVE2D_UPLOAD_RATE_WINDOW` | 3600 | Rate window seconds |
| `LIVE2D_DEFAULT_MODEL_INDEX` | 20 | Code fallback group index |
| `LIVE2D_DEFAULT_CLOTHES_INDEX` | 0 | Code fallback clothes index |

Do **not** mix with `DEMO_*` / R2 `demos/` / `POST /api/upload/image`.

## Site default choice

- Stored in `site_setting`: `live2d_default_model_id` / `live2d_default_skin_id`
- Public `GET /api/public/live2d/catalog` resolves to enabled-list indexes
- Frontend priority: valid OML2D/legacy LS -> site default -> code 20/0

## Import

```bash
cd Kirameku-backend
python scripts/import_live2d_models.py
# or admin "Import model_list"; --force rebuilds builtin only
```

## Cache / purge

- Production `/live2d/` is immutable long-cache: **never overwrite the same URL**
- Upload paths always include a `<version>` timestamp directory
- Catalog: `Cache-Control: public, max-age=60, must-revalidate` (not immutable)
- If an old static file was overwritten, ops must purge `/live2d/...`

## API

- Public: `GET /api/public/live2d/catalog`
- Admin: `/api/live2d/models`, `/skins/{id}`, `/defaults`, `/import`, `/upload`
