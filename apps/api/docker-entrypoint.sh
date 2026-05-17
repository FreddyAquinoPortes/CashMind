#!/bin/sh
set -e

echo "Running Prisma migrations..."
cd apps/api && npx prisma migrate deploy --schema=./prisma/schema.prisma && cd /app

echo "Starting API..."
exec node apps/api/dist/server.js
