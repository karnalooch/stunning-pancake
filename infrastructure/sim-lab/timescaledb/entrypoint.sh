#!/bin/sh
# Railway volume prep for timescale-postgis (runs as root; template image defaults to postgres user).
set -eu

data_root="${RAILWAY_VOLUME_MOUNT_PATH:-/var/lib/postgresql/data}"
pgdata="${PGDATA:-${data_root}/pgdata}"

if [ -d "${data_root}" ]; then
  rm -rf "${data_root}/lost+found" 2>/dev/null || true
  mkdir -p "${pgdata}"
  chown -R postgres:postgres "${data_root}"
  chmod 700 "${pgdata}" 2>/dev/null || true
fi

if command -v docker-entrypoint.sh >/dev/null 2>&1; then
  entry=docker-entrypoint.sh
elif [ -x /usr/local/bin/docker-entrypoint.sh ]; then
  entry=/usr/local/bin/docker-entrypoint.sh
else
  echo "docker-entrypoint.sh not found" >&2
  exit 1
fi

exec "${entry}" "$@"
