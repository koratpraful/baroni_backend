#!/bin/bash

# Baroni Project Cleanup Script
# This script cleans your Node.js project to save storage space

echo "🧹 Starting Baroni project cleanup..."
echo ""

# Get initial size
if [ -d "node_modules" ]; then
    INITIAL_SIZE=$(du -sh node_modules 2>/dev/null | cut -f1)
    echo "📊 Current node_modules size: $INITIAL_SIZE"
else
    echo "📊 node_modules not found - project already clean"
fi
echo ""

# Stop running processes
echo "🛑 Stopping running Node.js processes..."
pkill -f "node|nodemon" 2>/dev/null || true
echo "✅ Processes stopped"
echo ""

# Remove dependencies and lock files
echo "🗂️  Cleaning package management files..."
rm -rf node_modules && echo "✅ Removed node_modules directory" || echo "ℹ️  node_modules - already clean"
rm -f package-lock.json && echo "✅ Removed package-lock.json" || echo "ℹ️  package-lock.json - already clean"
rm -f yarn.lock && echo "✅ Removed yarn.lock" || echo "ℹ️  yarn.lock - already clean"
rm -rf .npm && echo "✅ Removed .npm cache" || echo "ℹ️  .npm cache - already clean"
rm -rf .yarn && echo "✅ Removed .yarn directory" || echo "ℹ️  .yarn directory - already clean"
echo ""

# Clean npm cache
echo "🗃️  Cleaning npm cache..."
npm cache clean --force 2>/dev/null && echo "✅ npm cache cleared" || echo "ℹ️  npm cache - already clean"
echo ""

# Clean temporary directories
echo "🗂️  Cleaning temporary directories..."
rm -rf .nyc_output coverage logs .cache dist build .next .nuxt out 2>/dev/null
echo "✅ Temporary directories cleaned"
echo ""

# Clean log files
echo "📝 Cleaning log files..."
find . -name "*.log" -type f -delete 2>/dev/null || true
find . -name "npm-debug.log*" -type f -delete 2>/dev/null || true
find . -name "yarn-debug.log*" -type f -delete 2>/dev/null || true
find . -name "yarn-error.log*" -type f -delete 2>/dev/null || true
echo "✅ Log files cleaned"
echo ""

# Clean OS specific files
echo "🖥️  Cleaning OS specific files..."
find . -name ".DS_Store" -type f -delete 2>/dev/null || true
find . -name "Thumbs.db" -type f -delete 2>/dev/null || true
find . -name "desktop.ini" -type f -delete 2>/dev/null || true
echo "✅ OS files cleaned"
echo ""

# Summary
echo "📊 Cleanup Summary:"
if [ -n "$INITIAL_SIZE" ]; then
    echo "   • Freed approximately: $INITIAL_SIZE"
fi
echo "   • Project is now clean and ready for storage"
echo ""

echo "🎯 To restart the project later:"
echo "   1. npm install"
echo "   2. npm run dev"
echo ""

echo "✨ Cleanup completed successfully!"