-- ============================================================
-- KrishiHrudya Master Schema Migration
-- Section 1 — User & Access Management
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE customers (
    cust_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cust_name VARCHAR(255) NOT NULL,
    short_name VARCHAR(50),
    customer_id VARCHAR(30) UNIQUE NOT NULL,
    reg_token VARCHAR(100) UNIQUE,
    cust_type VARCHAR(20) NOT NULL,
    reg_type VARCHAR(20) DEFAULT 'open',
    hierarchy_required BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    reg_expires_at TIMESTAMP NULL,
    address TEXT NULL,
    contact_email VARCHAR(255) NULL,
    contact_number VARCHAR(20) NULL,
    created_by UUID NULL,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE roles (
    role_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(50) UNIQUE NOT NULL,
    customer_type VARCHAR(20) NULL,
    is_kh_internal BOOLEAN DEFAULT false,
    hierarchy_level INTEGER NULL,
    description TEXT NULL,
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NULL,
    phone VARCHAR(20) UNIQUE NULL,
    password_hash VARCHAR(255) NULL,
    customer_id UUID NOT NULL REFERENCES customers(cust_id),
    role_id UUID NOT NULL REFERENCES roles(role_id),
    hierarchy_node_id UUID NULL,
    status VARCHAR(20) DEFAULT 'pending',
    verify_method VARCHAR(10) NULL,
    email_verified BOOLEAN DEFAULT false,
    phone_verified BOOLEAN DEFAULT false,
    bypass_org_scope BOOLEAN DEFAULT false,
    last_login_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

ALTER TABLE customers
    ADD CONSTRAINT fk_customers_created_by
    FOREIGN KEY (created_by) REFERENCES users(user_id);

CREATE TABLE permissions (
    permission_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    category VARCHAR(50) NOT NULL,
    description TEXT NULL,
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE role_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_id UUID UNIQUE NOT NULL REFERENCES roles(role_id),
    dashboard_access SMALLINT DEFAULT 0,
    reports_view SMALLINT DEFAULT 0,
    reports_export SMALLINT DEFAULT 0,
    reports_query SMALLINT DEFAULT 0,
    users_add SMALLINT DEFAULT 0,
    users_edit SMALLINT DEFAULT 0,
    users_delete SMALLINT DEFAULT 0,
    roles_add SMALLINT DEFAULT 0,
    roles_edit SMALLINT DEFAULT 0,
    roles_delete SMALLINT DEFAULT 0,
    customers_add SMALLINT DEFAULT 0,
    customers_edit SMALLINT DEFAULT 0,
    customers_delete SMALLINT DEFAULT 0,
    access_tokens_assign SMALLINT DEFAULT 0,
    role_permissions_assign SMALLINT DEFAULT 0,
    devices_assign SMALLINT DEFAULT 0,
    devices_edit SMALLINT DEFAULT 0,
    devices_delete SMALLINT DEFAULT 0,
    hierarchy_view SMALLINT DEFAULT 0,
    hierarchy_manage SMALLINT DEFAULT 0,
    farms_manage SMALLINT DEFAULT 0,
    settings_basic SMALLINT DEFAULT 0,
    settings_advanced SMALLINT DEFAULT 0,
    analytics_access SMALLINT DEFAULT 0,
    motor_control SMALLINT DEFAULT 0,
    event_logs_view SMALLINT DEFAULT 0,
    products_add SMALLINT DEFAULT 0,
    categories_manage SMALLINT DEFAULT 0,
    products_test_status SMALLINT DEFAULT 0,
    meta_tables_manage SMALLINT DEFAULT 0,
    dealer_manage SMALLINT DEFAULT 0,
    commission_approve SMALLINT DEFAULT 0,
    audit_logs_view SMALLINT DEFAULT 0,
    notifications_manage SMALLINT DEFAULT 0,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE customer_role_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(cust_id),
    role_id UUID NOT NULL REFERENCES roles(role_id),
    permission_id UUID NOT NULL REFERENCES permissions(permission_id),
    value SMALLINT NOT NULL,
    granted_by UUID NOT NULL REFERENCES users(user_id),
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now(),
    UNIQUE(customer_id, role_id, permission_id)
);

CREATE TABLE hierarchy_levels (
    level_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(cust_id),
    name VARCHAR(100) NOT NULL,
    level_order INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE hierarchy_nodes (
    node_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(cust_id),
    level_id UUID NOT NULL REFERENCES hierarchy_levels(level_id),
    parent_id UUID NULL REFERENCES hierarchy_nodes(node_id),
    name VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT now()
);

ALTER TABLE users
    ADD CONSTRAINT fk_users_hierarchy_node
    FOREIGN KEY (hierarchy_node_id) REFERENCES hierarchy_nodes(node_id);

CREATE TABLE otp_verifications (
    otp_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    identifier VARCHAR(255) NOT NULL,
    otp_code VARCHAR(255) NOT NULL,
    purpose VARCHAR(30) NOT NULL,
    is_used BOOLEAN DEFAULT false,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE access_tokens (
    token_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token VARCHAR(100) UNIQUE NOT NULL,
    customer_id UUID NOT NULL REFERENCES customers(cust_id),
    label VARCHAR(100) NOT NULL,
    scope VARCHAR(20) NOT NULL CHECK (scope IN ('read', 'read_export')),
    device_filter JSONB NULL,
    created_by UUID NOT NULL REFERENCES users(user_id),
    expires_at TIMESTAMP NULL,
    is_active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE customer_invites (
    invite_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(cust_id),
    invited_by UUID NOT NULL REFERENCES users(user_id),
    email VARCHAR(255) NULL,
    phone VARCHAR(20) NULL,
    token VARCHAR(100) UNIQUE NOT NULL,
    role_id UUID NOT NULL REFERENCES roles(role_id),
    status VARCHAR(20) DEFAULT 'pending',
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT now()
);

-- ============================================================
-- Section 2 — Dealer Management
-- ============================================================

CREATE TABLE dealers (
    dealer_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(user_id),
    dealer_code VARCHAR(30) UNIQUE NOT NULL,
    dealer_type VARCHAR(20) NOT NULL,
    company_name VARCHAR(255) NULL,
    gstin VARCHAR(20) NULL,
    region VARCHAR(100) NULL,
    commission_type VARCHAR(20) DEFAULT 'flexible',
    is_active BOOLEAN DEFAULT true,
    onboarded_by UUID NOT NULL REFERENCES users(user_id),
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE dealer_assignments (
    assignment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dealer_id UUID NOT NULL REFERENCES dealers(dealer_id),
    customer_id UUID NULL REFERENCES customers(cust_id),
    device_id UUID NULL,
    assignment_type VARCHAR(20) NOT NULL,
    assigned_by UUID NOT NULL REFERENCES users(user_id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE dealer_tasks (
    task_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dealer_id UUID NOT NULL REFERENCES dealers(dealer_id),
    customer_id UUID NULL REFERENCES customers(cust_id),
    device_id UUID NULL,
    task_type VARCHAR(20) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NULL,
    status VARCHAR(20) DEFAULT 'assigned',
    assigned_by UUID NOT NULL REFERENCES users(user_id),
    completed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE dealer_commissions (
    commission_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dealer_id UUID NOT NULL REFERENCES dealers(dealer_id),
    task_id UUID NULL REFERENCES dealer_tasks(task_id),
    commission_type VARCHAR(20) NOT NULL,
    amount DECIMAL(10,2) NULL,
    percentage DECIMAL(5,2) NULL,
    currency VARCHAR(5) DEFAULT 'INR',
    status VARCHAR(20) DEFAULT 'pending',
    approved_by UUID NULL REFERENCES users(user_id),
    paid_at TIMESTAMP NULL,
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT now()
);

-- ============================================================
-- Section 3 — Farm & Device Installation
-- ============================================================

CREATE TABLE farms (
    farm_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farm_name VARCHAR(255) NOT NULL,
    user_id UUID NOT NULL REFERENCES users(user_id),
    latitude DECIMAL(10,8) NULL,
    longitude DECIMAL(11,8) NULL,
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE borewell (
    bore_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farm_id UUID NOT NULL REFERENCES farms(farm_id),
    user_id UUID NOT NULL REFERENCES users(user_id),
    uid UUID NOT NULL,
    borewell_name VARCHAR(20) NULL,
    motor_hp INTEGER NULL,
    pump_stages INTEGER NULL,
    borewell_depth DOUBLE PRECISION NULL,
    borewell_diameter DOUBLE PRECISION NULL,
    dealer_id UUID NULL REFERENCES dealers(dealer_id),
    location TEXT NULL,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE products (
    product_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category VARCHAR(20) NULL,
    sub_category VARCHAR(20) NULL,
    manufactured_date DATE NULL,
    price NUMERIC NULL,
    warranty INTEGER NULL,
    test_status VARCHAR(20) NULL,
    status VARCHAR(20) NULL
);

CREATE TABLE installations (
    installation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(product_id),
    user_id UUID NOT NULL REFERENCES users(user_id),
    farm_id UUID NOT NULL REFERENCES farms(farm_id),
    uid UUID NOT NULL,
    installed_by VARCHAR(255) NOT NULL,
    installation_date TIMESTAMP NULL,
    subscription_type VARCHAR(50) NULL,
    subscription_start_date DATE NULL,
    subscription_end_date DATE NULL,
    total_amount DECIMAL(10,2) NULL,
    paid DECIMAL(10,2) NULL,
    balance DECIMAL(10,2) NULL,
    mode_of_payment VARCHAR(50) NULL,
    image TEXT NULL,
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE farmer_use_case (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(user_id),
    farm_id UUID REFERENCES farms(farm_id),
    uid UUID NULL,
    order_id UUID NULL,
    location TEXT NULL,
    product_id UUID NULL REFERENCES products(product_id),
    installation_date TIMESTAMP NULL,
    total_run_time DOUBLE PRECISION NULL,
    imsi VARCHAR(20) NULL,
    available_power DOUBLE PRECISION NULL,
    utilized_power DOUBLE PRECISION NULL,
    water_yield DOUBLE PRECISION NULL,
    installed_by VARCHAR(50) NULL,
    subscription_type VARCHAR(20) NULL,
    subscription_starts_from TIMESTAMP NULL,
    subscription_ends_on TIMESTAMP NULL,
    maintenance_alert INTEGER NULL,
    service_by VARCHAR(50) NULL,
    last_service_date TIMESTAMP NULL,
    status VARCHAR(20) NULL
);

-- ============================================================
-- Section 6 — Business & Commerce (kh_business)
-- ============================================================

CREATE TABLE category (
    cat_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    image VARCHAR(255) NULL,
    description TEXT NULL,
    status VARCHAR(20) DEFAULT 'active'
);

CREATE TABLE sub_category (
    sbcat_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cat_id UUID NOT NULL REFERENCES category(cat_id),
    name VARCHAR(255) NOT NULL,
    image VARCHAR(255) NULL,
    description TEXT NULL,
    status VARCHAR(20) DEFAULT 'active'
);

CREATE TABLE orders (
    order_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    product_id UUID NOT NULL,
    quantity INTEGER NOT NULL,
    price DECIMAL(10,2) NULL,
    customer_type VARCHAR(20) NULL,
    status VARCHAR(20) NULL,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE service (
    ticket_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NULL,
    farm_id UUID NULL,
    uid UUID NULL,
    service_type VARCHAR(50) NULL,
    service_request_mode INTEGER NULL,
    assigned_to VARCHAR(100) NULL,
    product_id UUID NULL,
    in_warranty_period BOOLEAN DEFAULT false,
    ticket_raised_by VARCHAR(20) NULL,
    requested_date TIMESTAMP NULL,
    resolved_date TIMESTAMP NULL,
    status VARCHAR(20) NULL,
    description TEXT NULL
);

-- ============================================================
-- Section 7 — Platform & CMS (kh_business)
-- ============================================================

CREATE TABLE enquiries (
    query_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NULL,
    message TEXT NULL,
    status VARCHAR(20) DEFAULT 'open',
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE testimonial (
    test_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NULL,
    comment TEXT NULL,
    src_file VARCHAR(255) NULL,
    is_approved BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE slider (
    slider_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NULL,
    sub_heading1 TEXT NULL,
    slider_link VARCHAR(255) NULL,
    image VARCHAR(255) NULL,
    order_no INTEGER NULL,
    status INTEGER NULL,
    created TIMESTAMP DEFAULT now(),
    modified TIMESTAMP DEFAULT now()
);

CREATE TABLE password_reset_token (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email_phone VARCHAR(255) NOT NULL,
    token VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    is_used BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT now()
);

-- ============================================================
-- Section 8 — Audit & Logging (kh_business)
-- ============================================================

CREATE TABLE audit_trail (
    audit_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NULL,
    customer_id UUID NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID NULL,
    old_value JSONB NULL,
    new_value JSONB NULL,
    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL,
    status VARCHAR(20) NOT NULL,
    failure_reason TEXT NULL,
    created_at TIMESTAMP DEFAULT now()
);
