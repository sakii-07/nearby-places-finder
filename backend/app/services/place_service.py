import csv
import io
import json
from collections.abc import Iterable
from typing import Any

from geoalchemy2 import Geography, Geometry
from geoalchemy2.elements import WKTElement
from sqlalchemy import cast, func, select
from sqlalchemy.orm import Session

from app.models.place import Place
from app.models.user import User
from app.schemas.place import PlaceCreate, PlaceUpdate

MAX_IMPORT_RECORDS = 5000


def _point(latitude: float, longitude: float) -> Any:
    return cast(
        func.ST_SetSRID(func.ST_MakePoint(longitude, latitude), 4326),
        Geography(srid=4326),
    )


def _point_value(latitude: float, longitude: float) -> WKTElement:
    return WKTElement(f"POINT({longitude} {latitude})", srid=4326)


def _place_data(db: Session, place: Place) -> dict[str, Any]:
    geometry = cast(Place.location, Geometry(srid=4326))
    latitude, longitude = db.execute(
        select(func.ST_Y(geometry), func.ST_X(geometry)).where(Place.id == place.id)
    ).one()
    return {
        "id": place.id,
        "name": place.name,
        "description": place.description,
        "category": place.category,
        "latitude": latitude,
        "longitude": longitude,
        "address": place.address,
        "owner_id": place.owner_id,
        "created_at": place.created_at,
        "updated_at": place.updated_at,
    }


def list_places(
    db: Session,
    *,
    limit: int,
    offset: int,
    category: str | None = None,
    search: str | None = None,
    owner_id: int | None = None,
) -> tuple[list[dict[str, Any]], int]:
    filters = []
    if category:
        filters.append(Place.category == category)
    if search:
        pattern = f"%{search.strip()}%"
        filters.append(Place.name.ilike(pattern) | Place.address.ilike(pattern))
    if owner_id is not None:
        filters.append(Place.owner_id == owner_id)
    total = db.scalar(select(func.count()).select_from(Place).where(*filters)) or 0
    places = db.scalars(
        select(Place)
        .where(*filters)
        .order_by(Place.id)
        .offset(offset)
        .limit(limit)
    ).all()
    return [_place_data(db, place) for place in places], total


def get_place(db: Session, place_id: int) -> dict[str, Any] | None:
    place = db.get(Place, place_id)
    return _place_data(db, place) if place is not None else None


def create_place(db: Session, payload: PlaceCreate, owner: User | None = None) -> dict[str, Any]:
    place = Place(
        name=payload.name,
        description=payload.description,
        category=payload.category,
        address=payload.address,
        owner_id=owner.id if owner else None,
        location=_point_value(payload.latitude, payload.longitude),
    )
    db.add(place)
    db.commit()
    db.refresh(place)
    return _place_data(db, place)


def update_place(db: Session, place: Place, payload: PlaceUpdate) -> dict[str, Any]:
    values = payload.model_dump(exclude_unset=True)
    latitude = values.pop("latitude", None)
    longitude = values.pop("longitude", None)
    for field, value in values.items():
        setattr(place, field, value)
    if latitude is not None or longitude is not None:
        current_latitude, current_longitude = db.execute(
            select(
                func.ST_Y(cast(Place.location, Geometry(srid=4326))),
                func.ST_X(cast(Place.location, Geometry(srid=4326))),
            ).where(Place.id == place.id)
        ).one()
        place.location = _point_value(
            latitude if latitude is not None else current_latitude,
            longitude if longitude is not None else current_longitude,
        )
    db.commit()
    db.refresh(place)
    return _place_data(db, place)


def nearby_places(
    db: Session,
    *,
    latitude: float,
    longitude: float,
    radius_meters: float,
    category: str | None,
    limit: int,
    owner_id: int | None = None,
) -> list[dict[str, Any]]:
    origin = _point(latitude, longitude)
    distance = func.ST_Distance(Place.location, origin).label("distance_meters")
    query = select(Place, distance).where(
        func.ST_DWithin(Place.location, origin, radius_meters)
    )
    if owner_id is not None:
        query = query.where(Place.owner_id == owner_id)
    if category:
        query = query.where(Place.category == category)
    rows = db.execute(query.order_by(distance).limit(limit)).all()
    return [
        {**_place_data(db, place), "distance_meters": meters}
        for place, meters in rows
    ]


def polygon_places(
    db: Session,
    polygon: dict[str, Any],
    limit: int,
    *,
    owner_id: int | None = None,
) -> list[dict[str, Any]]:
    polygon_geojson = json.dumps(polygon)
    area = func.ST_SetSRID(func.ST_GeomFromGeoJSON(polygon_geojson), 4326)
    valid = db.scalar(select(func.ST_IsValid(area)))
    if not valid:
        raise ValueError("Polygon is invalid or self-intersecting.")
    filters = [func.ST_Within(cast(Place.location, Geometry(srid=4326)), area)]
    if owner_id is not None:
        filters.append(Place.owner_id == owner_id)
    query = select(Place).where(*filters).order_by(Place.id).limit(limit)
    return [_place_data(db, place) for place in db.scalars(query).all()]


def _geojson_geometry(db: Session, place: Place) -> dict[str, Any]:
    raw = db.scalar(
        select(func.ST_AsGeoJSON(Place.location)).where(Place.id == place.id)
    )
    return json.loads(raw)


