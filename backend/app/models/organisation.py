import uuid
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, Text, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class Organisation(Base):
    __tablename__ = "organisations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    type: Mapped[str] = mapped_column(String(50), nullable=False)  # govt | institutional | corporate | b2c
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    hierarchy_levels: Mapped[list["HierarchyLevel"]] = relationship(
        "HierarchyLevel", back_populates="organisation"
    )
    hierarchy_nodes: Mapped[list["HierarchyNode"]] = relationship(
        "HierarchyNode", back_populates="organisation"
    )
    users: Mapped[list["User"]] = relationship("User", back_populates="organisation")
    invites: Mapped[list["OrganisationInvite"]] = relationship(
        "OrganisationInvite", back_populates="organisation"
    )


class HierarchyLevel(Base):
    """
    Blueprint/template — defines WHAT levels exist in an org.
    e.g. Level 1 = Chief Engineer, Level 2 = Exec Engineer, Level 3 = Waterman
    """
    __tablename__ = "hierarchy_levels"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organisation_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organisations.id"), nullable=False)
    level_number: Mapped[int] = mapped_column(Integer, nullable=False)  # 1 = top
    level_name: Mapped[str] = mapped_column(String(100), nullable=False)
    can_manage_assets: Mapped[bool] = mapped_column(Boolean, default=False)  # true only at leaf level
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    organisation: Mapped["Organisation"] = relationship("Organisation", back_populates="hierarchy_levels")
    nodes: Mapped[list["HierarchyNode"]] = relationship("HierarchyNode", back_populates="level")


class HierarchyNode(Base):
    """
    Actual instances — the real divisions/zones/offices in the tree.
    e.g. "Cauvery Division" at Executive Engineer level under Karnataka PWD
    """
    __tablename__ = "hierarchy_nodes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organisation_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organisations.id"), nullable=False)
    level_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("hierarchy_levels.id"), nullable=False)
    parent_node_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("hierarchy_nodes.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    organisation: Mapped["Organisation"] = relationship("Organisation", back_populates="hierarchy_nodes")
    level: Mapped["HierarchyLevel"] = relationship("HierarchyLevel", back_populates="nodes")

    # Self-referential — a node can have a parent node
    parent: Mapped["HierarchyNode | None"] = relationship("HierarchyNode", remote_side="HierarchyNode.id", back_populates="children")
    children: Mapped[list["HierarchyNode"]] = relationship("HierarchyNode", back_populates="parent")
    users: Mapped[list["User"]] = relationship("User", back_populates="hierarchy_node")


class OrganisationInvite(Base):
    __tablename__ = "organisation_invites"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organisation_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organisations.id"), nullable=False)
    invited_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    phone_or_email: Mapped[str] = mapped_column(String(200), nullable=False)
    hierarchy_node_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("hierarchy_nodes.id"), nullable=False)
    token: Mapped[str] = mapped_column(String(200), unique=True, nullable=False)
    is_used: Mapped[bool] = mapped_column(Boolean, default=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    organisation: Mapped["Organisation"] = relationship("Organisation", back_populates="invites")
    inviter: Mapped["User"] = relationship("User", foreign_keys=[invited_by])
    hierarchy_node: Mapped["HierarchyNode"] = relationship("HierarchyNode")
