from __future__ import annotations

from dataclasses import dataclass

from geoalchemy2.elements import WKTElement
from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError

from app.db.database import SessionLocal
from app.models.place import Place
from app.schemas.place import PlaceCreate


@dataclass(frozen=True)
class PunePlace:
    name: str
    category: str
    latitude: float
    longitude: float


PLACES = (
    PunePlace("Shaniwar Wada", "Historical", 18.5195, 73.8553),
    PunePlace("Dagdusheth Ganpati", "Temple", 18.5164, 73.8567),
    PunePlace("Pune Railway Station", "Transport", 18.5289, 73.8744),
    PunePlace("Saras Baug", "Park", 18.5018, 73.8554),
    PunePlace("FC Road", "Shopping", 18.5236, 73.8417),
    PunePlace("JM Road", "Shopping", 18.5204, 73.8437),
    PunePlace("Deccan Gymkhana", "Shopping", 18.5158, 73.8402),
    PunePlace("Pune University", "Education", 18.5523, 73.8306),
    PunePlace("Fergusson College", "Education", 18.5204, 73.8410),
    PunePlace("Ruby Hall Clinic", "Hospital", 18.5367, 73.8830),
    PunePlace("Jehangir Hospital", "Hospital", 18.5288, 73.8760),
    PunePlace("Aga Khan Palace", "Historical", 18.5527, 73.9015),
    PunePlace("Osho Garden", "Park", 18.5368, 73.8940),
    PunePlace("Phoenix Marketcity", "Shopping", 18.5621, 73.9167),
    PunePlace("Shinde Chhatri", "Historical", 18.4810, 73.8980),
)


def _existing_place_id(session, name: str) -> int | None:
    return session.scalar(
        select(Place.id)
        .where(func.lower(func.trim(Place.name)) == name.casefold())
        .limit(1)
    )


def main() -> int:
    inserted = 0
    skipped = 0
    failures: list[str] = []

    with SessionLocal() as session:
        for place_data in PLACES:
            try:
                payload = PlaceCreate(
                    name=place_data.name,
                    category=place_data.category,
                    latitude=place_data.latitude,
                    longitude=place_data.longitude,
                )
                existing_id = _existing_place_id(session, payload.name)
                if existing_id is not None:
                    skipped += 1
                    print(f"Skipped existing place: {payload.name} (id={existing_id})")
                    continue

                place = Place(
                    name=payload.name,
                    category=payload.category,
                    description=payload.description,
                    address=payload.address,
                    location=WKTElement(
                        f"POINT({payload.longitude} {payload.latitude})",
                        srid=4326,
                    ),
                )
                session.add(place)
                session.commit()
                inserted += 1
                print(f"Inserted: {payload.name} (id={place.id})")
            except (SQLAlchemyError, ValidationError) as error:
                session.rollback()
                failures.append(f"{place_data.name}: {error}")

    print(
        f"Seed complete: inserted={inserted}, already_present={skipped}, "
        f"failed={len(failures)}, requested={len(PLACES)}"
    )
    for failure in failures:
        print(f"FAILED: {failure}")

    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
