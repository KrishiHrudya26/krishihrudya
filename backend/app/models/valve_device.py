import uuid
from sqlalchemy import Column, String, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class ValveDevice(Base):
    __tablename__ = "valve_devices"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    uid        = Column(String(64), unique=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
