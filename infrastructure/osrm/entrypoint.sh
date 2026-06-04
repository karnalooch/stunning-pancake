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

require_volume_space() {
  # Poland PBF ~1.8 GiB + extract peaks ~6–8 GiB on volume.
  need_kb="${OSRM_VOLUME_MIN_KB:-8388608}"
  avail_kb="$(df -k . | awk 'NR==2 {print $4}')"
  if [ -n "$avail_kb" ] && [ "$avail_kb" -lt "$need_kb" ]; then
    echo "[osrm] ERROR: volume needs >= $((need_kb / 1024 / 1024)) GiB free (have ~$((avail_kb / 1024 / 1024)) GiB). Resize osrm-volume in Railway UI." >&2
    df -h . 2>/dev/null || true
    exit 1
  fi
}

download_pbf() {
  echo "[osrm] Downloading PBF (first run may take several minutes)..."
  require_volume_space
  df -h . 2>/dev/null || true
  rm -f "$PBF_NAME" "${PBF_NAME}.tmp"
  ok=0
  for url in \
    "$PBF_URL" \
    "https://ftp.heanet.ie/mirrors/openstreetmap.ie/download.geofabrik.de/europe/poland-latest.osm.pbf" \
    "https://download.openstreetmap.fr/extracts/europe/poland-latest.osm.pbf"
  do
    [ -n "$url" ] || continue
    echo "[osrm] try: $url"
    if curl -fSL --retry 5 --retry-delay 10 --connect-timeout 60 \
        -o "${PBF_NAME}.tmp" "$url"; then
      ok=1
      break
    fi
    rm -f "${PBF_NAME}.tmp"
  done
  if [ "$ok" -eq 0 ]; then
    echo "[osrm] download failed — upload ${PBF_NAME} to volume ${DATA_DIR} or fix egress" >&2
    df -h . 2>/dev/null || true
    exit 1
  fi
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