def place_feature(db: Session, place: Place) -> dict[str, Any]:
    data = _place_data(db, place)
    place_id = data.pop("id")
    data.pop("latitude")
    data.pop("longitude")
    data.pop("created_at")
    data.pop("updated_at")
    return {
        "type": "Feature",
        "id": place_id,
        "geometry": _geojson_geometry(db, place),
        "properties": data,
    }


def all_place_features(
    db: Session, *, category: str | None = None, owner_id: int | None = None
) -> dict[str, Any]:
    query = select(Place).order_by(Place.id)
    if category:
        query = query.where(Place.category == category)
    if owner_id is not None:
        query = query.where(Place.owner_id == owner_id)
    return {
        "type": "FeatureCollection",
        "features": [place_feature(db, place) for place in db.scalars(query).all()],
    }


def parse_csv_import(content: bytes) -> tuple[list[PlaceCreate], list[str]]:
    try:
        text = content.decode("utf-8-sig")
        reader = csv.DictReader(io.StringIO(text))
        required = {"name", "category", "latitude", "longitude"}
        headers = set(reader.fieldnames or [])
        if not required.issubset(headers):
            raise ValueError(
                "CSV headers must include name, category, latitude, and longitude."
            )
        rows = list(reader)
    except (UnicodeDecodeError, csv.Error) as exc:
        raise ValueError("CSV file must be valid UTF-8 with a header row.") from exc
    if len(rows) > MAX_IMPORT_RECORDS:
        raise ValueError(f"CSV may contain at most {MAX_IMPORT_RECORDS} records.")

    valid: list[PlaceCreate] = []
    errors: list[str] = []
    for row_number, row in enumerate(rows, start=2):
        try:
            valid.append(
                PlaceCreate(
                    name=row.get("name", ""),
                    category=row.get("category", ""),
                    latitude=float(row.get("latitude", "")),
                    longitude=float(row.get("longitude", "")),
                    description=row.get("description") or None,
                    address=row.get("address") or None,
                )
            )
        except (ValueError, TypeError) as exc:
            errors.append(f"Row {row_number}: {exc}")
    return valid, errors


def parse_geojson_import(content: bytes) -> tuple[list[PlaceCreate], list[str]]:
    try:
        document = json.loads(content.decode("utf-8-sig"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ValueError("Upload must be valid UTF-8 GeoJSON.") from exc

    if not isinstance(document, dict):
        raise ValueError("GeoJSON must be a Feature or FeatureCollection object.")
    if document.get("type") == "FeatureCollection":
        features = document.get("features")
    elif document.get("type") == "Feature":
        features = [document]
    else:
        raise ValueError("GeoJSON must be a Feature or FeatureCollection.")
    if not isinstance(features, list):
        raise ValueError("GeoJSON FeatureCollection must contain a features array.")
    if len(features) > MAX_IMPORT_RECORDS:
        raise ValueError(f"GeoJSON may contain at most {MAX_IMPORT_RECORDS} features.")

    valid: list[PlaceCreate] = []
    errors: list[str] = []
    for index, feature in enumerate(features, start=1):
        try:
            if not isinstance(feature, dict):
                raise ValueError("feature must be an object.")
            geometry = feature["geometry"]
            if not isinstance(geometry, dict):
                raise ValueError("geometry must be an object.")
            if geometry["type"] != "Point":
                raise ValueError("geometry must be a Point.")
            coordinates = geometry["coordinates"]
            if not isinstance(coordinates, list):
                raise ValueError("Point coordinates must be an array.")
            if len(coordinates) < 2:
                raise ValueError("Point coordinates must include longitude and latitude.")
            properties = feature.get("properties") or {}
            if not isinstance(properties, dict):
                raise ValueError("feature properties must be an object.")
            valid.append(
                PlaceCreate(
                    name=properties.get("name", ""),
                    description=properties.get("description"),
                    category=properties.get("category", ""),
                    address=properties.get("address"),
                    longitude=coordinates[0],
                    latitude=coordinates[1],
                )
            )
        except (KeyError, TypeError, ValueError) as exc:
            errors.append(f"Feature {index}: {exc}")
    return valid, errors


def import_places(
    db: Session,
    records: Iterable[PlaceCreate],
    errors: list[str],
    *,
    owner: User,
) -> dict[str, Any]:
    places = [
        Place(
            name=record.name,
            description=record.description,
            category=record.category,
            address=record.address,
            owner_id=owner.id,
            location=_point_value(record.latitude, record.longitude),
        )
        for record in records
    ]
    db.add_all(places)
    db.commit()
    return {
        "successful_count": len(places),
        "failed_count": len(errors),
        "errors": errors,
    }


def export_csv(db: Session, *, owner_id: int | None = None) -> str:
    query = select(Place).order_by(Place.id)
    if owner_id is not None:
        query = query.where(Place.owner_id == owner_id)
    places = db.scalars(query).all()
    fieldnames = [
        "id", "name", "description", "category", "latitude",
        "longitude", "address", "created_at", "updated_at",
    ]
    records = [
        {field: record[field] for field in fieldnames}
        for record in (_place_data(db, place) for place in places)
    ]
    output = io.StringIO(newline="")
    writer = csv.DictWriter(
        output,
        fieldnames=fieldnames,
    )
    writer.writeheader()
    writer.writerows(records)
    return output.getvalue()