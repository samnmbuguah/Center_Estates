#!/usr/bin/env bash
# Generate OpenAPI schema from Django and compile TypeScript types for Next.js.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCHEMA_FILE="${ROOT_DIR}/schema.yml"
TYPES_FILE="${ROOT_DIR}/apps/web/src/types/api.generated.ts"
PYTHON_BIN="${ROOT_DIR}/apps/backend/.venv/bin/python"

if [ ! -f "${PYTHON_BIN}" ]; then
  PYTHON_BIN="python"
fi

echo "==> 1. Exporting OpenAPI schema from Django..."
"${PYTHON_BIN}" "${ROOT_DIR}/apps/backend/manage.py" spectacular --file "${SCHEMA_FILE}"

echo "==> 2. Compiling TypeScript types with openapi-typescript..."
npx -y openapi-typescript "${SCHEMA_FILE}" -o "${TYPES_FILE}"

echo "==> Successfully generated: ${TYPES_FILE}"
