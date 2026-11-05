import csv
import io
import json

import pytest
from pydantic import ValidationError

from app.core import security
from app.schemas.place import PlaceCreate, PlaceUpdate, PolygonSearchRequest
from app.services import place_service
from app.services.place_service import export_csv, parse_csv_import, parse_geojson_import


def test_password_hash_and_jwt_round_trip(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(security.settings, "secret_key", "test-secret-key-with-at-least-32-characters")
    password_hash = security.hash_password("correct horse battery")

    assert password_hash != "correct horse battery"
    assert security.verify_password("correct horse battery", password_hash)
    assert not security.verify_password("incorrect password", password_hash)

    token = security.create_access_token("42")
    assert security.decode_access_token(token)["sub"] == "42"


def test_place_schema_rejects_invalid_coordinates() -> None:
    with pytest.raises(ValidationError):
        PlaceCreate(name="Invalid", category="Test", latitude=91, longitude=0)

    with pytest.raises(ValidationError):
        PlaceUpdate(name=None)

    with pytest.raises(ValidationError):
        PlaceUpdate(latitude=None)


def test_polygon_requires_closed_ring() -> None:
    with pytest.raises(ValidationError):
        PolygonSearchRequest(
            coordinates=[[[0, 0], [1, 0], [1, 1], [0, 1]]]
        )


def test_polygon_requires_three_distinct_positions() -> None:
    with pytest.raises(ValidationError, match="at least three distinct positions"):
        PolygonSearchRequest(
            coordinates=[
                [
                    [73.8567, 18.5204],
                    [73.8567, 18.5204],
                    [73.8567, 18.5204],
                    [73.8567, 18.5204],
                ]
            ]
        )


def test_polygon_accepts_closed_longitude_latitude_ring() -> None:
    polygon = PolygonSearchRequest(
        coordinates=[
            [
                [73.84, 18.50],
                [73.87, 18.50],
                [73.87, 18.54],
                [73.84, 18.54],
                [73.84, 18.50],
            ]
        ]
    )

    assert polygon.coordinates[0][0] == polygon.coordinates[0][-1]


def test_csv_import_reports_bad_rows_and_keeps_valid_rows() -> None:
    valid, errors = parse_csv_import(
        b"name,category,latitude,longitude\nCafe,Coffee,37.7,-122.4\nBad,Park,91,0\n"
    )

    assert len(valid) == 1
    assert valid[0].name == "Cafe"
    assert len(errors) == 1
    assert errors[0].startswith("Row 3:")


def test_csv_export_includes_place_fields_without_internal_owner_id(monkeypatch: pytest.MonkeyPatch) -> None:
    place_data = {
        "id": 7,
        "name": "Cafe",
        "description": None,
        "category": "Coffee",
        "latitude": 37.7,
        "longitude": -122.4,
        "address": None,
        "owner_id": 3,
        "created_at": "2026-01-01T00:00:00",
        "updated_at": "2026-01-01T00:00:00",
    }

    class FakeResult:
        def all(self) -> list[object]:
            return [object()]

    class FakeDB:
        def scalars(self, _statement: object) -> FakeResult:
            return FakeResult()

    monkeypatch.setattr(place_service, "_place_data", lambda _db, _place: place_data)
    exported = export_csv(FakeDB())
    rows = list(csv.DictReader(io.StringIO(exported)))

    assert rows[0]["name"] == "Cafe"
    assert rows[0]["latitude"] == "37.7"
    assert "owner_id" not in rows[0]


def test_geojson_import_reads_longitude_latitude_order() -> None:
    document = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [-122.4, 37.7]},
                "properties": {"name": "Cafe", "category": "Coffee"},
            }
        ],
    }

    valid, errors = parse_geojson_import(json.dumps(document).encode())

    assert not errors
    assert valid[0].longitude == -122.4
    assert valid[0].latitude == 37.7
