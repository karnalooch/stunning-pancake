from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        (
            "activities",
            "0014_rename_activities__created_8a1f2d_idx_activities__created_121688_idx_and_more",
        ),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            CREATE SCHEMA IF NOT EXISTS telemetry;

            CREATE TABLE IF NOT EXISTS telemetry.live_position_events (
                time TIMESTAMPTZ NOT NULL,
                device_id TEXT NOT NULL,
                lat DOUBLE PRECISION,
                lng DOUBLE PRECISION,
                speed REAL,
                course REAL,
                act_type TEXT,
                tenant_id UUID,
                department_id INT,
                ride_state TEXT,
                flagged BOOLEAN DEFAULT false,
                city_slug TEXT
            );

            CREATE UNIQUE INDEX IF NOT EXISTS live_position_events_time_device_uidx
                ON telemetry.live_position_events (time, device_id);

            CREATE INDEX IF NOT EXISTS live_position_events_tenant_time_idx
                ON telemetry.live_position_events (tenant_id, time DESC);

            CREATE INDEX IF NOT EXISTS live_position_events_device_time_idx
                ON telemetry.live_position_events (device_id, time DESC);

            DO $BODY$
            BEGIN
                IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'create_hypertable') THEN
                    PERFORM create_hypertable(
                        'telemetry.live_position_events',
                        'time',
                        chunk_time_interval => INTERVAL '1 day',
                        if_not_exists => TRUE
                    );
                END IF;
                IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'add_retention_policy') THEN
                    PERFORM add_retention_policy(
                        'telemetry.live_position_events',
                        INTERVAL '30 days',
                        if_not_exists => TRUE
                    );
                END IF;
                IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'add_compression_policy') THEN
                    -- TimescaleDB requires compression enabled on the hypertable before add_compression_policy.
                    ALTER TABLE telemetry.live_position_events SET (
                        timescaledb.compress,
                        timescaledb.compress_segmentby = 'device_id',
                        timescaledb.compress_orderby = 'time DESC'
                    );
                    PERFORM add_compression_policy(
                        'telemetry.live_position_events',
                        INTERVAL '7 days',
                        if_not_exists => TRUE
                    );
                END IF;
            END $BODY$;
            """,
            reverse_sql="""
            DROP TABLE IF EXISTS telemetry.live_position_events CASCADE;
            DROP SCHEMA IF EXISTS telemetry CASCADE;
            """,
        ),
    ]
