#!/bin/sh
set -eu

if [ -f /run/secrets/django_secret ]; then
  DJANGO_SECRET_KEY="$(tr -d '\n' < /run/secrets/django_secret)"
  export DJANGO_SECRET_KEY
fi
if [ -f /run/secrets/db_password ]; then
  DB_PASSWORD="$(tr -d '\n' < /run/secrets/db_password)"
  export DB_PASSWORD
fi
if [ -f /run/secrets/seed_admin_password ]; then
  SEED_ADMIN_PASSWORD="$(tr -d '\n' < /run/secrets/seed_admin_password)"
  export SEED_ADMIN_PASSWORD
fi

python manage.py migrate --noinput
python manage.py collectstatic --noinput

if [ "${SEED_DEMO_DATA:-false}" = "true" ]; then
  python manage.py seed_platform
fi

exec gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers "${GUNICORN_WORKERS:-3}" --timeout 120 --access-logfile - --error-logfile -

