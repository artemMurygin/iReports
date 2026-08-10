#!/bin/sh
set -e

echo "Running database migrations..."
# npx (а не node_modules/.bin/prisma напрямую) — node_modules теперь лежит в /repo/node_modules
# на уровень выше WORKDIR (/repo/backend), npx ищет бинарник вверх по дереву сам
npx prisma migrate deploy --config prisma.config.ts

echo "Starting application..."
exec node dist/src/main