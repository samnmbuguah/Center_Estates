#!/usr/bin/env bash
# ==============================================================================
# Center Estates ERP - cPanel Deployment Automation Script
# Target Host: host
# Target Path: /home2/monitori/monitoringerp.com
# Virtualenv: /home2/monitori/virtualenv/monitoringerp.com/3.9/bin/activate
# ==============================================================================

set -e

REMOTE_HOST="${1:-host}"
REMOTE_PATH="${2:-/home2/monitori/monitoringerp.com}"
VENV_PATH="/home2/monitori/virtualenv/monitoringerp.com/3.9/bin/activate"

echo "🚀 Starting deployment of Center Estates ERP to cPanel [${REMOTE_HOST}:${REMOTE_PATH}]..."

# 1. Build Next.js Production Web Application
echo "📦 Step 1: Building Next.js Web Application..."
cd apps/web
npm run build
cd ../..

# 2. Sync Files to cPanel via rsync
echo "📤 Step 2: Syncing application code to ${REMOTE_HOST}:${REMOTE_PATH}..."
rsync -avz --delete \
  --exclude='.git' \
  --exclude='.github' \
  --exclude='.next/cache' \
  --exclude='node_modules' \
  --exclude='__pycache__' \
  --exclude='*.pyc' \
  --exclude='.env' \
  ./ "${REMOTE_HOST}:${REMOTE_PATH}/"

# 3. Remote Setup & Dependency Installation
echo "⚙️ Step 3: Installing Python dependencies and running migrations..."
ssh "${REMOTE_HOST}" "
  source ${VENV_PATH}
  cd ${REMOTE_PATH}
  pip install --quiet --upgrade pip
  pip install --quiet -r apps/backend/requirements.txt PyMySQL
  python apps/backend/manage.py migrate --noinput || true
  python apps/backend/manage.py collectstatic --noinput || true
  mkdir -p tmp
  touch tmp/restart.txt
"

echo "✅ Deployment complete! Phusion Passenger restarted."
echo "🌐 Verify live site at: https://monitoringerp.com"
