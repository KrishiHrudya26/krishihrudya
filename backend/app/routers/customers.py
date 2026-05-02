import uuid
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional
from pydantic import BaseModel
from app.database import get_db
from app.models.user import Customer, User
from app.models.hierarchy import HierarchyLevel, HierarchyNode
from app.models.role import Role
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/customers", tags=["Customers"])
bearer = HTTPBearer()


# ── Schemas ───────────────────────────────────────────────
class CustomerCreate(BaseModel):
    cust_name:          str
    short_name:         Optional[str] = None
    cust_type:          str  # b2g, b2c, b2b, internal, collaborator, demo, dealer
    state_code:         str  # 2-digit GST state code e.g. 29 for Karnataka
    reg_type:           str = "approval_required"
    hierarchy_required: bool = True
    contact_email:      Optional[str] = None
    contact_number:     Optional[str] = None
    address:            Optional[str] = None

class CustomerUpdate(BaseModel):
    cust_name:          Optional[str] = None
    short_name:         Optional[str] = None
    contact_email:      Optional[str] = None
    contact_number:     Optional[str] = None
    address:            Optional[str] = None
    reg_type:           Optional[str] = None
    hierarchy_required: Optional[bool] = None
    is_active:          Optional[bool] = None


# ── Helper — generate customer ID ─────────────────────────
TYPE_CODE = {
    "b2c":         "C",
    "b2g":         "G",
    "b2b":         "B",
    "internal":    "I",
    "collaborator":"L",
    "demo":        "D",
    "dealer":      "R",
}

async def generate_customer_id(state_code: str, cust_type: str, db: AsyncSession) -> str:
    year = str(__import__('datetime').datetime.now().year)[2:]
    type_char = TYPE_CODE.get(cust_type, "X")
    prefix = f"K{state_code}{type_char}{year}"

    # Find highest existing sequence for this prefix
    result = await db.execute(
        select(Customer.customer_id)
        .where(Customer.customer_id.like(f"{prefix}%"))
        .order_by(Customer.customer_id.desc())
    )
    existing = result.scalars().all()
    if existing:
        last_seq = int(existing[0][-5:])
        new_seq = last_seq + 1
    else:
        new_seq = 1
    return f"{prefix}{str(new_seq).zfill(5)}"


# ── Permission helper ─────────────────────────────────────
async def require_permission(perm: str, token: str, db: AsyncSession):
    from sqlalchemy import select
    from app.models.role import RolePermission
    user = await get_current_user(token, db)
    result = await db.execute(
        select(RolePermission).where(RolePermission.role_id == user.role_id)
    )
    perms = result.scalar_one_or_none()
    if not perms or getattr(perms, perm, 0) != 1:
        raise HTTPException(status_code=403, detail="Permission denied")
    return user


# ── Routes ────────────────────────────────────────────────

@router.get("")
async def list_customers(
    search:    Optional[str] = None,
    cust_type: Optional[str] = None,
    is_active: Optional[bool] = None,
    page:      int = 1,
    limit:     int = 20,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
):
    user = await require_permission("customers_add", credentials.credentials, db)

    query = select(Customer)
    if search:
        query = query.where(
            Customer.cust_name.ilike(f"%{search}%") |
            Customer.customer_id.ilike(f"%{search}%")
        )
    if cust_type:
        query = query.where(Customer.cust_type == cust_type)
    if is_active is not None:
        query = query.where(Customer.is_active == is_active)

    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar()

    query = query.order_by(Customer.created_at.desc()).offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    customers = result.scalars().all()

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "customers": [
            {
                "cust_id":            str(c.cust_id),
                "cust_name":          c.cust_name,
                "short_name":         c.short_name,
                "customer_id":        c.customer_id,
                "cust_type":          c.cust_type,
                "reg_type":           c.reg_type,
                "hierarchy_required": c.hierarchy_required,
                "is_active":          c.is_active,
                "contact_email":      c.contact_email,
                "contact_number":     c.contact_number,
                "address":            c.address,
                "created_at":         str(c.created_at),
            }
            for c in customers
        ]
    }


@router.post("")
async def create_customer(
    body: CustomerCreate,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
):
    user = await require_permission("customers_add", credentials.credentials, db)

    customer_id = await generate_customer_id(body.state_code, body.cust_type, db)

    customer = Customer(
        cust_id=uuid.uuid4(),
        cust_name=body.cust_name,
        short_name=body.short_name,
        customer_id=customer_id,
        reg_token=__import__('secrets').token_urlsafe(32),
        cust_type=body.cust_type,
        reg_type=body.reg_type,
        hierarchy_required=body.hierarchy_required,
        is_active=True,
        contact_email=body.contact_email,
        contact_number=body.contact_number,
        address=body.address,
        created_by=user.user_id,
    )
    db.add(customer)
    await db.commit()

    return {
        "message":     "Customer created successfully",
        "cust_id":     str(customer.cust_id),
        "customer_id": customer.customer_id,
    }


