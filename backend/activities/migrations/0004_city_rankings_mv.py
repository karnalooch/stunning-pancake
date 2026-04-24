from django.db import migrations

class Migration(migrations.Migration):

    dependencies = [
        ('activities', '0003_activity_activities__created_0e5d3c_idx'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            CREATE MATERIALIZED VIEW city_rankings_mv AS
            SELECT
                u.tenant_id as city_id,
                u.id as user_id,
                u.username,
                SUM(a.distance) as total_distance_m,
                COUNT(a.id) as activity_count,
                MAX(a.end_time) as last_activity_at
            FROM
                users_user u
            JOIN
                activities_activity a ON u.id = a.user_id
            WHERE
                a.is_verified = True
            GROUP BY
                u.tenant_id, u.id, u.username
            WITH DATA;

            CREATE UNIQUE INDEX city_rankings_user_idx ON city_rankings_mv (city_id, user_id);
            """,
            reverse_sql="DROP MATERIALIZED VIEW IF EXISTS city_rankings_mv;"
        ),
    ]
