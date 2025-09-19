#!/usr/bin/env bash
set -euo pipefail

# Bootstraps the latest deploy-build locally and serves it for quick inspection.
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# Resolve all paths relative to this script so the workflow works from any cwd.
APP_ROOT="$SCRIPT_DIR"
ARTIFACTS_DIR="$APP_ROOT"
RELEASES_DIR="$APP_ROOT/releases"

SHA=$(cat "$ARTIFACTS_DIR/LATEST.txt")
TARBALL="$RELEASES_DIR/build-$SHA.tar.gz"
CHECKSUM="$TARBALL.sha256"

echo "SHA: $SHA"
echo "TARBALL: $TARBALL"
echo "CHECKSUM: $CHECKSUM"

# verify checksum (optional but recommended)
# Some checksum files still reference the legacy out/ layout; try a few path permutations.
SHA_TARGET=$(awk '{print $2}' "$CHECKSUM")
if [[ -f "$SHA_TARGET" ]]; then
  sha256sum -c "$CHECKSUM"
else
  ALT_TARGET_NO_PREFIX="${SHA_TARGET#out/}"
  ALT_TARGET_RELEASES="$RELEASES_DIR/$ALT_TARGET_NO_PREFIX"
  if [[ -n "$ALT_TARGET_NO_PREFIX" && -f "$ALT_TARGET_NO_PREFIX" ]]; then
    sha256sum -c <(sed "s#$SHA_TARGET#$ALT_TARGET_NO_PREFIX#" "$CHECKSUM")
  elif [[ -f "$ALT_TARGET_RELEASES" ]]; then
    sha256sum -c <(sed "s#$SHA_TARGET#$ALT_TARGET_RELEASES#" "$CHECKSUM")
  else
    echo "Expected artifact $SHA_TARGET (or $ALT_TARGET_RELEASES) is missing" >&2
    exit 1
  fi
fi

OUT_DIR="$APP_ROOT/out"
DEPLOY_DIR="$OUT_DIR/build-$SHA"
PORT="${PORT:-3001}"

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required to run the local HTTP server" >&2
  exit 1
fi

# Recreate the deployment directory on each run to avoid stale assets.
mkdir -p "$OUT_DIR"
rm -rf "$DEPLOY_DIR"
mkdir -p "$DEPLOY_DIR"

tar -xzf "$TARBALL" -C "$DEPLOY_DIR"

echo "Copied build to $DEPLOY_DIR"

if [[ ! -d "$APP_ROOT/shared" ]]; then
  echo "shared directory not found at $APP_ROOT/shared" >&2
  exit 1
fi

# Ship shared datasets/config alongside the static build so the app can boot.
cp -a "$APP_ROOT/shared/." "$DEPLOY_DIR/"

echo "Merged shared assets into build directory"

echo "Serving build from $DEPLOY_DIR on http://localhost:$PORT"
# Allow automated scripts to opt out of running a long-lived server.
if [[ "${SKIP_SERVER:-0}" == "1" ]]; then
  echo "SKIP_SERVER=1 set; skipping HTTP server startup"
  exit 0
fi
echo "Press Ctrl+C to stop the server."
python3 -m http.server "$PORT" --directory "$DEPLOY_DIR"
