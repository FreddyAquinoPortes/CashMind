#!/bin/sh
set -e

echo "Running Prisma migrations..."
cd /app/apps/api && npx prisma migrate deploy --schema=./prisma/schema.prisma

echo "Starting API..."
exec node /app/apps/api/dist/server.js
