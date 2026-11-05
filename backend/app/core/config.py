from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    app_name: str = "Nearby Places Finder API"
    api_prefix: str = "/api"
    database_url: str = "postgresql+psycopg2://postgres@localhost:5432/nearby_places_db"
    secret_key: str = ""
    access_token_expire_minutes: int = 60
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
        "http://localhost:4174",
        "http://127.0.0.1:4174",
    ]
    cors_origin_regex: str = r"http://(localhost|127\.0\.0\.1):(417\d+|517\d+)$"

    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


settings = Settings()