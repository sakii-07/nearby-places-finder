# Nearby Places Finder API

A FastAPI backend for the existing React/Vite client. It provides JSON authentication at `/api/auth`, place CRUD at `/api/places`, PostGIS nearby and polygon searches, GeoJSON, and CSV/GeoJSON file import and export.

The frontend's Axios client uses `http://127.0.0.1:8000/api`; the API keeps that prefix and allows the Vite origins `http://localhost:5173` and `http://127.0.0.1:5173`. Registration accepts `name`, `email`, and `password`, matching the current sign-up form. Login accepts JSON `email` and `password` and returns a bearer token. Existing frontend files are not changed by this backend.

## Requirements

- Python 3.10 or newer
- PostgreSQL with PostGIS installed
- PostgreSQL credentials with permission to create the PostGIS extension (or have an administrator enable it)

## Windows PowerShell setup

From the project root:

```powershell
cd .\backend
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
$existingEnvFile = Get-Item .env -ErrorAction SilentlyContinue
if ($null -eq $existingEnvFile -or $existingEnvFile.Length -eq 0) {
  Copy-Item .env.example .env -Force
}
```

Edit `.env` and replace the example database password and signing key with your own values. The command above only initializes a missing or empty `.env`, preserving an existing non-empty file. Do not commit `.env`. For example:

```dotenv
DATABASE_URL=postgresql+psycopg2://postgres:YOUR_POSTGRES_PASSWORD@localhost:5432/nearby_places_db
SECRET_KEY=PASTE_A_RANDOM_SECRET_OF_AT_LEAST_32_CHARACTERS_HERE
ACCESS_TOKEN_EXPIRE_MINUTES=60
CORS_ORIGINS=["http://localhost:5173","http://127.0.0.1:5173"]
```

URL-encode any special characters in the database password. The configured database in this project is `nearby_places_db`. If it does not already exist, create it (do not recreate an existing database):

```powershell
createdb -U postgres nearby_places_db
psql -U postgres -d nearby_places_db -c "CREATE EXTENSION IF NOT EXISTS postgis;"
```

The migration also runs `CREATE EXTENSION IF NOT EXISTS postgis`; the database role must be allowed to create the extension, or an administrator can enable it before migration.

Apply migrations and start the development server:

```powershell
alembic upgrade head
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Create the first admin account safely (this does not auto-promote public sign-ups):

```powershell
python .\scripts\create_admin.py --name "Platform Admin" --email "admin@example.com" --password "StrongPassword!123"
```

Open Swagger UI at <http://127.0.0.1:8000/docs>, ReDoc at <http://127.0.0.1:8000/redoc>, and the health check at <http://127.0.0.1:8000/health>. Keep the server running in one PowerShell window; start the frontend in another with `cd .\frontend; npm run dev`.

Run the unit tests from `backend/`:

```powershell
python -m pytest
```

## API overview

All JSON APIs use `/api`. Validation errors use FastAPI's standard `422` response with a `detail` field; other errors return a clear `detail` message.

| Method | Path | Access | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` | Public | Create a user |
| POST | `/api/auth/login` | Public | Return a JWT access token |
| GET | `/api/auth/me` | Bearer token | Get the current user |
| GET | `/api/auth/admin/users` | Admin | List registered users |
| POST | `/api/auth/admin/users` | Admin | Create a user or admin account |
| PATCH | `/api/auth/admin/users/{user_id}` | Admin | Update a user's name, email, or role |
| DELETE | `/api/auth/admin/users/{user_id}` | Admin | Delete an account when related records allow it |
| GET | `/api/places` | Authenticated | Paginated places owned by the user, or all places for admins |
| POST | `/api/places` | Bearer token | Create a place |
| GET | `/api/places/{place_id}` | Authenticated | Get an owned place, or any place for admins |
| PATCH | `/api/places/{place_id}` | Bearer token | Update a place |
| DELETE | `/api/places/{place_id}` | Bearer token | Delete a place |
| GET | `/api/places/nearby` | Authenticated | Nearby owned places, or all places for admins |
| POST | `/api/places/within` | Authenticated | Owned places within a GeoJSON Polygon, or all for admins |
| GET | `/api/places/geojson` | Authenticated | Authorized places as a GeoJSON FeatureCollection |
| GET | `/api/places/{place_id}/geojson` | Authenticated | An authorized place as a GeoJSON Feature |
| POST | `/api/places/import/csv` | Bearer token | Validate and import a CSV upload |
| POST | `/api/places/import/geojson` | Bearer token | Validate and import Point features |
| GET | `/api/places/export/csv` | Authenticated | Download authorized places as CSV |

Uploads are limited to 10 MB and 5,000 records. CSV requires `name,category,latitude,longitude`; `description` and `address` are optional. GeoJSON imports accept a `Feature` or `FeatureCollection` of `Point` features with `name` and `category` properties (and optional `description`, `address`). Invalid records are reported individually; valid records are imported.

### Example requests and responses

Register:

```powershell
$register = Invoke-RestMethod -Method Post `
  -Uri http://127.0.0.1:8000/api/auth/register `
  -ContentType 'application/json' `
  -Body '{"name":"Sam Example","email":"sam@example.com","password":"correct-horse-battery"}'
```

Log in and retain the access token:

```powershell
$login = Invoke-RestMethod -Method Post `
  -Uri http://127.0.0.1:8000/api/auth/login `
  -ContentType 'application/json' `
  -Body '{"email":"sam@example.com","password":"correct-horse-battery"}'
$headers = @{ Authorization = "Bearer $($login.access_token)" }
```

Login response shape:

```json
{
  "access_token": "<signed JWT>",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "name": "Sam Example",
    "email": "sam@example.com",
    "created_at": "2026-11-04T12:15:00Z"
  }
}
```

Create a place:

```powershell
Invoke-RestMethod -Method Post `
  -Uri http://127.0.0.1:8000/api/places `
  -Headers $headers -ContentType 'application/json' `
  -Body '{"name":"Harbor View Cafe","description":"Coffee and pastries","category":"Coffee","latitude":37.7955,"longitude":-122.3937,"address":"Pier 1, San Francisco"}'
```

Find coffee within 2 km:

```powershell
Invoke-RestMethod 'http://127.0.0.1:8000/api/places/nearby?latitude=37.7955&longitude=-122.3937&radius_meters=2000&category=Coffee'
```

Nearby items include `distance_meters`; list APIs return `{ "items": [...], "total": 1, "limit": 100, "offset": 0 }`.

Polygon search accepts a closed GeoJSON ring (coordinates use longitude, latitude order):

```powershell
$polygon = @{
  type = 'Polygon'
  coordinates = @(@(
    @(-123.0, 37.0), @(-122.0, 37.0),
    @(-122.0, 38.0), @(-123.0, 38.0), @(-123.0, 37.0)
  ))
} | ConvertTo-Json -Depth 8
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8000/api/places/within `
  -ContentType 'application/json' -Body $polygon
```

GeoJSON export returns a standard `FeatureCollection`, with each point's `coordinates` in `[longitude, latitude]` order and its place fields in `properties`. For CSV import/export, use `Invoke-RestMethod` or a multipart-capable HTTP client and include the upload field named `file`.

## Geospatial implementation

Place coordinates are stored as PostGIS `geography(POINT, 4326)`. Nearby queries use `ST_DWithin` in meters and sort by `ST_Distance`. Polygon searches validate the GeoJSON Polygon ring structure and use PostGIS `ST_IsValid` and `ST_Within` against the stored point geometry. GeoJSON serialization is generated from the stored PostGIS point; no geospatial search is mocked in application code.
