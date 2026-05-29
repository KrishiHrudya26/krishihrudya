from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from app.config import settings
from urllib.parse import quote_plus


# kh_business
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

# kh_sensors (TimescaleDB)
sensor_engine = create_async_engine(
    settings.TIMESCALE_URL,
    echo=False,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

SensorSessionLocal = async_sessionmaker(
    bind=sensor_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

class Base(DeclarativeBase):
    pass

async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

async def get_sensor_db():
    async with SensorSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

# Legacy cPanel MySQL (read-only)
legacy_engine = create_async_engine(
    f"mysql+aiomysql://{settings.LEGACY_DB_USER}:{quote_plus(settings.LEGACY_DB_PASSWORD)}"
    f"@{settings.LEGACY_DB_HOST}:{settings.LEGACY_DB_PORT}/{settings.LEGACY_DB_NAME}",
    echo=False,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
)

LegacySessionLocal = async_sessionmaker(
    bind=legacy_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

async def get_legacy_db():
    async with LegacySessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()