from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.user import Customer
from app.models.hierarchy import HierarchyLevel, HierarchyNode
from app.models.role import Role

router = APIRouter(prefix="/onboarding", tags=["Onboarding"])


@router.get("/validate-code/{customer_code}")
async def validate_customer_code(customer_code: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Customer).where(
            Customer.customer_id == customer_code,
            Customer.is_active == True,
        )
    )
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Invalid or inactive customer code")

    return {
        "cust_id": str(customer.cust_id),
        "cust_name": customer.cust_name,
        "cust_type": customer.cust_type,
        "hierarchy_required": customer.hierarchy_required,
    }


@router.get("/hierarchy/{cust_id}")
async def get_hierarchy(cust_id: str, db: AsyncSession = Depends(get_db)):
    levels_result = await db.execute(
        select(HierarchyLevel)
        .where(HierarchyLevel.customer_id == cust_id)
        .order_by(HierarchyLevel.level_order)
    )
    levels = levels_result.scalars().all()

    nodes_result = await db.execute(
        select(HierarchyNode)
        .where(
            HierarchyNode.customer_id == cust_id,
            HierarchyNode.is_active == True,
        )
    )
    nodes = nodes_result.scalars().all()

    return {
        "levels": [
            {"level_id": str(l.level_id), "name": l.name, "level_order": l.level_order}
            for l in levels
        ],
        "nodes": [
            {
                "node_id": str(n.node_id),
                "level_id": str(n.level_id),
                "parent_id": str(n.parent_id) if n.parent_id else None,
                "name": n.name,
            }
            for n in nodes
        ],
    }

@router.get("/roles/{cust_id}")
async def get_roles_for_customer(cust_id: str, db: AsyncSession = Depends(get_db)):
    cust_result = await db.execute(
        select(Customer).where(Customer.cust_id == cust_id)
    )
    customer = cust_result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    result = await db.execute(
        select(Role).where(
            Role.customer_type == customer.cust_type,
            Role.slug != "master_admin",
        )
    )
    roles = result.scalars().all()
    return [
        {"role_id": str(r.role_id), "name": r.name, "slug": r.slug}
        for r in roles
    ]
@router.get("/roles/{cust_id}")
async def get_roles_for_customer(cust_id: str, db: AsyncSession = Depends(get_db)):
    cust_result = await db.execute(
        select(Customer).where(Customer.cust_id == cust_id)
    )
    customer = cust_result.scalar_one_or_none()

    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    result = await db.execute(
        select(Role).where(
            Role.customer_type == customer.cust_type,
            Role.slug != "master_admin",
        )
    )

    roles = result.scalars().all()

    return [
        {
            "role_id": str(r.role_id),
            "name": r.name,
            "slug": r.slug,
            "hierarchy_level": r.hierarchy_level,
        }
        for r in roles
    ]
