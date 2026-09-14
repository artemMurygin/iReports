# Собирается из КОРНЯ репозитория (context: .), а не из frontend/ — frontend зависит от
# workspace-пакета ireports-contracts (../contracts) не только как от типов (стираются при сборке),
# но и как от значений (например ruleFormSchema.ts импортирует salaryRuleRequestSchema) — такой
# импорт Rolldown должен реально разрешить на диске, значит contracts/ должен физически
# присутствовать в контексте сборки и быть собран (dist/) до `vite build`. См. docker-compose.yml:
# context: ., dockerfile: frontend/docker/Dockerfile; тот же приём, что и в backend/docker/Dockerfile.

# ---- Builder stage ----
FROM node:22-alpine AS builder
WORKDIR /repo

# ireports-contracts собирается отдельно от frontend (frontend/CLAUDE.md: "ставится независимо" —
# сам frontend НЕ входит в корневые npm workspaces), но у contracts/ нет своего lock-файла — он
# залочен в корневом package-lock.json (npm workspaces). Поэтому здесь, как и в backend/docker/
# Dockerfile, ставим через корневой `npm ci` (детерминированно, по общему lock-файлу), а не через
# `npm install` внутри contracts/ — там npm сам пересчитывает граф зависимостей с нуля, что на
# практике упиралось в баг npm/Arborist ("Cannot read properties of null (reading 'edgesOut')")
# и молча ронял билд образа.
COPY package.json package-lock.json ./
COPY contracts/package.json contracts/package.json
RUN HUSKY=0 npm ci
COPY contracts contracts
RUN npm run build --workspace=contracts

COPY frontend frontend
WORKDIR /repo/frontend
RUN npm ci

# VITE_API_URL and VITE_BITRIX24_CLIENT_ID are baked into the JS bundle at build time
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
ARG VITE_BITRIX24_CLIENT_ID
ENV VITE_BITRIX24_CLIENT_ID=$VITE_BITRIX24_CLIENT_ID

RUN npx vite build

# ---- Production stage ----
FROM nginx:1.27-alpine AS production

COPY --from=builder /repo/frontend/dist /usr/share/nginx/html
COPY --from=builder /repo/frontend/docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
