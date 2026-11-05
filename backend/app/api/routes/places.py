from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from fastapi.responses import Response
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.api.routes.auth import get_current_user, require_admin
from app.db.database import get_db
from app.models.favorite import Favorite
from app.models.place import Place
from app.models.user import User
from app.schemas.place import (
    GeoJSONFeatureCollection,
    ImportResult,
    NearbyPlace,
    PlaceCreate,
    PlaceList,
    PlaceRead,
    PlaceUpdate,
    PolygonSearchRequest,
)
from app.services.place_service import (
    all_place_features,
    create_place,
    export_csv,
    get_place,
    import_places,
    list_places as query_places,
    nearby_places,
    parse_csv_import,
    parse_geojson_import,
    place_feature,
    polygon_places,
    update_place,
)

router = APIRouter()
MAX_UPLOAD_BYTES = 10 * 1024 * 1024


async def _read_upload(file: UploadFile) -> bytes:
    content = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Upload is larger than the 10 MB limit.",
        )
    return content


def _owner_filter(current_user: User) -> int | None:
    return None if current_user.role == "admin" else current_user.id


def _ensure_place_access(place: Place, current_user: User) -> None:
    if current_user.role != "admin" and place.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only access places you own.",
        )


@router.get(
    "",
    response_model=PlaceList,
    summary="List places",
    description="Return a paginated list of places, optionally filtered by an exact category.",
)
def list_places(
    category: str | None = Query(default=None, max_length=100),
    search: str | None = Query(default=None, max_length=200),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    items, total = query_places(
        db,
        limit=limit,
        offset=offset,
        category=category,
        search=search,
        owner_id=_owner_filter(current_user),
    )
    return {"items": items, "total": total, "limit": limit, "offset": offset}


@router.get(
    "/admin/all",
    response_model=list[PlaceRead],
    summary="List every place for admins",
    description="Return every place entry to an authenticated admin user.",
)
def list_all_places_for_admin(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> list[dict]:
    items, _ = query_places(db, limit=5000, offset=0)
    return items


@router.get(
    "/nearby",
    response_model=list[NearbyPlace],
    summary="Search nearby places",
    description="Find places within a meter radius using PostGIS ST_DWithin; results are sorted by ST_Distance.",
)
def search_nearby(
    latitude: float = Query(ge=-90, le=90),
    longitude: float = Query(ge=-180, le=180),
    radius_meters: float = Query(default=5000, gt=0, le=100000),
    category: str | None = Query(default=None, max_length=100),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    return nearby_places(
        db,
        latitude=latitude,
        longitude=longitude,
        radius_meters=radius_meters,
        category=category,
        limit=limit,
        owner_id=_owner_filter(current_user),
    )


@router.post(
    "/within",
    response_model=list[PlaceRead],
    summary="Search places in a polygon",
    description="Accept a GeoJSON Polygon and return places inside it using PostGIS ST_Within.",
)
def search_within_polygon(
    polygon: PolygonSearchRequest,
    limit: int = Query(default=1000, ge=1, le=5000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    try:
        return polygon_places(
            db,
            polygon.model_dump(),
            limit,
            owner_id=_owner_filter(current_user),
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc


@router.get(
    "/geojson",
    response_model=GeoJSONFeatureCollection,
    summary="Export places as GeoJSON",
    description="Return a GeoJSON FeatureCollection using WGS84 longitude/latitude coordinates.",
)
def get_places_geojson(
    category: str | None = Query(default=None, max_length=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    return all_place_features(
        db,
        category=category,
        owner_id=_owner_filter(current_user),
    )


@router.post(
    "/import/csv",
    response_model=ImportResult,
    status_code=status.HTTP_200_OK,
    summary="Import places from CSV",
    description="Upload a UTF-8 CSV with name, category, latitude, and longitude headers. Valid rows are imported.",
)
async def import_csv_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    try:
        records, errors = parse_csv_import(await _read_upload(file))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    return import_places(db, records, errors, owner=current_user)


@router.post(
    "/import/geojson",
    response_model=ImportResult,
    status_code=status.HTTP_200_OK,
    summary="Import places from GeoJSON",
    description="Upload a GeoJSON Feature or FeatureCollection containing Point features and place properties.",
)
async def import_geojson_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    try:
        records, errors = parse_geojson_import(await _read_upload(file))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    return import_places(db, records, errors, owner=current_user)


@router.get(
    "/export/csv",
    summary="Export places as CSV",
    description="Download all places as a UTF-8 CSV file.",
)
def export_places_csv(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    return Response(
        content=export_csv(db, owner_id=_owner_filter(current_user)),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="places.csv"'},
    )


@router.get(
    "/{place_id}/geojson",
    response_model=dict,
    summary="Get a place as GeoJSON",
    description="Return one place as a GeoJSON Feature.",
)
def get_place_geojson(
    place_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    place = db.get(Place, place_id)
    if place is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Place not found.")
    _ensure_place_access(place, current_user)
    return place_feature(db, place)


@router.get(
    "/{place_id}",
    response_model=PlaceRead,
    summary="Get a place",
    description="Return the details of one place by its numeric ID.",
)
def get_place_by_id(
    place_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    place = db.get(Place, place_id)
    if place is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Place not found.")
    _ensure_place_access(place, current_user)
    return get_place(db, place_id)


@router.post(
    "/{place_id}/favorite",
    response_model=PlaceRead,
    status_code=status.HTTP_201_CREATED,
    summary="Save a place to favorites",
)
def add_place_favorite(
    place_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    place = db.get(Place, place_id)
    if place is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Place not found.")
    _ensure_place_access(place, current_user)

    from app.models.favorite import Favorite

    existing = db.scalar(
        select(Favorite).where(
            Favorite.user_id == current_user.id,
            Favorite.place_id == place_id,
        )
    )
    if existing is not None:
        return get_place(db, place_id)

    favorite = Favorite(user_id=current_user.id, place_id=place_id)
    db.add(favorite)
    db.commit()
    return get_place(db, place_id)


@router.post(
    "",
    response_model=PlaceRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a place",
    description="Create a place with its coordinates stored as a PostGIS geography point.",
)
def create_place_record(
    payload: PlaceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    return create_place(db, payload, owner=current_user)


@router.patch(
    "/{place_id}",
    response_model=PlaceRead,
    summary="Update a place",
    description="Update one or more place properties or coordinates.",
)
def update_place_record(
    place_id: int,
    payload: PlaceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    place = db.get(Place, place_id)
    if place is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Place not found.")
    _ensure_place_access(place, current_user)
    return update_place(db, place, payload)


@router.delete(
    "/{place_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a place",
    description="Permanently delete a place by its numeric ID.",
)
def delete_place_record(
    place_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    place = db.get(Place, place_id)
    if place is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Place not found.")
    _ensure_place_access(place, current_user)
    db.execute(delete(Favorite).where(Favorite.place_id == place_id))
    db.execute(delete(Place).where(Place.id == place_id))
    db.commit()