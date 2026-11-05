from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, StringConstraints


class UserCreate(BaseModel):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
    email: EmailStr
    password: Annotated[str, StringConstraints(min_length=8, max_length=128)]
    role: str = Field(default="user", min_length=1, max_length=20)


class AdminUserCreate(BaseModel):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
    email: EmailStr
    password: Annotated[str, StringConstraints(min_length=8, max_length=128)]
    role: Literal["user", "admin"] = "user"


class AdminUserUpdate(BaseModel):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
    email: EmailStr
    role: Literal["user", "admin"]


class UserRead(BaseModel):
    id: int
    name: str
    email: EmailStr
    role: str = "user"
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LoginRequest(BaseModel):
    email: EmailStr
    password: Annotated[str, StringConstraints(min_length=1, max_length=128)]


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead