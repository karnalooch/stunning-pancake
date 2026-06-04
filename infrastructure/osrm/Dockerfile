# OSRM for live simulator routing (engine: BSD-2-Clause; data: OSM ODbL via Geofabrik extract).
FROM ghcr.io/project-osrm/osrm-backend:v5.27.1

USER root
RUN apt-get update \
    && apt-get install -y --no-install-recommends wget curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY infrastructure/osrm/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV OSRM_DATA_DIR=/data
ENV OSRM_PORT=5000
EXPOSE 5000
# Volume mount /data is configured in Railway (osrm-volume), not via Dockerfile VOLUME.

ENTRYPOINT ["/entrypoint.sh"]
