FROM node:20-alpine AS deps-backend
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci

FROM node:20-alpine AS deps-frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci --ignore-scripts

FROM node:20-alpine AS build-frontend
WORKDIR /app/frontend
COPY --from=deps-frontend /app/frontend/node_modules ./node_modules
COPY frontend/ ./
RUN npm run build

FROM node:20-alpine AS build-backend
WORKDIR /app/backend
COPY --from=deps-backend /app/backend/node_modules ./node_modules
COPY backend/ ./
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache dumb-init

COPY --from=build-backend /app/backend/dist ./dist
COPY --from=build-backend /app/backend/node_modules ./node_modules
COPY --from=build-backend /app/backend/prisma ./prisma
COPY --from=build-frontend /app/frontend/dist ./public

RUN mkdir -p /app/uploads

EXPOSE 7666

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

ENTRYPOINT ["dumb-init", "--"]
CMD ["/docker-entrypoint.sh"]
