"""
Run once to seed KH internal customer, roles, hierarchy and first superadmin.
Usage: python -m app.seed
"""
import asyncio
import uuid
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from app.config import settings
from app.models.user import Customer, User
from app.models.role import Role, RolePermission
from app.models.hierarchy import HierarchyLevel, HierarchyNode
from app.utils.hashing import hash_password

engine = create_async_engine(settings.DATABASE_URL, echo=True)
AsyncSession = async_sessionmaker(engine, expire_on_commit=False)


async def seed():
    async with AsyncSession() as db:

        kh_customer = Customer(
            cust_id=uuid.uuid4(),
            cust_name="KrishiHrudya Private Limited",
            short_name="KH",
            customer_id="K00I2600001",
            reg_token="kh-internal-2026",
            cust_type="internal",
            reg_type="approval_required",
            hierarchy_required=True,
            is_active=True,
            contact_email="admin@krishihrudya.com",
            contact_number="+919999999999",
        )
        db.add(kh_customer)
        await db.flush()

        roles_data = [
            {
                "name": "Master / Super Admin",
                "slug": "master_admin",
                "hierarchy_level": 1,
                "perms": {k: 1 for k in [
                    "dashboard_access","reports_view","reports_export","reports_query",
                    "users_add","users_edit","users_delete","roles_add","roles_edit","roles_delete",
                    "customers_add","customers_edit","customers_delete","access_tokens_assign",
                    "role_permissions_assign","devices_assign","devices_edit","devices_delete",
                    "hierarchy_view","hierarchy_manage","farms_manage","settings_basic","settings_advanced",
                    "analytics_access","motor_control","event_logs_view","products_add",
                    "categories_manage","products_test_status","meta_tables_manage",
                    "dealer_manage","commission_approve","audit_logs_view","notifications_manage",
                ]},
            },
            {
                "name": "Backend Team Manager",
                "slug": "backend_manager",
                "hierarchy_level": 2,
                "perms": {k: 1 for k in [
                    "dashboard_access","reports_view","reports_export","reports_query",
                    "users_add","users_edit","users_delete","customers_add","customers_edit",
                    "access_tokens_assign","devices_assign","devices_edit",
                    "hierarchy_view","hierarchy_manage","farms_manage","settings_basic","settings_advanced",
                    "analytics_access","motor_control","event_logs_view","products_add",
                    "categories_manage","products_test_status","meta_tables_manage",
                    "dealer_manage","audit_logs_view","notifications_manage",
                ]},
            },
            {
                "name": "Backend Team Junior / Trainee",
                "slug": "backend_junior",
                "hierarchy_level": 3,
                "perms": {k: 1 for k in [
                    "dashboard_access","reports_view","users_add","devices_assign",
                    "hierarchy_view","settings_basic","analytics_access","event_logs_view",
                ]},
            },
            {
                "name": "Dealer",
                "slug": "dealer",
                "hierarchy_level": 4,
                "perms": {k: 1 for k in [
                    "dashboard_access","devices_assign","settings_basic",
                    "analytics_access","motor_control","event_logs_view",
                ]},
            },
            {
                "name": "Installation Team",
                "slug": "installation_team",
                "hierarchy_level": 5,
                "perms": {k: 1 for k in [
                    "dashboard_access","devices_assign","devices_edit",
                    "settings_basic","settings_advanced","analytics_access",
                    "motor_control","event_logs_view",
                ]},
            },
        ]

        all_perm_cols = [
            "dashboard_access","reports_view","reports_export","reports_query",
            "users_add","users_edit","users_delete","roles_add","roles_edit","roles_delete",
            "customers_add","customers_edit","customers_delete","access_tokens_assign",
            "role_permissions_assign","devices_assign","devices_edit","devices_delete",
            "hierarchy_view","hierarchy_manage","farms_manage","settings_basic","settings_advanced",
            "analytics_access","motor_control","event_logs_view","products_add",
            "categories_manage","products_test_status","meta_tables_manage",
            "dealer_manage","commission_approve","audit_logs_view","notifications_manage",
        ]

        role_objects = {}
        for r in roles_data:
            role = Role(
                role_id=uuid.uuid4(),
                name=r["name"],
                slug=r["slug"],
                customer_type="internal",
                is_kh_internal=True,
                hierarchy_level=r["hierarchy_level"],
            )
            db.add(role)
            await db.flush()
            perm_kwargs = {col: r["perms"].get(col, 0) for col in all_perm_cols}
            perms = RolePermission(role_id=role.role_id, **perm_kwargs)
            db.add(perms)
            role_objects[r["slug"]] = role
        await db.flush()

        level_names = [
            (1, "Management"),
            (2, "Engineering Lead"),
            (3, "Engineering"),
            (4, "Dealer / Partner"),
            (5, "Field Operations"),
        ]
        level_objects = {}
        for order, name in level_names:
            level = HierarchyLevel(
                level_id=uuid.uuid4(),
                customer_id=kh_customer.cust_id,
                name=name,
                level_order=order,
            )
            db.add(level)
            level_objects[order] = level
        await db.flush()

        mgmt_node = HierarchyNode(
            node_id=uuid.uuid4(),
            customer_id=kh_customer.cust_id,
            level_id=level_objects[1].level_id,
            parent_id=None,
            name="KrishiHrudya HQ",
        )
        db.add(mgmt_node)
        await db.flush()

        child_nodes = [
            (2, "Backend Team", mgmt_node.node_id),
            (3, "Frontend Team", mgmt_node.node_id),
            (4, "Dealer Network", mgmt_node.node_id),
            (5, "Installation Team", mgmt_node.node_id),
        ]
        for level_order, name, parent_id in child_nodes:
            node = HierarchyNode(
                node_id=uuid.uuid4(),
                customer_id=kh_customer.cust_id,
                level_id=level_objects[level_order].level_id,
                parent_id=parent_id,
                name=name,
            )
            db.add(node)
        await db.flush()

        superadmin = User(
            user_id=uuid.uuid4(),
            full_name="KrishiHrudya Super Admin",
            email="krishihrudya.g@gmail.com",
            password_hash=hash_password("Superadmin@26"),
            customer_id=kh_customer.cust_id,
            role_id=role_objects["master_admin"].role_id,
            hierarchy_node_id=mgmt_node.node_id,
            status="active",
            email_verified=True,
            bypass_org_scope=True,
        )
        db.add(superadmin)
        await db.commit()

        # Update created_by after superadmin is committed
        await db.execute(
            text("UPDATE customers SET created_by = :uid WHERE cust_id = :cid"),
            {"uid": str(superadmin.user_id), "cid": str(kh_customer.cust_id)}
        )
        await db.commit()
        print("Seed complete — KH internal customer, roles, hierarchy and superadmin created.")


if __name__ == "__main__":
    asyncio.run(seed())
