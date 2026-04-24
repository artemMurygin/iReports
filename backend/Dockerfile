# ---- Builder stage ----
FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npx prisma generate
RUN npm run build

# ---- Production stage ----
FROM node:22-alpine AS production
WORKDIR /app

# Copy all node_modules from builder (includes prisma CLI needed for migrations)
COPY --from=builder /app/node_modules ./node_modules

# Compiled application
COPY --from=builder /app/dist ./dist

# Prisma files needed for migrate deploy
COPY --from=builder /app/prisma/migrations ./prisma/migrations
COPY --from=builder /app/prisma/schema ./prisma/schema
COPY prisma.config.ts ./

COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]