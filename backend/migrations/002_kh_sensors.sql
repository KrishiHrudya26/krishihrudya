CREATE TABLE starter_data (
    sd_id UUID DEFAULT uuid_generate_v4(),
    user_id UUID NULL,
    farm_id UUID NULL,
    uid UUID NOT NULL,
    slno UUID NULL,
    pump_name VARCHAR(20) NULL,
    voltage1 DOUBLE PRECISION NULL,
    voltage2 DOUBLE PRECISION NULL,
    voltage3 DOUBLE PRECISION NULL,
    current1 DOUBLE PRECISION NULL,
    current2 DOUBLE PRECISION NULL,
    current3 DOUBLE PRECISION NULL,
    power_available BOOLEAN NULL,
    motor_state BOOLEAN NULL,
    device_state INTEGER NULL,
    total_run_time DOUBLE PRECISION NULL,
    client_command_reset BOOLEAN NULL,
    heart_beat INTEGER NULL,
    device_mode BOOLEAN NULL,
    calibration_factor1 DOUBLE PRECISION NULL,
    calibration_factor2 DOUBLE PRECISION NULL,
    calibration_factor3 DOUBLE PRECISION NULL,
    time_to_surface DOUBLE PRECISION NULL,
    signal_strength DOUBLE PRECISION NULL,
    spb_mode BOOLEAN NULL,
    wiring_mode INTEGER NULL,
    motor_on_mode INTEGER NULL,
    motor_off_mode INTEGER NULL,
    firmware_version VARCHAR(50) NULL,
    imsi VARCHAR(20) NULL,
    first_device BOOLEAN NULL,
    command_issued_by VARCHAR(20) NULL,
    command_issued INTEGER NULL,
    captured_date TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    status VARCHAR(20) NULL,
    PRIMARY KEY (sd_id, captured_date)
);

SELECT create_hypertable('starter_data', 'captured_date');

CREATE TABLE starter_statistics (
    st_id UUID DEFAULT uuid_generate_v4(),
    user_id UUID NULL,
    farm_id UUID NULL,
    uid UUID NULL,
    total_run_time_for_the_day DOUBLE PRECISION NULL,
    total_run_time_for_the_week DOUBLE PRECISION NULL,
    total_run_time_for_the_month DOUBLE PRECISION NULL,
    month_power_used DOUBLE PRECISION NULL,
    daily_power_used DOUBLE PRECISION NULL,
    total_power_available_time_for_the_day DOUBLE PRECISION NULL,
    month_power_available DOUBLE PRECISION NULL,
    day_water_yield DOUBLE PRECISION NULL,
    month_water_yield DOUBLE PRECISION NULL,
    last_sync_time TIMESTAMPTZ NULL,
    previous_motor_state BOOLEAN NULL,
    previous_device_state INTEGER NULL,
    last_power_available_timestamp TIMESTAMPTZ NULL,
    motor_start_timestamp TIMESTAMPTZ NULL,
    total_on_off_cycles INTEGER NULL,
    total_overload_trips INTEGER NULL,
    total_underload_trips INTEGER NULL,
    run_time_water_yield DOUBLE PRECISION NULL,
    water_yield_7days DOUBLE PRECISION NULL,
    actual_water_level_in_feet DOUBLE PRECISION NULL,
    previous_date TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (st_id, created_at)
);

SELECT create_hypertable('starter_statistics', 'created_at');

CREATE TABLE starter_settings (
    ss_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NULL,
    farm_id UUID NULL,
    uid UUID UNIQUE NOT NULL,
    settings_save_command INTEGER NULL,
    oem_mode BOOLEAN NULL,
    auto_manual BOOLEAN NULL,
    off_timer_mode BOOLEAN NULL,
    cyclic_timer_mode BOOLEAN NULL,
    prb_mode BOOLEAN NULL,
    device_operate_mode INTEGER NULL,
    overload_limit DOUBLE PRECISION NULL,
    underload_limit DOUBLE PRECISION NULL,
    over_voltage_limit DOUBLE PRECISION NULL,
    under_voltage_limit DOUBLE PRECISION NULL,
    on_time_delay INTEGER NULL,
    star_run_delay INTEGER NULL,
    dry_run_timer INTEGER NULL,
    off_timer INTEGER NULL,
    cyclic_on_timer INTEGER NULL,
    cyclic_off_timer INTEGER NULL,
    water_sensor_type VARCHAR(50) NULL,
    notification_status BOOLEAN NULL,
    notification_interval INTEGER NULL,
    chart_plot_interval INTEGER NULL,
    weather_update_plot_interval INTEGER NULL,
    water_level_capture BOOLEAN NULL,
    water_level_update_interval INTEGER NULL,
    time_to_surface_capture INTEGER NULL,
    weather_capture_device VARCHAR(50) NULL,
    pump_flow_rate DOUBLE PRECISION NULL,
    flow_meter_litres_per_pulse DOUBLE PRECISION NULL,
    flow_meter_enable_disable BOOLEAN NULL,
    api_token TEXT NULL,
    chat_id VARCHAR(50) NULL,
    telegram_url TEXT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    status VARCHAR(20) NULL
);

