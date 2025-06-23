#!/bin/sh

# Exit if any command fails
set -e

# Clean and recreate dist folder
rm -rf dist
mkdir -p dist

# Step 1: Compile TypeScript
npm run build

# Step 2: Copy index.html to dist
cp src/index.html dist/index.html

# Step 3: Copy all .css files
cp src/*.css dist/

# Step 4: Replace "main.ts" with "main.js" in the copied HTML
sed -i 's/\.ts/\.js/g' dist/index.html

echo "Build completed successfully."
