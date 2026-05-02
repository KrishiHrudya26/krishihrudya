--
-- PostgreSQL database dump
--

\restrict mFwTNALDCydChiLe08uzPyNtslYAnGndVMrPjurk3LRdqdPNCqmGduJpkjl5efC

-- Dumped from database version 16.13 (Ubuntu 16.13-0ubuntu0.24.04.1)
-- Dumped by pg_dump version 16.13 (Ubuntu 16.13-0ubuntu0.24.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: access_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.access_tokens (
    token_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    token character varying(100) NOT NULL,
    customer_id uuid NOT NULL,
    label character varying(100) NOT NULL,
    scope character varying(20) NOT NULL,
    device_filter jsonb,
    created_by uuid NOT NULL,
    expires_at timestamp without time zone,
    is_active boolean DEFAULT true,
    last_used_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT access_tokens_scope_check CHECK (((scope)::text = ANY ((ARRAY['read'::character varying, 'read_export'::character varying])::text[])))
);


ALTER TABLE public.access_tokens OWNER TO postgres;

--
-- Name: audit_trail; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_trail (
    audit_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid,
    customer_id uuid,
    action character varying(100) NOT NULL,
    resource_type character varying(50) NOT NULL,
    resource_id uuid,
    old_value jsonb,
    new_value jsonb,
    ip_address character varying(45),
    user_agent text,
    status character varying(20) NOT NULL,
    failure_reason text,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.audit_trail OWNER TO postgres;

--
-- Name: borewell; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.borewell (
    bore_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    farm_id uuid NOT NULL,
    user_id uuid NOT NULL,
    uid character varying(20) NOT NULL,
    borewell_name character varying(20),
    motor_hp integer,
    pump_stages integer,
    borewell_depth double precision,
    borewell_diameter double precision,
    dealer_id uuid,
    location text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.borewell OWNER TO postgres;

--
-- Name: category; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.category (
    cat_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    image character varying(255),
    description text,
    status character varying(20) DEFAULT 'active'::character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.category OWNER TO postgres;

--
-- Name: customer_invites; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.customer_invites (
    invite_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    customer_id uuid NOT NULL,
    invited_by uuid NOT NULL,
    email character varying(255),
    phone character varying(20),
    token character varying(100) NOT NULL,
    role_id uuid NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.customer_invites OWNER TO postgres;

--
-- Name: customer_role_permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.customer_role_permissions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    customer_id uuid NOT NULL,
    role_id uuid NOT NULL,
    permission_id uuid NOT NULL,
    value smallint NOT NULL,
    granted_by uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.customer_role_permissions OWNER TO postgres;

--
-- Name: customers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.customers (
    cust_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    cust_name character varying(255) NOT NULL,
    short_name character varying(50),
    customer_id character varying(30) NOT NULL,
    reg_token character varying(100),
    cust_type character varying(20) NOT NULL,
    reg_type character varying(20) DEFAULT 'open'::character varying,
    hierarchy_required boolean DEFAULT true,
    is_active boolean DEFAULT true,
    reg_expires_at timestamp without time zone,
    address text,
    contact_email character varying(255),
    contact_number character varying(20),
    created_by uuid,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.customers OWNER TO postgres;

--
-- Name: dealer_assignments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.dealer_assignments (
    assignment_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    dealer_id uuid NOT NULL,
    customer_id uuid,
    device_id uuid,
    assignment_type character varying(20) NOT NULL,
    assigned_by uuid NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.dealer_assignments OWNER TO postgres;

--
-- Name: dealer_commissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.dealer_commissions (
    commission_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    dealer_id uuid NOT NULL,
    task_id uuid,
    commission_type character varying(20) NOT NULL,
    amount numeric(10,2),
    percentage numeric(5,2),
    currency character varying(5) DEFAULT 'INR'::character varying,
    status character varying(20) DEFAULT 'pending'::character varying,
    approved_by uuid,
    paid_at timestamp without time zone,
    notes text,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.dealer_commissions OWNER TO postgres;

--
-- Name: dealer_tasks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.dealer_tasks (
    task_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    dealer_id uuid NOT NULL,
    customer_id uuid,
    device_id uuid,
    task_type character varying(20) NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    status character varying(20) DEFAULT 'assigned'::character varying,
    assigned_by uuid NOT NULL,
    completed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.dealer_tasks OWNER TO postgres;

--
-- Name: dealers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.dealers (
    dealer_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    dealer_code character varying(30) NOT NULL,
    dealer_type character varying(20) NOT NULL,
    company_name character varying(255),
    gstin character varying(20),
    region character varying(100),
    commission_type character varying(20) DEFAULT 'flexible'::character varying,
    is_active boolean DEFAULT true,
    onboarded_by uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.dealers OWNER TO postgres;

--
-- Name: enquiries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.enquiries (
    query_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid,
    message text,
    status character varying(20) DEFAULT 'open'::character varying,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.enquiries OWNER TO postgres;

--
-- Name: farmer_use_case; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.farmer_use_case (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid,
    farm_id uuid,
    uid uuid,
    order_id uuid,
    location text,
    product_id uuid,
    installation_date timestamp without time zone,
    total_run_time double precision,
    imsi character varying(20),
    available_power double precision,
    utilized_power double precision,
    water_yield double precision,
    installed_by character varying(50),
    subscription_type character varying(20),
    subscription_starts_from timestamp without time zone,
    subscription_ends_on timestamp without time zone,
    maintenance_alert integer,
    service_by character varying(50),
    last_service_date timestamp without time zone,
    status character varying(20),
    crop_type character varying(100),
    farm_size double precision
);


ALTER TABLE public.farmer_use_case OWNER TO postgres;

--
-- Name: farms; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.farms (
    farm_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    farm_name character varying(255) NOT NULL,
    user_id uuid NOT NULL,
    latitude numeric(10,8),
    longitude numeric(11,8),
    created_at timestamp without time zone DEFAULT now(),
    customer_id uuid,
    hierarchy_node_id uuid,
    ward_number character varying(20),
    rr_number character varying(50),
    address text
);


ALTER TABLE public.farms OWNER TO postgres;

--
-- Name: hierarchy_levels; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.hierarchy_levels (
    level_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    customer_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    level_order integer NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.hierarchy_levels OWNER TO postgres;

--
-- Name: hierarchy_nodes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.hierarchy_nodes (
    node_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    customer_id uuid NOT NULL,
    level_id uuid NOT NULL,
    parent_id uuid,
    name character varying(255) NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.hierarchy_nodes OWNER TO postgres;

--
-- Name: installations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.installations (
    installation_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    farm_id uuid NOT NULL,
    uid character varying(20) NOT NULL,
    installed_by character varying(255) NOT NULL,
    installation_date timestamp without time zone,
    subscription_type character varying(50),
    subscription_start_date date,
    subscription_end_date date,
    total_amount numeric(10,2),
    paid numeric(10,2),
    balance numeric(10,2),
    mode_of_payment character varying(50),
    image text,
    created_at timestamp without time zone DEFAULT now(),
    rr_number character varying(50),
    pump_address text,
    serial_number character varying(100),
    flow_meter_installed boolean DEFAULT false,
    pump_name character varying(100),
    ward_number character varying(20),
    product_uid character varying(20)
);


ALTER TABLE public.installations OWNER TO postgres;

--
-- Name: orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.orders (
    order_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    product_id uuid NOT NULL,
    quantity integer NOT NULL,
    price numeric(10,2),
    customer_type character varying(20),
    status character varying(20),
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.orders OWNER TO postgres;

--
-- Name: otp_verifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.otp_verifications (
    otp_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    identifier character varying(255) NOT NULL,
    otp_code character varying(255) NOT NULL,
    purpose character varying(30) NOT NULL,
    is_used boolean DEFAULT false,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.otp_verifications OWNER TO postgres;

--
-- Name: password_reset_token; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.password_reset_token (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    email_phone character varying(255) NOT NULL,
    token character varying(255) NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    is_used boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.password_reset_token OWNER TO postgres;

--
-- Name: permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.permissions (
    permission_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(100) NOT NULL,
    category character varying(50) NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.permissions OWNER TO postgres;

--
-- Name: products; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.products (
    product_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    category_name character varying(20),
    sub_category_name character varying(20),
    manufactured_date date,
    price numeric,
    warranty integer,
    test_status character varying(20),
    status character varying(20),
    product_name character varying(255),
    uid character varying(20),
    serial_number character varying(100),
    test_remarks text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.products OWNER TO postgres;

--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.role_permissions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    role_id uuid NOT NULL,
    dashboard_access smallint DEFAULT 0,
    reports_view smallint DEFAULT 0,
    reports_export smallint DEFAULT 0,
    reports_query smallint DEFAULT 0,
    users_add smallint DEFAULT 0,
    users_edit smallint DEFAULT 0,
    users_delete smallint DEFAULT 0,
    roles_add smallint DEFAULT 0,
    roles_edit smallint DEFAULT 0,
    roles_delete smallint DEFAULT 0,
    customers_add smallint DEFAULT 0,
    customers_edit smallint DEFAULT 0,
    customers_delete smallint DEFAULT 0,
    access_tokens_assign smallint DEFAULT 0,
    role_permissions_assign smallint DEFAULT 0,
    devices_assign smallint DEFAULT 0,
    devices_edit smallint DEFAULT 0,
    devices_delete smallint DEFAULT 0,
    hierarchy_view smallint DEFAULT 0,
    hierarchy_manage smallint DEFAULT 0,
    farms_manage smallint DEFAULT 0,
    settings_basic smallint DEFAULT 0,
    settings_advanced smallint DEFAULT 0,
    analytics_access smallint DEFAULT 0,
    motor_control smallint DEFAULT 0,
    event_logs_view smallint DEFAULT 0,
    products_add smallint DEFAULT 0,
    categories_manage smallint DEFAULT 0,
    products_test_status smallint DEFAULT 0,
    meta_tables_manage smallint DEFAULT 0,
    dealer_manage smallint DEFAULT 0,
    commission_approve smallint DEFAULT 0,
    audit_logs_view smallint DEFAULT 0,
    notifications_manage smallint DEFAULT 0,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    sim_manage smallint DEFAULT 0,
    services_manage smallint DEFAULT 0,
    services_view smallint DEFAULT 0,
    orders_manage smallint DEFAULT 0,
    content_manage smallint DEFAULT 0,
    installations_manage smallint DEFAULT 0,
    role_name text
);


ALTER TABLE public.role_permissions OWNER TO postgres;

--
-- Name: roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.roles (
    role_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(100) NOT NULL,
    slug character varying(50) NOT NULL,
    customer_type character varying(20),
    is_kh_internal boolean DEFAULT false,
    hierarchy_level integer,
    description text,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.roles OWNER TO postgres;

--
-- Name: service; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.service (
    ticket_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid,
    farm_id uuid,
    uid uuid,
    service_type character varying(50),
    service_request_mode integer,
    assigned_to character varying(100),
    product_id uuid,
    in_warranty_period boolean DEFAULT false,
    ticket_raised_by character varying(20),
    requested_date timestamp without time zone,
    resolved_date timestamp without time zone,
    status character varying(20),
    description text
);


ALTER TABLE public.service OWNER TO postgres;

--
-- Name: slider; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.slider (
    slider_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    title character varying(255),
    sub_heading1 text,
    slider_link character varying(255),
    image character varying(255),
    order_no integer,
    status integer,
    created timestamp without time zone DEFAULT now(),
    modified timestamp without time zone DEFAULT now()
);


ALTER TABLE public.slider OWNER TO postgres;

--
-- Name: sub_category; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sub_category (
    sbcat_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    cat_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    image character varying(255),
    description text,
    status character varying(20) DEFAULT 'active'::character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.sub_category OWNER TO postgres;

--
-- Name: testimonial; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.testimonial (
    test_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid,
    comment text,
    src_file character varying(255),
    is_approved boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.testimonial OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    user_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    full_name character varying(255) NOT NULL,
    email character varying(255),
    phone character varying(20),
    password_hash character varying(255),
    customer_id uuid NOT NULL,
    role_id uuid NOT NULL,
    hierarchy_node_id uuid,
    status character varying(20) DEFAULT 'pending'::character varying,
    verify_method character varying(10),
    email_verified boolean DEFAULT false,
    phone_verified boolean DEFAULT false,
    bypass_org_scope boolean DEFAULT false,
    last_login_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    address text,
    latitude numeric(10,8),
    longitude numeric(11,8),
    farm_size character varying(50),
    crop_type character varying(100),
    crop_stage character varying(100),
    profile_photo text
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: valve_commands; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.valve_commands (
    cmd_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    device_uid character varying(50) NOT NULL,
    command_string text NOT NULL,
    command_type character varying(20),
    pin_number integer,
    state integer,
    sent_by uuid,
    mqtt_topic text,
    status character varying(20) DEFAULT 'sent'::character varying,
    created_at timestamp without time zone DEFAULT now(),
    acknowledged_at timestamp without time zone,
    address integer,
    sent_at timestamp without time zone,
    lora_string text
);


ALTER TABLE public.valve_commands OWNER TO postgres;

--
-- Name: access_tokens access_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.access_tokens
    ADD CONSTRAINT access_tokens_pkey PRIMARY KEY (token_id);


--
-- Name: access_tokens access_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.access_tokens
    ADD CONSTRAINT access_tokens_token_key UNIQUE (token);


--
-- Name: audit_trail audit_trail_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_trail
    ADD CONSTRAINT audit_trail_pkey PRIMARY KEY (audit_id);


--
-- Name: borewell borewell_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.borewell
    ADD CONSTRAINT borewell_pkey PRIMARY KEY (bore_id);


--
-- Name: category category_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.category
    ADD CONSTRAINT category_pkey PRIMARY KEY (cat_id);


--
-- Name: customer_invites customer_invites_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_invites
    ADD CONSTRAINT customer_invites_pkey PRIMARY KEY (invite_id);


--
-- Name: customer_invites customer_invites_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_invites
    ADD CONSTRAINT customer_invites_token_key UNIQUE (token);


--
-- Name: customer_role_permissions customer_role_permissions_customer_id_role_id_permission_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_role_permissions
    ADD CONSTRAINT customer_role_permissions_customer_id_role_id_permission_id_key UNIQUE (customer_id, role_id, permission_id);


--
-- Name: customer_role_permissions customer_role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_role_permissions
    ADD CONSTRAINT customer_role_permissions_pkey PRIMARY KEY (id);


--
-- Name: customers customers_customer_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_customer_id_key UNIQUE (customer_id);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (cust_id);


--
-- Name: customers customers_reg_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_reg_token_key UNIQUE (reg_token);


--
-- Name: dealer_assignments dealer_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dealer_assignments
    ADD CONSTRAINT dealer_assignments_pkey PRIMARY KEY (assignment_id);


--
-- Name: dealer_commissions dealer_commissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dealer_commissions
    ADD CONSTRAINT dealer_commissions_pkey PRIMARY KEY (commission_id);


--
-- Name: dealer_tasks dealer_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dealer_tasks
    ADD CONSTRAINT dealer_tasks_pkey PRIMARY KEY (task_id);


--
-- Name: dealers dealers_dealer_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dealers
    ADD CONSTRAINT dealers_dealer_code_key UNIQUE (dealer_code);


--
-- Name: dealers dealers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dealers
    ADD CONSTRAINT dealers_pkey PRIMARY KEY (dealer_id);


--
-- Name: dealers dealers_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dealers
    ADD CONSTRAINT dealers_user_id_key UNIQUE (user_id);


--
-- Name: enquiries enquiries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.enquiries
    ADD CONSTRAINT enquiries_pkey PRIMARY KEY (query_id);


--
-- Name: farmer_use_case farmer_use_case_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.farmer_use_case
    ADD CONSTRAINT farmer_use_case_pkey PRIMARY KEY (id);


--
-- Name: farms farms_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.farms
    ADD CONSTRAINT farms_pkey PRIMARY KEY (farm_id);


--
-- Name: hierarchy_levels hierarchy_levels_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hierarchy_levels
    ADD CONSTRAINT hierarchy_levels_pkey PRIMARY KEY (level_id);


--
-- Name: hierarchy_nodes hierarchy_nodes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hierarchy_nodes
    ADD CONSTRAINT hierarchy_nodes_pkey PRIMARY KEY (node_id);


--
-- Name: installations installations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.installations
    ADD CONSTRAINT installations_pkey PRIMARY KEY (installation_id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (order_id);


--
-- Name: otp_verifications otp_verifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.otp_verifications
    ADD CONSTRAINT otp_verifications_pkey PRIMARY KEY (otp_id);


--
-- Name: password_reset_token password_reset_token_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.password_reset_token
    ADD CONSTRAINT password_reset_token_pkey PRIMARY KEY (id);


--
-- Name: permissions permissions_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_name_key UNIQUE (name);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (permission_id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (product_id);


--
-- Name: products products_serial_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_serial_number_key UNIQUE (serial_number);


--
-- Name: products products_uid_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_uid_key UNIQUE (uid);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_role_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_key UNIQUE (role_id);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (role_id);


--
-- Name: roles roles_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_slug_key UNIQUE (slug);


--
-- Name: service service_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.service
    ADD CONSTRAINT service_pkey PRIMARY KEY (ticket_id);


--
-- Name: slider slider_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.slider
    ADD CONSTRAINT slider_pkey PRIMARY KEY (slider_id);


--
-- Name: sub_category sub_category_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sub_category
    ADD CONSTRAINT sub_category_pkey PRIMARY KEY (sbcat_id);


--
-- Name: testimonial testimonial_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.testimonial
    ADD CONSTRAINT testimonial_pkey PRIMARY KEY (test_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_phone_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_phone_key UNIQUE (phone);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (user_id);


--
-- Name: valve_commands valve_commands_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.valve_commands
    ADD CONSTRAINT valve_commands_pkey PRIMARY KEY (cmd_id);


--
-- Name: access_tokens access_tokens_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.access_tokens
    ADD CONSTRAINT access_tokens_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(user_id);


--
-- Name: access_tokens access_tokens_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.access_tokens
    ADD CONSTRAINT access_tokens_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(cust_id);


--
-- Name: borewell borewell_dealer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.borewell
    ADD CONSTRAINT borewell_dealer_id_fkey FOREIGN KEY (dealer_id) REFERENCES public.dealers(dealer_id);


--
-- Name: borewell borewell_farm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.borewell
    ADD CONSTRAINT borewell_farm_id_fkey FOREIGN KEY (farm_id) REFERENCES public.farms(farm_id);


--
-- Name: borewell borewell_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.borewell
    ADD CONSTRAINT borewell_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id);


--
-- Name: customer_invites customer_invites_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_invites
    ADD CONSTRAINT customer_invites_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(cust_id);


--
-- Name: customer_invites customer_invites_invited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_invites
    ADD CONSTRAINT customer_invites_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES public.users(user_id);


--
-- Name: customer_invites customer_invites_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_invites
    ADD CONSTRAINT customer_invites_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(role_id);


--
-- Name: customer_role_permissions customer_role_permissions_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_role_permissions
    ADD CONSTRAINT customer_role_permissions_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(cust_id);


--
-- Name: customer_role_permissions customer_role_permissions_granted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_role_permissions
    ADD CONSTRAINT customer_role_permissions_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES public.users(user_id);


--
-- Name: customer_role_permissions customer_role_permissions_permission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_role_permissions
    ADD CONSTRAINT customer_role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.permissions(permission_id);


--
-- Name: customer_role_permissions customer_role_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_role_permissions
    ADD CONSTRAINT customer_role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(role_id);


--
-- Name: dealer_assignments dealer_assignments_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dealer_assignments
    ADD CONSTRAINT dealer_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users(user_id);


--
-- Name: dealer_assignments dealer_assignments_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dealer_assignments
    ADD CONSTRAINT dealer_assignments_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(cust_id);


--
-- Name: dealer_assignments dealer_assignments_dealer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dealer_assignments
    ADD CONSTRAINT dealer_assignments_dealer_id_fkey FOREIGN KEY (dealer_id) REFERENCES public.dealers(dealer_id);


--
-- Name: dealer_commissions dealer_commissions_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dealer_commissions
    ADD CONSTRAINT dealer_commissions_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(user_id);


--
-- Name: dealer_commissions dealer_commissions_dealer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dealer_commissions
    ADD CONSTRAINT dealer_commissions_dealer_id_fkey FOREIGN KEY (dealer_id) REFERENCES public.dealers(dealer_id);


--
-- Name: dealer_commissions dealer_commissions_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dealer_commissions
    ADD CONSTRAINT dealer_commissions_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.dealer_tasks(task_id);


--
-- Name: dealer_tasks dealer_tasks_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dealer_tasks
    ADD CONSTRAINT dealer_tasks_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users(user_id);


--
-- Name: dealer_tasks dealer_tasks_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dealer_tasks
    ADD CONSTRAINT dealer_tasks_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(cust_id);


--
-- Name: dealer_tasks dealer_tasks_dealer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dealer_tasks
    ADD CONSTRAINT dealer_tasks_dealer_id_fkey FOREIGN KEY (dealer_id) REFERENCES public.dealers(dealer_id);


--
-- Name: dealers dealers_onboarded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dealers
    ADD CONSTRAINT dealers_onboarded_by_fkey FOREIGN KEY (onboarded_by) REFERENCES public.users(user_id);


--
-- Name: dealers dealers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dealers
    ADD CONSTRAINT dealers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id);


--
-- Name: farmer_use_case farmer_use_case_farm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.farmer_use_case
    ADD CONSTRAINT farmer_use_case_farm_id_fkey FOREIGN KEY (farm_id) REFERENCES public.farms(farm_id);


--
-- Name: farmer_use_case farmer_use_case_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.farmer_use_case
    ADD CONSTRAINT farmer_use_case_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(product_id);


--
-- Name: farmer_use_case farmer_use_case_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.farmer_use_case
    ADD CONSTRAINT farmer_use_case_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id);


--
-- Name: farms farms_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.farms
    ADD CONSTRAINT farms_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(cust_id);


--
-- Name: farms farms_hierarchy_node_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.farms
    ADD CONSTRAINT farms_hierarchy_node_id_fkey FOREIGN KEY (hierarchy_node_id) REFERENCES public.hierarchy_nodes(node_id);


--
-- Name: farms farms_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.farms
    ADD CONSTRAINT farms_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id);


--
-- Name: customers fk_customers_created_by; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT fk_customers_created_by FOREIGN KEY (created_by) REFERENCES public.users(user_id);


--
-- Name: users fk_users_hierarchy_node; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT fk_users_hierarchy_node FOREIGN KEY (hierarchy_node_id) REFERENCES public.hierarchy_nodes(node_id);


--
-- Name: hierarchy_levels hierarchy_levels_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hierarchy_levels
    ADD CONSTRAINT hierarchy_levels_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(cust_id);


--
-- Name: hierarchy_nodes hierarchy_nodes_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hierarchy_nodes
    ADD CONSTRAINT hierarchy_nodes_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(cust_id);


--
-- Name: hierarchy_nodes hierarchy_nodes_level_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hierarchy_nodes
    ADD CONSTRAINT hierarchy_nodes_level_id_fkey FOREIGN KEY (level_id) REFERENCES public.hierarchy_levels(level_id);


--
-- Name: hierarchy_nodes hierarchy_nodes_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hierarchy_nodes
    ADD CONSTRAINT hierarchy_nodes_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.hierarchy_nodes(node_id);


--
-- Name: installations installations_farm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.installations
    ADD CONSTRAINT installations_farm_id_fkey FOREIGN KEY (farm_id) REFERENCES public.farms(farm_id);


--
-- Name: installations installations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.installations
    ADD CONSTRAINT installations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id);


--
-- Name: role_permissions role_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(role_id);


--
-- Name: sub_category sub_category_cat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sub_category
    ADD CONSTRAINT sub_category_cat_id_fkey FOREIGN KEY (cat_id) REFERENCES public.category(cat_id);


--
-- Name: users users_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(cust_id);


--
-- Name: users users_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(role_id);


--
-- Name: valve_commands valve_commands_sent_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.valve_commands
    ADD CONSTRAINT valve_commands_sent_by_fkey FOREIGN KEY (sent_by) REFERENCES public.users(user_id);


--
-- Name: TABLE access_tokens; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.access_tokens TO khuser;


--
-- Name: TABLE audit_trail; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.audit_trail TO khuser;


--
-- Name: TABLE borewell; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.borewell TO khuser;


--
-- Name: TABLE category; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.category TO khuser;


--
-- Name: TABLE customer_invites; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.customer_invites TO khuser;


--
-- Name: TABLE customer_role_permissions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.customer_role_permissions TO khuser;


--
-- Name: TABLE customers; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.customers TO khuser;


--
-- Name: TABLE dealer_assignments; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.dealer_assignments TO khuser;


--
-- Name: TABLE dealer_commissions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.dealer_commissions TO khuser;


--
-- Name: TABLE dealer_tasks; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.dealer_tasks TO khuser;


--
-- Name: TABLE dealers; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.dealers TO khuser;


--
-- Name: TABLE enquiries; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.enquiries TO khuser;


--
-- Name: TABLE farmer_use_case; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.farmer_use_case TO khuser;


--
-- Name: TABLE farms; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.farms TO khuser;


--
-- Name: TABLE hierarchy_levels; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.hierarchy_levels TO khuser;


--
-- Name: TABLE hierarchy_nodes; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.hierarchy_nodes TO khuser;


--
-- Name: TABLE installations; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.installations TO khuser;


--
-- Name: TABLE orders; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.orders TO khuser;


--
-- Name: TABLE otp_verifications; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.otp_verifications TO khuser;


--
-- Name: TABLE password_reset_token; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.password_reset_token TO khuser;


--
-- Name: TABLE permissions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.permissions TO khuser;


--
-- Name: TABLE products; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.products TO khuser;


--
-- Name: TABLE role_permissions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.role_permissions TO khuser;


--
-- Name: TABLE roles; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.roles TO khuser;


--
-- Name: TABLE service; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.service TO khuser;


--
-- Name: TABLE slider; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.slider TO khuser;


--
-- Name: TABLE sub_category; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.sub_category TO khuser;


--
-- Name: TABLE testimonial; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.testimonial TO khuser;


--
-- Name: TABLE users; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.users TO khuser;


--
-- Name: TABLE valve_commands; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.valve_commands TO khuser;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO khuser;


--
-- PostgreSQL database dump complete
--

\unrestrict mFwTNALDCydChiLe08uzPyNtslYAnGndVMrPjurk3LRdqdPNCqmGduJpkjl5efC

