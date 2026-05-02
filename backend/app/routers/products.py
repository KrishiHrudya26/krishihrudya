import uuid
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from typing import Optional
from pydantic import BaseModel
from datetime import date
from app.database import get_db
from app.models.role import RolePermission
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/products", tags=["Products"])
bearer = HTTPBearer()


async def require_perm(perm: str, token: str, db: AsyncSession):
    user = await get_current_user(token, db)
    result = await db.execute(
        select(RolePermission).where(RolePermission.role_id == user.role_id)
    )
    perms = result.scalar_one_or_none()
    if not perms or getattr(perms, perm, 0) != 1:
        raise HTTPException(status_code=403, detail="Permission denied")
    return user


# ── CATEGORIES ────────────────────────────────────────────

class CategoryCreate(BaseModel):
    name:        str
    description: Optional[str] = None
    image:       Optional[str] = None

class CategoryUpdate(BaseModel):
    name:        Optional[str] = None
    description: Optional[str] = None
    image:       Optional[str] = None
    status:      Optional[str] = None


@router.get("/categories")
async def list_categories(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
):
    await require_perm("categories_manage", credentials.credentials, db)
    result = await db.execute(
        text("SELECT * FROM category ORDER BY name ASC")
    )
    rows = result.mappings().all()
    return {"categories": [dict(r) for r in rows]}


@router.post("/categories")
async def create_category(
    body: CategoryCreate,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
):
    await require_perm("categories_manage", credentials.credentials, db)
    cat_id = str(uuid.uuid4())
    await db.execute(
        text("""
            INSERT INTO category (cat_id, name, description, image, status, created_at, updated_at)
            VALUES (:cat_id, :name, :description, :image, 'active', now(), now())
        """),
        {"cat_id": cat_id, "name": body.name, "description": body.description, "image": body.image}
    )
    await db.commit()
    return {"message": "Category created", "cat_id": cat_id}


@router.put("/categories/{cat_id}")
async def update_category(
    cat_id: str,
    body: CategoryUpdate,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
):
    await require_perm("categories_manage", credentials.credentials, db)
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        return {"message": "No changes"}
    set_clause = ", ".join([f"{k} = :{k}" for k in updates.keys()])
    updates["cat_id"] = cat_id
    updates["updated_at"] = date.today().isoformat()
    await db.execute(
        text(f"UPDATE category SET {set_clause}, updated_at = now() WHERE cat_id = :cat_id"),
        updates
    )
    await db.commit()
    return {"message": "Category updated"}


@router.delete("/categories/{cat_id}")
async def delete_category(
    cat_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
):
    await require_perm("categories_manage", credentials.credentials, db)
    await db.execute(text("DELETE FROM category WHERE cat_id = :cat_id"), {"cat_id": cat_id})
    await db.commit()
    return {"message": "Category deleted"}


# ── SUB-CATEGORIES ────────────────────────────────────────

class SubCategoryCreate(BaseModel):
    cat_id:      str
    name:        str
    description: Optional[str] = None
    image:       Optional[str] = None

class SubCategoryUpdate(BaseModel):
    name:        Optional[str] = None
    description: Optional[str] = None
    image:       Optional[str] = None
    status:      Optional[str] = None


@router.get("/sub-categories")
async def list_sub_categories(
    cat_id: Optional[str] = None,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
):
    await require_perm("categories_manage", credentials.credentials, db)
    if cat_id:
        result = await db.execute(
            text("""
                SELECT s.*, c.name as cat_name
                FROM sub_category s
                JOIN category c ON c.cat_id = s.cat_id
                WHERE s.cat_id = :cat_id
                ORDER BY s.name ASC
            """),
            {"cat_id": cat_id}
        )
    else:
        result = await db.execute(
            text("""
                SELECT s.*, c.name as cat_name
                FROM sub_category s
                JOIN category c ON c.cat_id = s.cat_id
                ORDER BY c.name, s.name ASC
            """)
        )
    rows = result.mappings().all()
    return {"sub_categories": [dict(r) for r in rows]}


