# Собирается из КОРНЯ репозитория (context: .), а не из frontend/ — frontend зависит от
# workspace-пакета ireports-contracts (../contracts) не только как от типов (стираются при сборке),
# но и как от значений (например ruleFormSchema.ts импортирует salaryRuleRequestSchema) — такой
# импорт Rolldown должен реально разрешить на диске, значит contracts/ должен физически
# присутствовать в контексте сборки и быть собран (dist/) до `vite build`. См. docker-compose.yml:
# context: ., dockerfile: frontend/docker/Dockerfile; тот же приём, что и в backend/docker/Dockerfile.

# ---- Builder stage ----
FROM node:22-alpine AS builder
WORKDIR /repo

# ireports-contracts собирается отдельно от своего собственного package.json — frontend НЕ входит
# в корневые npm workspaces (frontend/CLAUDE.md: "ставится независимо"), поэтому здесь нет общего
# `npm ci` в корне, как у backend. `npm install`, а не `npm ci` — у contracts/ нет своего
# package-lock.json (он часть корневых npm workspaces, лочится в корневом package-lock.json), а
# `npm ci` требует lock-файл рядом с package.json.
COPY contracts contracts
RUN cd contracts && npm install && npm run build

COPY frontend frontend
WORKDIR /repo/frontend
RUN npm ci

# VITE_API_URL is baked into the JS bundle at build time
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL

RUN npx vite build

# ---- Production stage ----
FROM nginx:1.27-alpine AS production

COPY --from=builder /repo/frontend/dist /usr/share/nginx/html
COPY --from=builder /repo/frontend/docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
