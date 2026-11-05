from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.routes.auth import get_current_user
from app.db.database import get_db
from app.models.favorite import Favorite
from app.models.place import Place
from app.models.user import User
from app.schemas.place import PlaceRead
from app.services.place_service import get_place

router = APIRouter()


@router.get("", response_model=list[PlaceRead], summary="List favorite places")
def list_favorites(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[PlaceRead]:
    query = (
        select(Favorite)
        .join(Place, Favorite.place_id == Place.id)
        .where(Favorite.user_id == current_user.id)
    )
    if current_user.role != "admin":
        query = query.where(Place.owner_id == current_user.id)
    favorites = db.scalars(query.order_by(Favorite.created_at.desc())).all()
    items: list[PlaceRead] = []
    for favorite in favorites:
        place_data = get_place(db, favorite.place_id)
        if place_data is not None:
            items.append(PlaceRead.model_validate(place_data))
    return items


@router.post(
    "/{place_id}",
    response_model=PlaceRead,
    status_code=status.HTTP_201_CREATED,
    summary="Save a place to favorites",
)
def add_favorite(
    place_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PlaceRead:
    place = db.get(Place, place_id)
    if place is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Place not found.")
    if current_user.role != "admin" and place.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only favorite places you own.",
        )

    existing = db.scalar(
        select(Favorite).where(
            Favorite.user_id == current_user.id,
            Favorite.place_id == place_id,
        )
    )
    if existing is not None:
        place_data = get_place(db, place_id)
        if place_data is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Place not found.")
        return PlaceRead.model_validate(place_data)

    favorite = Favorite(user_id=current_user.id, place_id=place_id)
    db.add(favorite)
    db.commit()
    db.refresh(favorite)

    place_data = get_place(db, place_id)
    if place_data is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Place not found.")
    return PlaceRead.model_validate(place_data)


@router.delete(
    "/{place_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove a place from favorites",
)
def remove_favorite(
    place_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    favorite = db.scalar(
        select(Favorite).where(
            Favorite.user_id == current_user.id,
            Favorite.place_id == place_id,
        )
    )
    if favorite is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Favorite not found.",
        )
    db.delete(favorite)
    db.commit()
