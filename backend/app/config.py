from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    app_name: str = "DPM ONE API"
    app_env: str = "development"
    database_url: str = "sqlite:///./dpmone.db"
    cors_origins: str = "http://localhost:3000"
    jwt_secret_key: str = "DEV_ONLY_CHANGE_THIS_SECRET_BEFORE_DEPLOYMENT"
    access_token_expire_minutes: int = 30
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

settings = Settings()
