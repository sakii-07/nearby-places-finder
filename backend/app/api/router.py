from fastapi import APIRouter

from app.api.routes import auth, favorites, places

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(places.router, prefix="/places", tags=["Places"])
api_router.include_router(favorites.router, prefix="/favorites", tags=["Favorites"])