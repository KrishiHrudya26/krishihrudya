import uuid
from sqlalchemy import Column, String, Boolean, Integer, SmallInteger, ForeignKey, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base

class Role(Base):
    __tablename__ = "roles"

    role_id        = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name           = Column(String(100), nullable=False)
    slug           = Column(String(50), unique=True, nullable=False)
    customer_type  = Column(String(20))
    is_kh_internal = Column(Boolean, default=False)
    hierarchy_level = Column(Integer)
    description    = Column(String)
    created_at     = Column(DateTime(timezone=True), server_default=func.now())

    users       = relationship("User", back_populates="role")
    permissions = relationship("RolePermission", back_populates="role", uselist=False)


class RolePermission(Base):
    __tablename__ = "role_permissions"

    id      = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    role_id = Column(UUID(as_uuid=True), ForeignKey("roles.role_id"), unique=True, nullable=False)

    dashboard_access        = Column(SmallInteger, default=0)
    reports_view            = Column(SmallInteger, default=0)
    reports_export          = Column(SmallInteger, default=0)
    reports_query           = Column(SmallInteger, default=0)
    users_add               = Column(SmallInteger, default=0)
    users_edit              = Column(SmallInteger, default=0)
    users_delete            = Column(SmallInteger, default=0)
    roles_add               = Column(SmallInteger, default=0)
    roles_edit              = Column(SmallInteger, default=0)
    roles_delete            = Column(SmallInteger, default=0)
    customers_add           = Column(SmallInteger, default=0)
    customers_edit          = Column(SmallInteger, default=0)
    customers_delete        = Column(SmallInteger, default=0)
    access_tokens_assign    = Column(SmallInteger, default=0)
    role_permissions_assign = Column(SmallInteger, default=0)
    devices_assign          = Column(SmallInteger, default=0)
    devices_edit            = Column(SmallInteger, default=0)
    devices_delete          = Column(SmallInteger, default=0)
    hierarchy_view          = Column(SmallInteger, default=0)
    hierarchy_manage        = Column(SmallInteger, default=0)
    farms_manage            = Column(SmallInteger, default=0)
    settings_basic          = Column(SmallInteger, default=0)
    settings_advanced       = Column(SmallInteger, default=0)
    analytics_access        = Column(SmallInteger, default=0)
    motor_control           = Column(SmallInteger, default=0)
    event_logs_view         = Column(SmallInteger, default=0)
    products_add            = Column(SmallInteger, default=0)
    categories_manage       = Column(SmallInteger, default=0)
    products_test_status    = Column(SmallInteger, default=0)
    meta_tables_manage      = Column(SmallInteger, default=0)
    dealer_manage           = Column(SmallInteger, default=0)
    commission_approve      = Column(SmallInteger, default=0)
    audit_logs_view         = Column(SmallInteger, default=0)
    notifications_manage    = Column(SmallInteger, default=0)
    sim_manage           = Column(SmallInteger, default=0)
    services_manage      = Column(SmallInteger, default=0)
    services_view        = Column(SmallInteger, default=0)
    orders_manage        = Column(SmallInteger, default=0)
    content_manage       = Column(SmallInteger, default=0)
    installations_manage = Column(SmallInteger, default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    role = relationship("Role", back_populates="permissions")
