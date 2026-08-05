#!/usr/bin/env bash
# ==============================================================================
# Center Estates ERP - cPanel Deployment Automation Script
# Target Host: host
# Target Folder: monitoringerp.com
# ==============================================================================

set -e

REMOTE_HOST="${1:-host}"
REMOTE_PATH="${2:-monitoringerp.com}"

echo "🚀 Starting deployment of Center Estates ERP to cPanel [${REMOTE_HOST}:${REMOTE_PATH}]..."

# 1. Build Next.js Production Web Bundle
echo "📦 Step 1: Building Next.js Web Application..."
cd apps/web
npm run build
cd ../..

# 2. Sync Backend & Frontend Assets to cPanel via rsync
echo "📤 Step 2: Uploading application files to ${REMOTE_HOST}:${REMOTE_PATH}..."

rsync -avz --delete \
  --exclude='.git' \
  --exclude='.github' \
  --exclude='.next/cache' \
  --exclude='node_modules' \
  --exclude='__pycache__' \
  --exclude='*.pyc' \
  --exclude='.env' \
  ./ "${REMOTE_HOST}:${REMOTE_PATH}/"

# 3. Touch tmp/restart.txt to reload Phusion Passenger WSGI App
echo "🔄 Step 3: Triggering Phusion Passenger application restart..."
ssh "${REMOTE_HOST}" "mkdir -p ${REMOTE_PATH}/tmp && touch ${REMOTE_PATH}/tmp/restart.txt"

echo "✅ Deployment completed successfully!"
echo "🌐 Your app is now live at: https://monitoringerp.com"
