import uuid
from sqlalchemy import Column, String, Boolean, ForeignKey, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base

class Customer(Base):
    __tablename__ = "customers"

    cust_id       = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cust_name     = Column(String(255), nullable=False)
    short_name    = Column(String(50))
    customer_id   = Column(String(30), unique=True, nullable=False)
    reg_token     = Column(String(100), unique=True)
    cust_type     = Column(String(20), nullable=False)
    reg_type      = Column(String(20), default="open")
    hierarchy_required = Column(Boolean, default=True)
    is_active     = Column(Boolean, default=True)
    reg_expires_at = Column(DateTime(timezone=True))
    address       = Column(String)
    contact_email = Column(String(255))
    contact_number = Column(String(20))
    created_by    = Column(UUID(as_uuid=True), ForeignKey("users.user_id"))
    created_at    = Column(DateTime(timezone=True), server_default=func.now())
    updated_at    = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    users = relationship("User", back_populates="customer", foreign_keys="User.customer_id")


class User(Base):
    __tablename__ = "users"

    user_id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    full_name         = Column(String(255), nullable=False)
    email             = Column(String(255), unique=True)
    phone             = Column(String(20), unique=True)
    password_hash     = Column(String(255))
    customer_id       = Column(UUID(as_uuid=True), ForeignKey("customers.cust_id"), nullable=False)
    role_id           = Column(UUID(as_uuid=True), ForeignKey("roles.role_id"), nullable=False)
    hierarchy_node_id = Column(UUID(as_uuid=True), ForeignKey("hierarchy_nodes.node_id"))
    status            = Column(String(20), default="pending")
    verify_method     = Column(String(10))
    email_verified    = Column(Boolean, default=False)
    phone_verified    = Column(Boolean, default=False)
    bypass_org_scope  = Column(Boolean, default=False)
    last_login_at     = Column(DateTime(timezone=True))
    created_at        = Column(DateTime(timezone=True), server_default=func.now())
    updated_at        = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    customer = relationship("Customer", back_populates="users", foreign_keys=[customer_id])
    role     = relationship("Role", back_populates="users")
