from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.models.favorite import Favorite
from app.models.place import Place
from app.models.user import User
from app.schemas.user import AdminUserCreate, AdminUserUpdate, UserCreate


def _create_user(
    db: Session, *, name: str, email: str, password: str, role: str
) -> User:
    email = email.lower()
    existing_user = db.scalar(select(User).where(User.email == email))
    if existing_user is not None:
        raise ValueError("An account with this email already exists.")

    user = User(
        name=name,
        email=email,
        hashed_password=hash_password(password),
        role=role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def register_user(db: Session, user_data: UserCreate) -> User:
    return _create_user(
        db,
        name=user_data.name,
        email=str(user_data.email),
        password=user_data.password,
        role="user",
    )


def create_admin_managed_user(db: Session, user_data: AdminUserCreate) -> User:
    return _create_user(
        db,
        name=user_data.name,
        email=str(user_data.email),
        password=user_data.password,
        role=user_data.role,
    )


def update_admin_managed_user(
    db: Session, user: User, user_data: AdminUserUpdate
) -> User:
    email = str(user_data.email).lower()
    existing_user = db.scalar(
        select(User).where(
            func.lower(User.email) == email,
            User.id != user.id,
        )
    )
    if existing_user is not None:
        raise ValueError("An account with this email already exists.")

    if user.role == "admin" and user_data.role != "admin":
        admins = db.scalars(
            select(User)
            .where(User.role == "admin")
            .order_by(User.id)
            .with_for_update()
        ).all()
        if len(admins) <= 1:
            raise ValueError("The last remaining admin account cannot be demoted.")

    user.name = user_data.name
    user.email = email
    user.role = user_data.role
    db.commit()
    db.refresh(user)
    return user


def delete_admin_managed_user(db: Session, user: User) -> None:
    if user.role == "admin":
        admins = db.scalars(
            select(User)
            .where(User.role == "admin")
            .order_by(User.id)
            .with_for_update()
        ).all()
        if len(admins) <= 1:
            raise ValueError("The last remaining admin account cannot be deleted.")

    owned_place_count = db.scalar(
        select(func.count()).select_from(Place).where(Place.owner_id == user.id)
    )
    if owned_place_count:
        raise ValueError(
            "This user owns places. Reassign or remove those places before deleting the account."
        )

    db.execute(delete(Favorite).where(Favorite.user_id == user.id))
    db.execute(delete(User).where(User.id == user.id))
    db.commit()


def create_admin_user(db: Session, *, name: str, email: str, password: str) -> User:
    normalized_email = email.lower()
    if db.scalar(select(User).where(User.email == normalized_email)) is not None:
        raise ValueError("An account with this email already exists.")
    if db.scalar(select(User).where(User.role == "admin")) is not None:
        raise ValueError("An admin account already exists.")

    admin = User(
        name=name,
        email=normalized_email,
        hashed_password=hash_password(password),
        role="admin",
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)
    return admin


def authenticate_user(db: Session, email: str, password: str) -> User | None:
    user = db.scalar(select(User).where(User.email == email.lower()))
    if user is None or not verify_password(password, user.hashed_password):
        return None
    return user