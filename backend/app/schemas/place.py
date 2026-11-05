from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class PlaceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=10000)
    category: str = Field(min_length=1, max_length=100)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    address: str | None = Field(default=None, max_length=500)

    @field_validator("name", "category", "address")
    @classmethod
    def strip_text(cls, value: str | None) -> str | None:
        return value.strip() if value is not None else None

    @field_validator("name", "category")
    @classmethod
    def require_nonempty_text(cls, value: str) -> str:
        if not value:
            raise ValueError("This field must not be blank.")
        return value


class PlaceUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=10000)
    category: str | None = Field(default=None, min_length=1, max_length=100)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    address: str | None = Field(default=None, max_length=500)

    @field_validator("name", "category", "address")
    @classmethod
    def strip_text(cls, value: str | None) -> str | None:
        return value.strip() if value is not None else None

    @field_validator("name", "category")
    @classmethod
    def require_nonempty_text(cls, value: str | None) -> str:
        if value is None or not value:
            raise ValueError("This field must not be blank.")
        return value

    @field_validator("latitude", "longitude")
    @classmethod
    def require_coordinate(cls, value: float | None) -> float:
        if value is None:
            raise ValueError("Coordinates must not be null.")
        return value


class PlaceRead(BaseModel):
    id: int
    name: str
    description: str | None
    category: str
    latitude: float
    longitude: float
    address: str | None
    owner_id: int | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PlaceList(BaseModel):
    items: list[PlaceRead]
    total: int
    limit: int
    offset: int


class NearbyPlace(PlaceRead):
    distance_meters: float


class GeoJSONGeometry(BaseModel):
    type: str
    coordinates: list[Any]


class PolygonSearchRequest(BaseModel):
    type: str = "Polygon"
    coordinates: list[list[list[float]]]

    @model_validator(mode="after")
    def validate_polygon(self) -> "PolygonSearchRequest":
        if self.type != "Polygon":
            raise ValueError("Geometry type must be Polygon.")
        if not self.coordinates:
            raise ValueError("Polygon must contain at least one linear ring.")
        for ring in self.coordinates:
            if len(ring) < 4:
                raise ValueError("Each polygon ring must contain at least four positions.")
            if ring[0] != ring[-1]:
                raise ValueError("Each polygon ring must be closed.")
            distinct_positions: set[tuple[float, float]] = set()
            for position in ring:
                if len(position) < 2:
                    raise ValueError("Each position must include longitude and latitude.")
                longitude, latitude = position[:2]
                if not -180 <= longitude <= 180 or not -90 <= latitude <= 90:
                    raise ValueError(
                        "Polygon coordinates are outside valid longitude/latitude bounds."
                    )
                distinct_positions.add((longitude, latitude))
            if len(distinct_positions) < 3:
                raise ValueError("Each polygon ring must contain at least three distinct positions.")
        return self


class GeoJSONFeature(BaseModel):
    type: str = "Feature"
    geometry: GeoJSONGeometry
    properties: dict[str, Any] = Field(default_factory=dict)
    id: int | str | None = None


class GeoJSONFeatureCollection(BaseModel):
    type: str = "FeatureCollection"
    features: list[GeoJSONFeature]


class ImportResult(BaseModel):
    successful_count: int
    failed_count: int
    errors: list[str]