@router.post("/sub-categories")
async def create_sub_category(
    body: SubCategoryCreate,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
):
    await require_perm("categories_manage", credentials.credentials, db)
    sbcat_id = str(uuid.uuid4())
    await db.execute(
        text("""
            INSERT INTO sub_category (sbcat_id, cat_id, name, description, image, status, created_at, updated_at)
            VALUES (:sbcat_id, :cat_id, :name, :description, :image, 'active', now(), now())
        """),
        {"sbcat_id": sbcat_id, "cat_id": body.cat_id, "name": body.name,
         "description": body.description, "image": body.image}
    )
    await db.commit()
    return {"message": "Sub-category created", "sbcat_id": sbcat_id}


@router.put("/sub-categories/{sbcat_id}")
async def update_sub_category(
    sbcat_id: str,
    body: SubCategoryUpdate,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
):
    await require_perm("categories_manage", credentials.credentials, db)
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        return {"message": "No changes"}
    set_clause = ", ".join([f"{k} = :{k}" for k in updates.keys()])
    updates["sbcat_id"] = sbcat_id
    await db.execute(
        text(f"UPDATE sub_category SET {set_clause}, updated_at = now() WHERE sbcat_id = :sbcat_id"),
        updates
    )
    await db.commit()
    return {"message": "Sub-category updated"}


@router.delete("/sub-categories/{sbcat_id}")
async def delete_sub_category(
    sbcat_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
):
    await require_perm("categories_manage", credentials.credentials, db)
    await db.execute(text("DELETE FROM sub_category WHERE sbcat_id = :sbcat_id"), {"sbcat_id": sbcat_id})
    await db.commit()
    return {"message": "Sub-category deleted"}


# ── PRODUCTS ──────────────────────────────────────────────

class ProductCreate(BaseModel):
    uid:               str
    product_name:      str
    serial_number:     Optional[str] = None
    category_name:     Optional[str] = None
    sub_category_name: Optional[str] = None
    manufactured_date: Optional[str] = None
    price:             Optional[float] = None
    warranty:          Optional[int] = None

class ProductUpdate(BaseModel):
    product_name:      Optional[str] = None
    serial_number:     Optional[str] = None
    category_name:     Optional[str] = None
    sub_category_name: Optional[str] = None
    manufactured_date: Optional[str] = None
    price:             Optional[float] = None
    warranty:          Optional[int] = None
    status:            Optional[str] = None

class TestStatusUpdate(BaseModel):
    test_status:  str
    test_remarks: Optional[str] = None


@router.get("")
async def list_products(
    search:      Optional[str] = None,
    status:      Optional[str] = None,
    test_status: Optional[str] = None,
    category:    Optional[str] = None,
    page:        int = 1,
    limit:       int = 20,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
):
    await require_perm("products_add", credentials.credentials, db)

    conditions = ["1=1"]
    params: dict = {}

    if search:
        conditions.append("(p.uid ILIKE :search OR p.product_name ILIKE :search OR p.serial_number ILIKE :search)")
        params["search"] = f"%{search}%"
    if status:
        conditions.append("p.status = :status")
        params["status"] = status
    if test_status:
        conditions.append("p.test_status = :test_status")
        params["test_status"] = test_status
    if category:
        conditions.append("p.category_name ILIKE :category")
        params["category"] = f"%{category}%"

    where = " AND ".join(conditions)

    count_result = await db.execute(
        text(f"SELECT COUNT(*) FROM products p WHERE {where}"), params
    )
    total = count_result.scalar()

    params["limit"]  = limit
    params["offset"] = (page - 1) * limit

    result = await db.execute(
        text(f"""
            SELECT
                p.uid, p.product_name, p.serial_number,
                p.category_name, p.sub_category_name,
                p.manufactured_date, p.price, p.warranty,
                p.test_status, p.test_remarks, p.status,
                p.created_at, p.updated_at,
                i.installation_id, i.farm_id, i.pump_address,
                i.installation_date, i.subscription_end_date,
                f.farm_name,
                u.full_name as assigned_to
            FROM products p
            LEFT JOIN installations i ON i.product_uid = p.uid
            LEFT JOIN farms f ON f.farm_id = i.farm_id
            LEFT JOIN users u ON u.user_id = i.user_id
            WHERE {where}
            ORDER BY p.created_at DESC
            LIMIT :limit OFFSET :offset
        """),
        params
    )
    rows = result.mappings().all()

    return {
        "total": total,
        "page":  page,
        "limit": limit,
        "products": [
            {
                "uid":               r["uid"],
                "product_name":      r["product_name"],
                "serial_number":     r["serial_number"],
                "category_name":     r["category_name"],
                "sub_category_name": r["sub_category_name"],
                "manufactured_date": str(r["manufactured_date"]) if r["manufactured_date"] else None,
                "price":             float(r["price"]) if r["price"] else None,
                "warranty":          r["warranty"],
                "test_status":       r["test_status"],
                "test_remarks":      r["test_remarks"],
                "status":            r["status"],
                "created_at":        str(r["created_at"]),
                "is_assigned":       r["installation_id"] is not None,
                "farm_name":         r["farm_name"],
                "assigned_to":       r["assigned_to"],
                "installed_on":      str(r["installation_date"]) if r["installation_date"] else None,
                "subscription_end":  str(r["subscription_end_date"]) if r["subscription_end_date"] else None,
            }
            for r in rows
        ]
    }


