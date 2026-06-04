#!/usr/bin/env bash
# Convert build/icon.png -> build/icon.icns using macOS-native tools.
set -euo pipefail
cd "$(dirname "$0")/.."

SRC=build/icon.png
ICONSET=build/icon.iconset
OUT=build/icon.icns

if [ ! -f "$SRC" ]; then
  echo "Missing $SRC — run scripts/make-icon.py first." >&2
  exit 1
fi

rm -rf "$ICONSET"
mkdir -p "$ICONSET"

# Required sizes for a macOS .icns
sips -z 16 16     "$SRC" --out "$ICONSET/icon_16x16.png"        >/dev/null
sips -z 32 32     "$SRC" --out "$ICONSET/icon_16x16@2x.png"     >/dev/null
sips -z 32 32     "$SRC" --out "$ICONSET/icon_32x32.png"        >/dev/null
sips -z 64 64     "$SRC" --out "$ICONSET/icon_32x32@2x.png"     >/dev/null
sips -z 128 128   "$SRC" --out "$ICONSET/icon_128x128.png"      >/dev/null
sips -z 256 256   "$SRC" --out "$ICONSET/icon_128x128@2x.png"   >/dev/null
sips -z 256 256   "$SRC" --out "$ICONSET/icon_256x256.png"      >/dev/null
sips -z 512 512   "$SRC" --out "$ICONSET/icon_256x256@2x.png"   >/dev/null
sips -z 512 512   "$SRC" --out "$ICONSET/icon_512x512.png"      >/dev/null
cp "$SRC"                       "$ICONSET/icon_512x512@2x.png"

iconutil -c icns "$ICONSET" -o "$OUT"
rm -rf "$ICONSET"
echo "wrote $OUT"
