#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
configuration="${CONFIGURATION:-release}"
app="$root/build/AI Trip Planner.app"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "build-app.sh needs macOS with the Xcode Command Line Tools." >&2
  exit 1
fi

swift build --package-path "$root" -c "$configuration"
binary="$(swift build --package-path "$root" -c "$configuration" --show-bin-path)/TripPlannerMac"

rm -rf "$app"
mkdir -p "$app/Contents/MacOS" "$app/Contents/Resources"
cp "$binary" "$app/Contents/MacOS/TripPlannerMac"
cp "$root/Resources/Info.plist" "$app/Contents/Info.plist"
cp "$root/Resources/offline.html" "$root/Resources/AppIcon.png" "$app/Contents/Resources/"

iconset="$(mktemp -d)/AppIcon.iconset"
mkdir -p "$iconset"
for size in 16 32 128 256 512; do
  sips -z "$size" "$size" "$root/Resources/AppIcon.png" --out "$iconset/icon_${size}x${size}.png" >/dev/null
  double=$((size * 2))
  sips -z "$double" "$double" "$root/Resources/AppIcon.png" --out "$iconset/icon_${size}x${size}@2x.png" >/dev/null
done
iconutil -c icns "$iconset" -o "$app/Contents/Resources/AppIcon.icns"
rm -rf "$(dirname "$iconset")"

codesign --force --sign "${SIGN_IDENTITY:--}" --timestamp=none "$app"
codesign --verify --strict "$app"
echo "$app"
