#!/bin/bash
# Build extension and create ZIP for manual installation
set -euo pipefail

cd "$(dirname "$0")/.."

echo "Building Startmark..."
npm run build

echo "Creating ZIP..."
VERSION=$(node -p "require('./package.json').version")
mkdir -p dist
zip -j "dist/startmark-v${VERSION}.zip" .output/chrome-mv3/* -x "*.DS_Store"

echo "Done: dist/startmark-v${VERSION}.zip"
