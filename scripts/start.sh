#!/bin/sh
set -e

echo "Running database migrations..."
MAX_RETRIES=10
RETRY_INTERVAL=3
retries=0

until npx prisma migrate deploy 2>&1; do
  retries=$((retries + 1))
  if [ "$retries" -ge "$MAX_RETRIES" ]; then
    echo "ERROR: Migrations failed after $MAX_RETRIES attempts."
    exit 1
  fi
  echo "Attempt $retries/$MAX_RETRIES failed. Retrying in ${RETRY_INTERVAL}s..."
  sleep "$RETRY_INTERVAL"
done

echo "Migrations done. Starting server..."
exec node dist/src/main.js
