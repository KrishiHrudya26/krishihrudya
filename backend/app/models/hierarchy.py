import uuid
from sqlalchemy import Column, String, Boolean, Integer, ForeignKey, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base

class HierarchyLevel(Base):
    __tablename__ = "hierarchy_levels"

    level_id    = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.cust_id"), nullable=False)
    name        = Column(String(100), nullable=False)
    level_order = Column(Integer, nullable=False)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    nodes = relationship("HierarchyNode", back_populates="level")


class HierarchyNode(Base):
    __tablename__ = "hierarchy_nodes"

    node_id     = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.cust_id"), nullable=False)
    level_id    = Column(UUID(as_uuid=True), ForeignKey("hierarchy_levels.level_id"), nullable=False)
    parent_id   = Column(UUID(as_uuid=True), ForeignKey("hierarchy_nodes.node_id"))
    name        = Column(String(255), nullable=False)
    is_active   = Column(Boolean, default=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    level    = relationship("HierarchyLevel", back_populates="nodes")
    children = relationship("HierarchyNode", back_populates="parent")
    parent   = relationship("HierarchyNode", back_populates="children", remote_side=[node_id])