@router.get("/{cust_id}")
async def get_customer(
    cust_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
):
    await require_permission("customers_add", credentials.credentials, db)

    result = await db.execute(
        select(Customer).where(Customer.cust_id == cust_id)
    )
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    # Get user count
    user_count_result = await db.execute(
        select(func.count(User.user_id)).where(User.customer_id == customer.cust_id)
    )
    user_count = user_count_result.scalar()

    # Get hierarchy summary
    levels_result = await db.execute(
        select(HierarchyLevel).where(HierarchyLevel.customer_id == customer.cust_id)
        .order_by(HierarchyLevel.level_order)
    )
    levels = levels_result.scalars().all()

    nodes_result = await db.execute(
        select(HierarchyNode).where(HierarchyNode.customer_id == customer.cust_id)
    )
    nodes = nodes_result.scalars().all()

    return {
        "cust_id":            str(customer.cust_id),
        "cust_name":          customer.cust_name,
        "short_name":         customer.short_name,
        "customer_id":        customer.customer_id,
        "reg_token":          customer.reg_token,
        "cust_type":          customer.cust_type,
        "reg_type":           customer.reg_type,
        "hierarchy_required": customer.hierarchy_required,
        "is_active":          customer.is_active,
        "contact_email":      customer.contact_email,
        "contact_number":     customer.contact_number,
        "address":            customer.address,
        "created_at":         str(customer.created_at),
        "user_count":         user_count,
        "hierarchy": {
            "levels": [{"level_id": str(l.level_id), "name": l.name, "level_order": l.level_order} for l in levels],
            "nodes":  [{"node_id": str(n.node_id), "level_id": str(n.level_id), "parent_id": str(n.parent_id) if n.parent_id else None, "name": n.name} for n in nodes],
        }
    }


@router.put("/{cust_id}")
async def update_customer(
    cust_id: str,
    body: CustomerUpdate,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
):
    await require_permission("customers_edit", credentials.credentials, db)

    result = await db.execute(select(Customer).where(Customer.cust_id == cust_id))
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(customer, field, value)

    await db.commit()
    return {"message": "Customer updated successfully"}


@router.delete("/{cust_id}")
async def deactivate_customer(
    cust_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
):
    await require_permission("customers_delete", credentials.credentials, db)

    result = await db.execute(select(Customer).where(Customer.cust_id == cust_id))
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    customer.is_active = False
    await db.commit()
    return {"message": "Customer deactivated"}


# ── Hierarchy Management ──────────────────────────────────

class LevelCreate(BaseModel):
    name:        str
    level_order: int

class NodeCreate(BaseModel):
    level_id:  str
    parent_id: Optional[str] = None
    name:      str


@router.post("/{cust_id}/hierarchy/levels")
async def add_hierarchy_level(
    cust_id: str,
    body: LevelCreate,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
):
    await require_permission("hierarchy_manage", credentials.credentials, db)

    level = HierarchyLevel(
        level_id=uuid.uuid4(),
        customer_id=cust_id,
        name=body.name,
        level_order=body.level_order,
    )
    db.add(level)
    await db.commit()
    return {"message": "Level added", "level_id": str(level.level_id)}


@router.post("/{cust_id}/hierarchy/nodes")
async def add_hierarchy_node(
    cust_id: str,
    body: NodeCreate,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
):
    await require_permission("hierarchy_manage", credentials.credentials, db)

    node = HierarchyNode(
        node_id=uuid.uuid4(),
        customer_id=cust_id,
        level_id=body.level_id,
        parent_id=body.parent_id,
        name=body.name,
    )
    db.add(node)
    await db.commit()
    return {"message": "Node added", "node_id": str(node.node_id)}


@router.delete("/{cust_id}/hierarchy/levels/{level_id}")
async def delete_hierarchy_level(
    cust_id: str,
    level_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
):
    await require_permission("hierarchy_manage", credentials.credentials, db)

    result = await db.execute(
        select(HierarchyLevel).where(
            HierarchyLevel.level_id == level_id,
            HierarchyLevel.customer_id == cust_id,
        )
    )
    level = result.scalar_one_or_none()
    if not level:
        raise HTTPException(status_code=404, detail="Level not found")

    await db.delete(level)
    await db.commit()
    return {"message": "Level deleted"}


@router.delete("/{cust_id}/hierarchy/nodes/{node_id}")
async def delete_hierarchy_node(
    cust_id: str,
    node_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
):
    await require_permission("hierarchy_manage", credentials.credentials, db)

    result = await db.execute(
        select(HierarchyNode).where(
            HierarchyNode.node_id == node_id,
            HierarchyNode.customer_id == cust_id,
        )
    )
    node = result.scalar_one_or_none()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")

    await db.delete(node)
    await db.commit()
    return {"message": "Node deleted"}