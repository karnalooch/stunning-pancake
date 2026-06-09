FROM ghcr.io/railwayapp-templates/timescale-postgis-ssl:pg16-ts2.13

USER root

# path-as-root upload: railway up ./infrastructure/sim-lab/timescaledb --path-as-root
COPY entrypoint.sh /entrypoint-volume-fix.sh
RUN chmod +x /entrypoint-volume-fix.sh

ENTRYPOINT ["/entrypoint-volume-fix.sh"]
CMD ["postgres"]
