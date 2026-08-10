# Собирается из КОРНЯ репозитория (context: .), а не из backend/ — backend зависит от
# workspace-пакета ireports-contracts (../contracts), который резолвится только через
# корневой npm workspace. См. docker-compose.yml: context: ., dockerfile: backend/docker/Dockerfile.

# ---- Builder stage ----
FROM node:22-alpine AS builder
WORKDIR /repo

# Сначала только манифесты — для кэширования слоя npm ci между сборками
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY contracts/package.json contracts/package.json
RUN HUSKY=0 npm ci

# ireports-contracts должен быть собран (dist/) до сборки backend — TS резолвит его
# как обычный пакет (contracts/package.json -> dist/index.js), а не по алиасу исходников
COPY contracts contracts
RUN npm run build --workspace=contracts

COPY backend backend
# cwd специально backend/ — часть зависимостей (например prisma) npm workspaces кладёт
# не в корневой node_modules, а вложенно в backend/node_modules, и npx находит бинарники
# только вверх по дереву от cwd, а не в дочерних директориях
RUN cd backend && npx prisma generate --config src/config/prisma.config.ts
RUN npm run build --workspace=backend

# ---- Production stage ----
FROM node:22-alpine AS production
WORKDIR /repo/backend

# node_modules из корня (хранит workspace-симлинк ireports-contracts -> ../contracts)
COPY --from=builder /repo/node_modules /repo/node_modules
# + вложенный node_modules самого backend (часть зависимостей, включая prisma CLI для
# migrate deploy в docker-entrypoint.sh, npm workspaces хостит именно сюда, а не в корень)
COPY --from=builder /repo/backend/node_modules ./node_modules
# Сам ireports-contracts (цель симлинка), собранный на предыдущем шаге
COPY --from=builder /repo/contracts/package.json /repo/contracts/package.json
COPY --from=builder /repo/contracts/dist /repo/contracts/dist

# Скомпилированное приложение
COPY --from=builder /repo/backend/dist ./dist

# Файлы Prisma, нужные для migrate deploy
COPY --from=builder /repo/backend/prisma/migrations ./prisma/migrations
COPY --from=builder /repo/backend/prisma/schema ./prisma/schema
COPY backend/src/config/prisma.config.ts ./src/config/prisma.config.ts

COPY --from=builder /repo/backend/package.json ./package.json

COPY backend/docker/docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
