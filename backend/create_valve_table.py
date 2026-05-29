import asyncio
from app.database import engine, Base
from app.models.valve_device import ValveDevice

async def create_table():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("✅ valve_devices table created successfully")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(create_table())

