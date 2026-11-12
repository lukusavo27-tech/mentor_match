from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://postgres:password@localhost:5432/mentormatch"
    frontend_origin: str = "http://localhost:5173"
    secret_key: str = "development-only-change-me"
    access_token_expire_minutes: int = 60

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
