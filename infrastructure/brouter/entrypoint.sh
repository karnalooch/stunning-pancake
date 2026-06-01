#!/bin/sh
set -e

SEGDIR="${BROUTER_SEGMENTS_DIR:-/brouter/segments4}"
BASE="${BROUTER_SEGMENTS_URL:-https://brouter.de/brouter/segments4}"
PRESET="${BROUTER_SEGMENT_PRESET:-poland}"
AUTO="${BROUTER_AUTO_DOWNLOAD_SEGMENTS:-1}"

JAVA_XMX="${BROUTER_JAVA_XMX:-768m}"
JAVA_XMS="${BROUTER_JAVA_XMS:-64m}"

mkdir -p "$SEGDIR"

min_bytes() {
  # Ignore stub/empty tiles (< 1 MiB).
  echo 1000000
}

tile_ready() {
  f="$1"
  path="$SEGDIR/$f"
  min="$(min_bytes)"
  if [ -f "$path" ]; then
    size=$(wc -c <"$path" | tr -d ' ')
    if [ "$size" -ge "$min" ]; then
      return 0
    fi
  fi
  return 1
}

download_tile() {
  f="$1"
  dest="$SEGDIR/$f"
  if tile_ready "$f"; then
    echo "[brouter] segment present: $f"
    return 0
  fi
  echo "[brouter] downloading $f from $BASE/ ..."
  wget -q --continue --timeout=120 --tries=3 -O "${dest}.tmp" "${BASE}/${f}"
  mv "${dest}.tmp" "$dest"
  echo "[brouter] saved $f ($(wc -c <"$dest" | tr -d ' ') bytes)"
}

# Poland ~14–24°E, 49–55°N → SW corners E10–E25, N40–N55 (5°×5° tiles).
POLAND_TILES="E10_N45.rd5 E10_N50.rd5 E10_N55.rd5 \
E15_N40.rd5 E15_N45.rd5 E15_N50.rd5 E15_N55.rd5 \
E20_N40.rd5 E20_N45.rd5 E20_N50.rd5 E20_N55.rd5 \
E25_N40.rd5 E25_N45.rd5 E25_N50.rd5 E25_N55.rd5"

MINIMAL_TILES="E15_N50.rd5 E20_N45.rd5 E20_N50.rd5"

case "$AUTO" in
  0|false|FALSE|no|NO|off|OFF) AUTO=0 ;;
  *) AUTO=1 ;;
esac

if [ "$AUTO" = 1 ]; then
  TILES=""
  case "$PRESET" in
    poland|PL|pl) TILES=$POLAND_TILES ;;
    minimal|min) TILES=$MINIMAL_TILES ;;
    none|off|0) TILES="" ;;
    custom) TILES=$(echo "${BROUTER_SEGMENT_TILES:-}" | tr ',' ' ') ;;
    *)
      echo "[brouter] unknown BROUTER_SEGMENT_PRESET=$PRESET (use poland|minimal|custom|none)" >&2
      exit 1
      ;;
  esac

  if [ -n "$TILES" ]; then
    echo "[brouter] auto-download preset=$PRESET -> $SEGDIR"
    for tile in $TILES; do
      download_tile "$tile"
    done
  fi
fi

exec java -Xmx"$JAVA_XMX" -Xms"$JAVA_XMS" \
  -cp brouter.jar \
  btools.server.BRouter \
  "$SEGDIR" \
  foot-all.brf,bicycle.brf \
  17777 1
