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

# 2. Package codebase into lightweight archive
echo "📦 Step 2: Packaging application archive..."
tar -czf /tmp/deploy.tar.gz \
  --exclude='.git' \
  --exclude='.github' \
  --exclude='.next/cache' \
  --exclude='node_modules' \
  --exclude='__pycache__' \
  --exclude='*.pyc' \
  --exclude='.env' \
  .

# 3. Upload archive to cPanel server
echo "📤 Step 3: Uploading archive to ${REMOTE_HOST}:${REMOTE_PATH}..."
scp /tmp/deploy.tar.gz "${REMOTE_HOST}:${REMOTE_PATH}/deploy.tar.gz"

# 4. Extract and initialize environment on remote server
echo "⚙️ Step 4: Extracting files, installing dependencies, and running migrations..."
ssh "${REMOTE_HOST}" "
  source ${VENV_PATH}
  cd ${REMOTE_PATH}
  tar -xzf deploy.tar.gz
  rm -f deploy.tar.gz
  pip install --quiet --upgrade pip
  pip install --quiet -r apps/backend/requirements.txt PyMySQL
  python apps/backend/manage.py migrate --noinput || true
  python apps/backend/manage.py collectstatic --noinput || true
  
  # Set AI / QM API key for the Companion module
  export OPENCODE_API_KEY='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'
  export OPENAI_API_KEY='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'
  
  # Seed demo data (users, organization, modules, demo records)
  export DJANGO_DEBUG='false'
  export SEED_DEMO_DATA='true'
  export SEED_ADMIN_USERNAME='admin'
  export SEED_ADMIN_PASSWORD='S/2xvBbssIGJJwjOEbOni4JyHQ7tJc0f'
  python apps/backend/manage.py seed_platform || true
  python apps/backend/manage.py seed_construction || true
  
  mkdir -p tmp
  touch tmp/restart.txt
"

echo "✅ Deployment complete! Phusion Passenger restarted."
echo "🌐 Verify live site at: https://monitoringerp.com"
