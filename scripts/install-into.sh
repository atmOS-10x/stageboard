#!/usr/bin/env bash
# Build stageboard, pack it, and install the tarball into another project's vendor/ dir.
set -euo pipefail
target="$(cd "${1:?usage: install-into.sh <project-dir>}" && pwd)"
pkg="$(cd "$(dirname "$0")/../packages/stageboard" && pwd)"
(cd "$pkg" && pnpm build >/dev/null)
mkdir -p "$target/vendor"
rm -f "$target"/vendor/stageboard-*.tgz
tarball="$(cd "$pkg" && npm pack --silent --pack-destination "$target/vendor")"
cd "$target"
rm -rf node_modules/stageboard
npm i -D "file:vendor/$tarball" --no-audit --no-fund --loglevel=error >/dev/null
echo "installed $tarball into $target"
