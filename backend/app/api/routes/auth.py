from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import create_access_token, decode_access_token
from app.db.database import get_db
from app.models.user import User
from app.schemas.user import (
    AdminUserCreate,
    AdminUserUpdate,
    LoginRequest,
    TokenResponse,
    UserCreate,
    UserRead,
)
from app.services.auth_service import (
    authenticate_user,
    create_admin_managed_user,
    delete_admin_managed_user,
    register_user,
    update_admin_managed_user,
)

router = APIRouter()
bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required or access token is invalid.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None:
        raise unauthorized
    try:
        claims = decode_access_token(credentials.credentials)
        subject = claims.get("sub")
        if not isinstance(subject, str):
            raise ValueError("Token subject is missing.")
        user_id = int(subject)
    except (ValueError, TypeError):
        raise unauthorized from None
    user = db.get(User, user_id)
    if user is None:
        raise unauthorized
    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required.",
        )
    return current_user


@router.post(
    "/register",
    response_model=UserRead,
    status_code=status.HTTP_201_CREATED,
    summary="Register a user",
    description="Create an account using the name, email, and password submitted by the React client.",
)
def register(payload: UserCreate, db: Session = Depends(get_db)) -> User:
    try:
        return register_user(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        ) from exc


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Log in",
    description="Exchange JSON email and password credentials for a bearer access token.",
)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = authenticate_user(db, str(payload.email), payload.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return TokenResponse(access_token=create_access_token(str(user.id)), user=user)


@router.get(
    "/me",
    response_model=UserRead,
    summary="Get the current user",
    description="Return the profile associated with the supplied bearer access token.",
)
def read_current_user(
    current_user: User = Depends(get_current_user),
) -> User:
    return current_user


@router.get(
    "/admin/users",
    response_model=list[UserRead],
    summary="List registered users",
    description="Return all registered accounts to an authenticated admin user.",
)
def list_users(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> list[User]:
    return db.query(User).order_by(User.id).all()


@router.post(
    "/admin/users",
    response_model=UserRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a user account",
    description="Create a user or admin account for an authenticated admin user.",
)
def create_admin_managed_account(
    payload: AdminUserCreate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> User:
    try:
        return create_admin_managed_user(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        ) from exc


@router.patch(
    "/admin/users/{user_id}",
    response_model=UserRead,
    summary="Update a user account",
    description="Update a user's name, email, and role as an authenticated admin.",
)
def update_admin_managed_account(
    user_id: int,
    payload: AdminUserUpdate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> User:
    target_user = db.get(User, user_id)
    if target_user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    try:
        return update_admin_managed_user(db, target_user, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        ) from exc


@router.delete(
    "/admin/users/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a user account",
    description="Delete an account when it has no owned places and is not the last admin.",
)
def delete_admin_managed_account(
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
) -> None:
    target_user = db.get(User, user_id)
    if target_user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    if target_user.id == current_admin.id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You cannot delete your own account.",
        )
    try:
        delete_admin_managed_user(db, target_user)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The account cannot be deleted while related records still exist.",
        ) from exc