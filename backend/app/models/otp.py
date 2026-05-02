import uuid
from sqlalchemy import Column, String, Boolean, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base

class OtpVerification(Base):
    __tablename__ = "otp_verifications"

    otp_id     = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    identifier = Column(String(255), nullable=False)
    otp_code   = Column(String(255), nullable=False)
    purpose    = Column(String(30), nullable=False)
    is_used    = Column(Boolean, default=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class PasswordResetToken(Base):
    __tablename__ = "password_reset_token"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email_phone = Column(String(255), nullable=False)
    token       = Column(String(255), nullable=False)
    expires_at  = Column(DateTime(timezone=True), nullable=False)
    is_used     = Column(Boolean, default=False)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
