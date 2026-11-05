# Nearby Places Finder

Nearby Places Finder is a role-aware web application for managing and discovering places on an interactive map. The React client uses a FastAPI API and PostgreSQL with PostGIS for storage and geospatial searches.

## Table of Contents

- [Project Overview](#project-overview)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [PostgreSQL and PostGIS Setup](#postgresql-and-postgis-setup)
- [Environment Variables](#environment-variables)
- [Backend Installation and Execution](#backend-installation-and-execution)
- [Frontend Installation and Execution](#frontend-installation-and-execution)
- [Database Initialization and Migrations](#database-initialization-and-migrations)
- [API Reference](#api-reference)
- [Accounts and Login](#accounts-and-login)
- [Importing Sample GeoJSON](#importing-sample-geojson)
- [Run the Complete Project](#run-the-complete-project)
- [Troubleshooting](#troubleshooting)
- [Future Enhancements](#future-enhancements)

## Project Overview

The application lets signed-in users manage their places and explore them on a Leaflet map. Users can search by category and distance from a selected/current location, or draw a polygon and search for places inside it.

Place coordinates are stored as PostGIS `geography(POINT, 4326)`. Nearby queries use PostGIS `ST_DWithin` and `ST_Distance`; polygon queries validate a GeoJSON Polygon with `ST_IsValid` and find matching points with `ST_Within`. GeoJSON uses the standard `[longitude, latitude]` coordinate order.

There are separate user and admin dashboard experiences. A regular user can access their own places; an admin can access places across users and manage user accounts.

## Features

- **Separate dashboards and role-based access:** user and admin overview routes and navigation are kept separate. Backend endpoints also enforce authorization.
- **Authentication:** user registration and email/password login, bearer JWT authentication, and a current-user endpoint. Passwords are hashed using the backend password-hashing library.
- **Interactive map:** Leaflet map with database place markers, current-location marker, radius overlay, and polygon drawing.
- **Nearby and radius search:** search authorized places within a radius and optionally by category. The API returns distance in meters.
- **Polygon search:** draw a polygon on the map, then display matching place details and count below the map.
- **Distance display:** nearby search returns `distance_meters`; the map can also calculate distance from current location for marker popups.
- **Category filters:** filter the map and Places table by category.
- **Places management:** create, view, update, and delete places. Users are scoped to their own places; admins can manage all places. The table supports name/address search and pagination.
- **Favorites:** each account has its own favorites. Authenticated users can add and remove favorites for places they are allowed to access.
- **CSV import/export:** upload CSV records and export authorized records.
- **GeoJSON import/export:** import Point features and retrieve authorized places as a GeoJSON FeatureCollection.
- **Admin user management:** list, add, update, and delete accounts. API safeguards prevent deleting the active admin account, deleting/demoting the last admin, or deleting a user who still owns places.

**Track history is not currently implemented** in the inspected frontend or backend. There is no track-history API, model, or track-history screen in this project version.

## Technology Stack

| Area | Technologies |
| --- | --- |
| Frontend | React, Vite, React Router, Axios |
| Backend | Python, FastAPI, Pydantic Settings, SQLAlchemy |
| Database | PostgreSQL |
| Geospatial | PostGIS, GeoAlchemy2 |
| Mapping | Leaflet, React Leaflet, marker clustering |
| Authentication | Bearer JWT (`python-jose`), `pwdlib` password hashing |
| Migrations | Alembic |
| Development and tests | npm, ESLint, pytest, Uvicorn |

## Project Structure

The following is a source-oriented outline. Local virtual environments, `node_modules`, build output, and caches are intentionally omitted.

```text
nearby-places-finder/
├── README.md
├── backend/
│   ├── .env.example
│   ├── alembic.ini
│   ├── requirements.txt
│   ├── alembic/
│   │   ├── env.py
│   │   └── versions/
│   │       ├── 20261104_0001_create_users_and_places.py
│   │       └── 20261104_0002_add_roles_favorites_and_ownership.py
│   ├── app/
│   │   ├── api/
│   │   │   ├── router.py
│   │   │   └── routes/
│   │   │       ├── auth.py
│   │   │       ├── favorites.py
│   │   │       └── places.py
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   └── security.py
│   │   ├── db/
│   │   │   ├── base.py
│   │   │   └── database.py
│   │   ├── models/
│   │   │   ├── favorite.py
│   │   │   ├── place.py
│   │   │   └── user.py
│   │   ├── schemas/
│   │   ├── services/
│   │   └── main.py
│   ├── scripts/
│   │   └── create_admin.py
│   └── tests/
└── frontend/
    ├── .env
    ├── package.json
    ├── package-lock.json
    ├── vite.config.js
    ├── public/
    └── src/
        ├── components/
        │   ├── layout/
        │   ├── map/
        │   └── places/
        ├── context/
        ├── pages/
        ├── services/
        └── utils/
```

Important directories and files:

- `backend/app/api/routes/`: authentication, place operations, and favorites endpoints.
- `backend/app/models/`: SQLAlchemy user, place, and favorite models.
- `backend/app/services/`: database-backed authentication and place operations.
- `backend/alembic/versions/`: schema revisions, including enabling PostGIS and adding role/ownership/favorite support.
- `backend/scripts/create_admin.py`: command-line utility to create the first admin account.
- `backend/tests/`: API and service tests.
- `frontend/src/pages/`: login, registration, user/admin dashboards, places, favorites, settings, and admin user management screens.
- `frontend/src/components/map/`: Leaflet map and marker rendering.
- `frontend/src/components/places/`: place management and collection components.
- `frontend/src/services/api.js`: Axios API client and endpoint wrappers.
- `frontend/src/utils/distance.js`: client-side distance calculations and formatting.

## Prerequisites

Install the following software:

- **Python 3.10 or newer** (the backend README specifies Python 3.10+).
- **Node.js 20.19+ or 22.12+**. These versions satisfy the installed Vite 8 engine requirement (`^20.19.0 || >=22.12.0`).
- **npm**, installed with Node.js. The project includes `package-lock.json`; use `npm ci` for a lockfile-based install.
- **PostgreSQL** with **PostGIS** available for the installed PostgreSQL version. The project does not pin PostgreSQL or PostGIS versions.
- **Git**, if cloning or versioning the project.

## PostgreSQL and PostGIS Setup

1. Install PostgreSQL for your operating system. On Windows, use the PostgreSQL Windows installer and install PostGIS for the same PostgreSQL installation (for example, through Stack Builder where available).
2. Open a PostgreSQL shell such as `psql` and create the project database once:

   ```powershell
   createdb -U postgres nearby_places_db
   ```

   `createdb` reports an error if that database already exists; do not drop or recreate an existing database to follow this guide.

3. Enable PostGIS in the project database:

   ```powershell
   psql -U postgres -d nearby_places_db -c "CREATE EXTENSION IF NOT EXISTS postgis;"
   ```

   The database role must be permitted to create the extension, or a PostgreSQL administrator can enable it.

4. Verify the extension:

   ```powershell
   psql -U postgres -d nearby_places_db -c "SELECT PostGIS_Full_Version();"
   ```

5. Configure `DATABASE_URL` in `backend/.env` as described below. The application configuration defaults to database `nearby_places_db` on `localhost:5432` using SQLAlchemy's `postgresql+psycopg2` driver. Use a URL-encoded password if it contains URL-reserved characters.

The first Alembic revision also runs `CREATE EXTENSION IF NOT EXISTS postgis`. Enabling it explicitly first is useful for verifying the database setup and permissions.

## Environment Variables

The project already contains `backend/.env.example` and `frontend/.env.example`. Copy them if local `.env` files do not exist; keep real `.env` files private and never commit secrets.

### Backend

Create `backend/.env` from the existing example and replace the placeholders:

```dotenv
DATABASE_URL=postgresql+psycopg2://postgres:replace_with_your_password@localhost:5432/nearby_places_db
SECRET_KEY=replace_with_a_random_secret_at_least_32_characters
ACCESS_TOKEN_EXPIRE_MINUTES=60
CORS_ORIGINS=["http://localhost:5173","http://127.0.0.1:5173"]
```

| Variable | Required? | Behavior |
| --- | --- | --- |
| `DATABASE_URL` | Required for your database connection; a local development default is present | SQLAlchemy PostgreSQL URL. |
| `SECRET_KEY` | Required for token creation | JWT signing key; the code requires at least 32 characters. Generate a private random value, for example with `python -c "import secrets; print(secrets.token_urlsafe(32))"`. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Optional | JWT lifetime; defaults to `60`. |
| `CORS_ORIGINS` | Optional | JSON array of allowed browser origins. Local Vite defaults are supplied by the settings class. |
| `CORS_ORIGIN_REGEX` | Optional | Regex for local Vite/preview origins; a development default is supplied. |
| `APP_NAME` | Optional | FastAPI application title; defaults to `Nearby Places Finder API`. |
| `API_PREFIX` | Optional | API route prefix; defaults to `/api`. |

`backend/.env.example` currently includes the first four variables. The remaining variables are configurable settings with code defaults.

### Frontend

Create `frontend/.env` from `frontend/.env.example`:

```dotenv
VITE_API_BASE_URL=http://127.0.0.1:8000
```

`VITE_API_BASE_URL` is optional; the Axios client uses `http://127.0.0.1:8000` by default. The client appends `/api` to the configured origin.

## Backend Installation and Execution

Run these commands in PowerShell from the project root:

```powershell
Set-Location .\backend
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

If PowerShell does not allow activating the virtual environment, use the Python executable directly as `.\.venv\Scripts\python.exe`.

Initialize the environment file only if you do not already have one:

```powershell
if (-not (Test-Path .\.env)) { Copy-Item .\.env.example .\.env }
```

Edit `backend/.env` with your local PostgreSQL connection and a private `SECRET_KEY`. Apply migrations as described in [Database Initialization and Migrations](#database-initialization-and-migrations), then start FastAPI:

```powershell
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Available API documentation:

- Swagger UI: <http://127.0.0.1:8000/docs>
- ReDoc: <http://127.0.0.1:8000/redoc>
- Health check: <http://127.0.0.1:8000/health>

Run backend tests from `backend/`:

```powershell
python -m pytest
```

## Frontend Installation and Execution

Open a second PowerShell terminal from the project root:

```powershell
Set-Location .\frontend
npm ci
```

Initialize the frontend environment file only if missing:

```powershell
if (-not (Test-Path .\.env)) { Copy-Item .\.env.example .\.env }
```

The example points to the local backend. Change `VITE_API_BASE_URL` only when your API runs at a different origin. Start Vite:

```powershell
npm run dev
```

Open the URL Vite prints (normally <http://localhost:5173>). Useful frontend checks:

```powershell
npm run lint
npm run build
```

## Database Initialization and Migrations

This project uses **Alembic**. It does not initialize its schema through `Base.metadata.create_all()` at application startup, and it does not rely on a separate hand-maintained SQL schema script.

From `backend/`, after configuring `.env` and creating the PostgreSQL database:

```powershell
alembic upgrade head
```

The revisions currently present:

1. `20261104_0001`: enables PostGIS and creates `users` and `places`, including the WGS84 geography point and spatial index.
2. `20261104_0002`: adds account roles, place ownership, and the `favorites` table.

Do not run a downgrade against a database containing data unless you have reviewed the migration and intentionally planned for its destructive effects.

## API Reference

All application API routes use the `/api` prefix by default. Except for health checks and registration/login, requests require a bearer token in the `Authorization` header:

```http
Authorization: Bearer <access_token>
```

For regular users, place operations are scoped to places they own. Admins can access all places. The server derives ownership from the authenticated account rather than trusting a client-supplied `owner_id`.

### Health

| Method | Endpoint | Description | Authentication |
| --- | --- | --- | --- |
| GET | `/` | API welcome message | No |
| GET | `/health` | Health status | No |

### Authentication

| Method | Endpoint | Description | Authentication |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | Register a regular user (`name`, `email`, `password`; password 8–128 characters) | No |
| POST | `/api/auth/login` | Exchange email/password for a bearer JWT and user profile | No |
| GET | `/api/auth/me` | Return the authenticated user's profile | Yes |

Registration always creates a regular user; public registration cannot grant an admin role.

Login example:

```powershell
$login = Invoke-RestMethod -Method Post `
  -Uri http://127.0.0.1:8000/api/auth/login `
  -ContentType 'application/json' `
  -Body '{"email":"your-user@example.com","password":"your-password"}'
$headers = @{ Authorization = "Bearer $($login.access_token)" }
```

The login response includes `access_token`, `token_type` (`bearer`), and a `user` object.

### Places

| Method | Endpoint | Description | Authentication |
| --- | --- | --- | --- |
| GET | `/api/places` | Paginated places; optional `category`, name/address `search`, `limit` (1–500), and `offset` | Yes |
| GET | `/api/places/admin/all` | Up to 5,000 places for admins | Admin |
| POST | `/api/places` | Create a place; ownership comes from the token | Yes |
| GET | `/api/places/{place_id}` | Get one authorized place | Yes |
| PATCH | `/api/places/{place_id}` | Update an authorized place | Yes |
| DELETE | `/api/places/{place_id}` | Delete an authorized place and its favorites | Yes |
| GET | `/api/places/geojson` | GeoJSON FeatureCollection; optional exact `category` filter | Yes |
| GET | `/api/places/{place_id}/geojson` | GeoJSON Feature for one authorized place | Yes |

Place creation accepts `name`, `category`, `latitude`, and `longitude`; `address` and `description` are optional. Coordinate ranges are latitude `-90..90` and longitude `-180..180`.

Example:

```powershell
Invoke-RestMethod -Method Post `
  -Uri http://127.0.0.1:8000/api/places `
  -Headers $headers -ContentType 'application/json' `
  -Body '{"name":"Sample Cafe","category":"Coffee","latitude":18.52,"longitude":73.85,"address":"Main Street","description":"Example place"}'
```

List responses have the shape `{ "items": [...], "total": 1, "limit": 100, "offset": 0 }`. Place records include `id`, `name`, `description`, `category`, `latitude`, `longitude`, `address`, `owner_id`, `created_at`, and `updated_at`.

### Nearby Search

| Method | Endpoint | Description | Authentication |
| --- | --- | --- | --- |
| GET | `/api/places/nearby` | Find authorized places within a radius; optional category and limit | Yes |

Required query parameters are `latitude` and `longitude`. `radius_meters` defaults to `5000` and must be greater than zero and at most `100000`; `limit` defaults to `100` and is capped at `500`. Results are sorted by distance and include `distance_meters`.

```powershell
Invoke-RestMethod 'http://127.0.0.1:8000/api/places/nearby?latitude=18.52&longitude=73.85&radius_meters=2000&category=Coffee' -Headers $headers
```

### Polygon Search

| Method | Endpoint | Description | Authentication |
| --- | --- | --- | --- |
| POST | `/api/places/within` | Search for authorized places within a valid GeoJSON Polygon | Yes |

The polygon requires a closed ring with at least three distinct positions. Coordinates use `[longitude, latitude]`. The optional `limit` query parameter defaults to `1000` and is capped at `5000`. The response is a list of place records; it does not currently include `distance_meters`.

```powershell
$polygon = @{
  type = 'Polygon'
  coordinates = @(@(
    @(73.80, 18.50), @(73.90, 18.50),
    @(73.90, 18.60), @(73.80, 18.60), @(73.80, 18.50)
  ))
} | ConvertTo-Json -Depth 8

Invoke-RestMethod -Method Post `
  -Uri http://127.0.0.1:8000/api/places/within `
  -Headers $headers -ContentType 'application/json' -Body $polygon
```

### Favorites

| Method | Endpoint | Description | Authentication |
| --- | --- | --- | --- |
| GET | `/api/favorites` | List this account's favorites | Yes |
| POST | `/api/favorites/{place_id}` | Add a favorite | Yes |
| DELETE | `/api/favorites/{place_id}` | Remove a favorite | Yes |
| POST | `/api/places/{place_id}/favorite` | Also adds a favorite (alternate route) | Yes |

Favorites are private per account. A regular user can favorite their own places; an admin can favorite any place. The frontend uses the `/api/favorites` routes.

### Track History

There are no track-history routes implemented in the current API.

### Import and Export

| Method | Endpoint | Description | Authentication |
| --- | --- | --- | --- |
| POST | `/api/places/import/csv` | Import UTF-8 CSV using multipart field `file` | Yes |
| POST | `/api/places/import/geojson` | Import a GeoJSON Feature or FeatureCollection of Points using multipart field `file` | Yes |
| GET | `/api/places/export/csv` | Download authorized records as `places.csv` | Yes |
| GET | `/api/places/geojson` | Retrieve authorized records as a GeoJSON FeatureCollection | Yes |

Both upload endpoints limit files to 10 MB and imports to 5,000 records. CSV requires `name`, `category`, `latitude`, and `longitude` headers; `description` and `address` are optional. GeoJSON requires Point features with `name` and `category` properties; `description` and `address` are optional. Coordinates are `[longitude, latitude]`. Valid records are imported under the authenticated account; invalid rows/features are returned in the `errors` list. Import responses contain `successful_count`, `failed_count`, and `errors`.

CSV export is a file response. GeoJSON is returned as a FeatureCollection. Regular users export only their own records; admins export all authorized records.

### Admin/User Management

| Method | Endpoint | Description | Authentication |
| --- | --- | --- | --- |
| GET | `/api/auth/admin/users` | List registered accounts | Admin |
| POST | `/api/auth/admin/users` | Create a user or admin account (`name`, `email`, `password`, optional `role`) | Admin |
| PATCH | `/api/auth/admin/users/{user_id}` | Update name, email, or role | Admin |
| DELETE | `/api/auth/admin/users/{user_id}` | Delete an account when safety constraints permit | Admin |

Roles are `user` and `admin`; the create endpoint defaults to `user`. The API prevents self-deletion and deletion/demotion of the last admin. A user who owns places cannot be deleted until their places are dealt with.

## Accounts and Login

No seeded demo accounts or default login credentials are included.

- **Create a user:** open the application and use **Create an account** (or `POST /api/auth/register`). This creates a regular user and signs them in through the frontend.
- **Create the first admin:** from the backend directory, run the supplied script. It rejects duplicate emails and refuses to create another admin when one already exists:

  ```powershell
  python .\scripts\create_admin.py --name "Admin Name" --email "admin@example.com" --password "replace-with-a-private-strong-password"
  ```

  This command requires a password argument. Use a private local terminal, avoid committing or sharing it, and do not use the example placeholder as a real password.
- **Create additional accounts:** after signing in as an admin, use the Admin page's user management controls.

Use the email and password selected when creating the account to log in. The script hashes the password before storing it.

## Importing Sample GeoJSON

There are no sample GeoJSON data files in the project source. The following minimal FeatureCollection is valid for this import implementation and may be saved locally as `sample-places.geojson`:

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [73.8567, 18.5204]
      },
      "properties": {
        "name": "Sample Cafe",
        "category": "Coffee",
        "address": "Example Street",
        "description": "A sample place for testing import"
      }
    }
  ]
}
```

Import it from the authenticated Places page using **Import GeoJSON**, or use the API:

```powershell
curl.exe -X POST `
  -H "Authorization: Bearer $($login.access_token)" `
  -F "file=@.\sample-places.geojson;type=application/geo+json" `
  http://127.0.0.1:8000/api/places/import/geojson
```

The frontend form uses a multipart upload with field name `file` as well. After a successful import, open the relevant dashboard map or Places page; your imported place is scoped to the importing account. A regular user will not see places owned by another user.

## Run the Complete Project

1. Start PostgreSQL and verify that `nearby_places_db` exists and PostGIS is enabled.
2. In **Terminal 1**, configure and start the backend:

   ```powershell
   Set-Location .\backend
   .\.venv\Scripts\Activate.ps1
   alembic upgrade head
   python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
   ```

3. In **Terminal 2**, install and start the frontend:

   ```powershell
   Set-Location .\frontend
   npm ci
   npm run dev
   ```

4. Open the Vite URL (normally <http://localhost:5173>), register or log in, then use the Places and map pages.

If setting up from a clean checkout, complete the virtual-environment, dependency-installation, and `.env` steps in the backend and frontend sections before starting the services.

## Troubleshooting

| Problem | Checks and solutions |
| --- | --- |
| PostgreSQL connection refused | Confirm the PostgreSQL service is running, the host/port in `DATABASE_URL` are correct, and the database exists. The local project default is `localhost:5432/nearby_places_db`. |
| Password authentication fails | Check the database username/password in `backend/.env`. URL-encode special characters in the connection URL password. |
| PostGIS extension missing | Connect to `nearby_places_db` and run `CREATE EXTENSION IF NOT EXISTS postgis;` with a role that can create the extension. Verify with `SELECT PostGIS_Full_Version();`. |
| Missing or invalid `SECRET_KEY` | Set a private key of at least 32 characters in `backend/.env`; restart the backend after changes. |
| Backend Python imports fail | Activate the backend virtual environment and run `python -m pip install -r requirements.txt`. |
| Frontend dependencies fail | Use a supported Node version, then run `npm ci` from `frontend/`. |
| Browser reports a CORS error | Confirm `CORS_ORIGINS` includes the exact frontend origin (scheme, hostname, and port), or use the configured local origin regex. Restart FastAPI after changing backend settings. |
| Frontend cannot reach the API | Check the backend health URL, then confirm `VITE_API_BASE_URL` points to the API origin (without `/api`; the client appends that prefix). Restart Vite after changing frontend environment variables. |
| GeoJSON import returns validation errors | Use a `Feature` or `FeatureCollection` containing `Point` features. Include `name` and `category`; use `[longitude, latitude]` coordinates in valid ranges. Keep the file under 10 MB and the collection to 5,000 features or fewer. |
| A user cannot see another account's places | This is expected: regular accounts see their own places only. Admin accounts can view all places. |
| Migration fails while enabling PostGIS | Install PostGIS for the PostgreSQL server version in use and enable the extension with a suitably privileged database role before running `alembic upgrade head`. |

## Future Enhancements

The following are possible future improvements, not features currently implemented:

- Add track-history models, endpoints, and UI if visit or route history is desired.
- Add automated browser/end-to-end tests for map drawing, import/export, and role-based workflows.
- Add deployment-specific configuration and operational monitoring.
- Add richer import duplicate detection and configurable import policies.
