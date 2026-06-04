#!/bin/sh
set -eu

DATA_DIR="${OSRM_DATA_DIR:-/data}"
PBF_NAME="${OSRM_PBF_NAME:-poland-latest.osm.pbf}"
PBF_URL="${OSRM_PBF_URL:-https://download.geofabrik.de/europe/poland-latest.osm.pbf}"
PROFILE="${OSRM_BUILD_PROFILE:-/opt/car.lua}"
BASE_NAME="${OSRM_BASE_NAME:-poland-latest}"
PORT="${OSRM_PORT:-5000}"
PBF_MIN_BYTES="${OSRM_PBF_MIN_BYTES:-400000000}"
OSRM_FILE="${BASE_NAME}.osrm"
# MLD graph is a set of files; poland-latest.osrm is a prefix, not a single file.
GRAPH_READY="${BASE_NAME}.osrm.mldgr"

echo "[osrm] boot data_dir=${DATA_DIR} graph=${GRAPH_READY}"

mkdir -p "$DATA_DIR"
cd "$DATA_DIR"

pbf_size() {
  if [ -f "$PBF_NAME" ]; then
    wc -c <"$PBF_NAME" | tr -d ' '
  else
    echo 0
  fi
}

pbf_ready() {
  size="$(pbf_size)"
  [ "$size" -ge "$PBF_MIN_BYTES" ]
}

download_pbf() {
  echo "[osrm] Downloading ${PBF_URL} (first run may take several minutes)..."
  rm -f "$PBF_NAME" "${PBF_NAME}.tmp"
  wget -q --show-progress -O "${PBF_NAME}.tmp" "$PBF_URL" || {
    rm -f "${PBF_NAME}.tmp"
    echo "[osrm] wget failed — place ${PBF_NAME} in volume ${DATA_DIR}" >&2
    exit 1
  }
  mv "${PBF_NAME}.tmp" "$PBF_NAME"
  echo "[osrm] PBF ready ($(pbf_size) bytes)"
}

if [ ! -f "$GRAPH_READY" ]; then
  if ! pbf_ready; then
    size="$(pbf_size)"
    if [ "$size" != "0" ]; then
      echo "[osrm] Removing invalid PBF (${size} bytes, need >= ${PBF_MIN_BYTES})..."
      rm -f "$PBF_NAME"
    fi
    download_pbf
  fi
  echo "[osrm] osrm-extract (profile ${PROFILE})..."
  osrm-extract -p "$PROFILE" "$PBF_NAME"
  echo "[osrm] osrm-partition..."
  osrm-partition "${BASE_NAME}.osrm"
  echo "[osrm] osrm-customize..."
  osrm-customize "${BASE_NAME}.osrm"
  echo "[osrm] Graph ready: ${GRAPH_READY}"
fi

echo "[osrm] Starting osrm-routed on :${PORT} (MLD)..."
exec osrm-routed --algorithm mld --ip 0.0.0.0 --port "$PORT" "$OSRM_FILE"