@router.post("")
async def create_product(
    body: ProductCreate,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
):
    await require_perm("products_add", credentials.credentials, db)

    if len(body.uid) != 15 or not body.uid.isdigit():
        raise HTTPException(status_code=400, detail="UID must be exactly 15 digits")

    # Check duplicate
    existing = await db.execute(
        text("SELECT uid FROM products WHERE uid = :uid"), {"uid": body.uid}
    )
    if existing.mappings().first():
        raise HTTPException(status_code=409, detail="Product with this UID already exists")

    await db.execute(
        text("""
            INSERT INTO products (
                uid, product_name, serial_number,
                category_name, sub_category_name,
                manufactured_date, price, warranty,
                test_status, status, created_at, updated_at
            ) VALUES (
                :uid, :product_name, :serial_number,
                :category_name, :sub_category_name,
                :manufactured_date, :price, :warranty,
                'pending', 'active', now(), now()
            )
        """),
        {
            "uid":               body.uid,
            "product_name":      body.product_name,
            "serial_number":     body.serial_number,
            "category_name":     body.category_name,
            "sub_category_name": body.sub_category_name,
            "manufactured_date": body.manufactured_date,
            "price":             body.price,
            "warranty":          body.warranty,
        }
    )
    await db.commit()
    return {"message": "Product created", "uid": body.uid}


@router.put("/{uid}")
async def update_product(
    uid: str,
    body: ProductUpdate,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
):
    await require_perm("products_add", credentials.credentials, db)
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        return {"message": "No changes"}
    set_clause = ", ".join([f"{k} = :{k}" for k in updates.keys()])
    updates["uid"] = uid
    await db.execute(
        text(f"UPDATE products SET {set_clause}, updated_at = now() WHERE uid = :uid"),
        updates
    )
    await db.commit()
    return {"message": "Product updated"}


@router.put("/{uid}/test-status")
async def update_test_status(
    uid: str,
    body: TestStatusUpdate,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
):
    await require_perm("products_test_status", credentials.credentials, db)

    if body.test_status not in ["passed", "failed", "pending"]:
        raise HTTPException(status_code=400, detail="test_status must be passed, failed or pending")

    await db.execute(
        text("""
            UPDATE products
            SET test_status = :test_status, test_remarks = :test_remarks, updated_at = now()
            WHERE uid = :uid
        """),
        {"uid": uid, "test_status": body.test_status, "test_remarks": body.test_remarks}
    )
    await db.commit()
    return {"message": "Test status updated"}


@router.delete("/{uid}")
async def delete_product(
    uid: str,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
):
    await require_perm("products_add", credentials.credentials, db)

    # Check if assigned
    installed = await db.execute(
        text("SELECT installation_id FROM installations WHERE product_uid = :uid LIMIT 1"),
        {"uid": uid}
    )
    if installed.mappings().first():
        raise HTTPException(status_code=409, detail="Cannot delete — product is currently installed. Remove installation first.")

    await db.execute(text("DELETE FROM products WHERE uid = :uid"), {"uid": uid})
    await db.commit()
    return {"message": "Product deleted"}


@router.delete("/{uid}/installation")
async def remove_installation(
    uid: str,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
):
    await require_perm("installations_manage", credentials.credentials, db)

    await db.execute(
        text("DELETE FROM installations WHERE product_uid = :uid"),
        {"uid": uid}
    )
    await db.execute(
        text("DELETE FROM borewell WHERE uid = :uid"),
        {"uid": uid}
    )
    await db.commit()
    return {"message": "Installation removed"}
