#!/bin/sh
set -eu

DATA_DIR="${OSRM_DATA_DIR:-/data}"
PBF_NAME="${OSRM_PBF_NAME:-poland-latest.osm.pbf}"
PBF_URL="${OSRM_PBF_URL:-https://download.geofabrik.de/europe/poland-latest.osm.pbf}"
PROFILE="${OSRM_BUILD_PROFILE:-/opt/car.lua}"
BASE_NAME="${OSRM_BASE_NAME:-poland-latest}"
PORT="${OSRM_PORT:-5000}"
OSRM_FILE="${BASE_NAME}.osrm"
# MLD graph is a set of files; poland-latest.osrm is a prefix, not a single file.
GRAPH_READY="${BASE_NAME}.osrm.mldgr"

echo "[osrm] boot data_dir=${DATA_DIR} graph=${GRAPH_READY}"

mkdir -p "$DATA_DIR"
cd "$DATA_DIR"

if [ ! -f "$GRAPH_READY" ]; then
  if [ ! -f "$PBF_NAME" ]; then
    echo "[osrm] Downloading ${PBF_URL} (first run may take several minutes)..."
    wget -q --show-progress -O "$PBF_NAME" "$PBF_URL" || {
      echo "[osrm] wget failed — place ${PBF_NAME} in volume ${DATA_DIR}" >&2
      exit 1
    }
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
