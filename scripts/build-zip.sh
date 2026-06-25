#!/bin/bash
# Build extension and create ZIP for manual installation
set -euo pipefail

cd "$(dirname "$0")/.."

echo "Building Startmark..."
npm run build

echo "Creating ZIP..."
VERSION=$(node -p "require('./package.json').version")
mkdir -p dist-website
zip -j "dist-website/startmark-v${VERSION}.zip" .output/chrome-mv3/* -x "*.DS_Store"

echo "Done: dist-website/startmark-v${VERSION}.zip"
