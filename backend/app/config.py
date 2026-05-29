from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # App
    APP_ENV: str = "development"
    APP_NAME: str = "Krishi Hrudya"
    FRONTEND_URL: str = "http://localhost:3000"

    # Database — Business data (PostgreSQL)
    DATABASE_URL: str

    # Database — Sensor data (TimescaleDB)
    TIMESCALE_URL: str

    # Database — Legacy cPanel MySQL (read-only)
    LEGACY_DB_HOST: str
    LEGACY_DB_PORT: int = 3306
    LEGACY_DB_NAME: str
    LEGACY_DB_USER: str
    LEGACY_DB_PASSWORD: str

    # Redis
    REDIS_URL: str

    # JWT
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Token expiry
    SETUP_TOKEN_EXPIRE_MINUTES: int = 30
    RESET_TOKEN_EXPIRE_MINUTES: int = 15

    # OTP
    OTP_EXPIRE_MINUTES: int = 10
    OTP_COOLDOWN_SECONDS: int = 60

    # Email (Resend)
    RESEND_API_KEY: str = ""

    # SMS (2Factor)
    TWOFACTOR_API_KEY: str = ""

    class Config:
        env_file = ".env"


settings = Settings()