CREATE TABLE chart_utilization (
    id BIGINT DEFAULT NULL,
    uid UUID NOT NULL,
    available_power DOUBLE PRECISION NULL,
    total_runtime DOUBLE PRECISION NULL,
    utilized_power DOUBLE PRECISION NULL,
    water_yield DOUBLE PRECISION NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (uid, created_at)
);

SELECT create_hypertable('chart_utilization', 'created_at');

CREATE TABLE chart_water_analytics (
    id BIGINT DEFAULT NULL,
    uid UUID NOT NULL,
    previous_water_level_plot_timestamp TIMESTAMPTZ NULL,
    flow_counter INTEGER NULL,
    height_of_water DOUBLE PRECISION NULL,
    water_level_below_surface DOUBLE PRECISION NULL,
    flowmeter_reading_in_liter DOUBLE PRECISION NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (uid, created_at)
);

SELECT create_hypertable('chart_water_analytics', 'created_at');

CREATE TABLE chart_power_analytics (
    id BIGINT DEFAULT NULL,
    uid UUID NOT NULL,
    voltage1 TEXT NULL,
    voltage2 TEXT NULL,
    voltage3 TEXT NULL,
    current1 TEXT NULL,
    current2 TEXT NULL,
    current3 TEXT NULL,
    apparent_power TEXT NULL,
    avg_voltage1 FLOAT NULL,
    avg_voltage2 FLOAT NULL,
    avg_voltage3 FLOAT NULL,
    avg_current1 FLOAT NULL,
    avg_current2 FLOAT NULL,
    avg_current3 FLOAT NULL,
    avg_apparent_power FLOAT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (uid, created_at)
);

SELECT create_hypertable('chart_power_analytics', 'created_at');

CREATE TABLE oee (
    farm_id UUID NOT NULL,
    date DATE NOT NULL,
    availability_ratio DECIMAL NULL,
    idle_time INTEGER NULL,
    total_cycles INTEGER NULL,
    avg_run_time_per_cycle DECIMAL NULL,
    avg_idle_time_per_cycle DECIMAL NULL,
    avg_rest_time_between_cycle DECIMAL NULL,
    power_usage_efficiency DECIMAL NULL,
    power_availability_efficiency DECIMAL NULL,
    expected_water_output DECIMAL NULL,
    water_efficiency_ratio DECIMAL NULL,
    water_output_per_minute DECIMAL NULL,
    connectivity_score DECIMAL NULL,
    device_uptime_ratio DECIMAL NULL,
    auto_vs_manual_usage_ratio DECIMAL NULL,
    unexpected_shutdowns INTEGER NULL,
    overload_trip_count INTEGER NULL,
    underload_trip_count INTEGER NULL,
    dry_run_trip_count INTEGER NULL,
    phase_reversal_count INTEGER NULL,
    voltage_fault_count INTEGER NULL,
    line_fault_count INTEGER NULL,
    phase_failure_count INTEGER NULL,
    frequent_start_stop_count INTEGER NULL,
    dry_run_events INTEGER NULL,
    low_water_level_events INTEGER NULL,
    mtbf DECIMAL NULL,
    vsense_fault_count INTEGER NULL,
    PRIMARY KEY (farm_id, date)
);

CREATE TABLE event_logs (
    event_id BIGINT DEFAULT NULL,
    uid UUID NOT NULL,
    event_category TEXT NULL,
    message TEXT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (uid, created_at)
);

SELECT create_hypertable('event_logs', 'created_at');
