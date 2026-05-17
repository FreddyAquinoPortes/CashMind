#!/bin/sh
set -e

echo "Running Prisma migrations..."
npx prisma migrate deploy --schema=./apps/api/prisma/schema.prisma

echo "Starting API..."
exec node apps/api/dist/server.js
