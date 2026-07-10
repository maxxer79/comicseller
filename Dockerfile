# Comicseller — single production image: backend serves the built frontend.
# Multi-stage; built multi-arch (amd64 + arm64) by CI so it runs on any NAS.

# ---- Stage 1: build the frontend ----
FROM node:22-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---- Stage 2: build the backend ----
FROM node:22-slim AS backend
WORKDIR /app/backend
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
RUN npx prisma generate
RUN npm run build

# ---- Stage 3: runtime ----
FROM node:22-slim AS runtime
WORKDIR /app/backend
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production

# Bring over installed deps (incl. generated Prisma client + engine) and build.
COPY --from=backend /app/backend/node_modules ./node_modules
COPY --from=backend /app/backend/dist ./dist
COPY --from=backend /app/backend/package.json ./package.json
COPY backend/prisma ./prisma
COPY backend/scripts ./scripts
COPY VERSION /app/VERSION
COPY --from=frontend /app/frontend/dist /app/frontend/dist

# Build metadata (stamped by CI).
ARG BUILD_SHA=dev
ARG BUILD_TIME=
ENV BUILD_SHA=$BUILD_SHA \
    BUILD_TIME=$BUILD_TIME \
    SERVE_FRONTEND=1 \
    FRONTEND_DIR=/app/frontend/dist \
    PORT=4000

EXPOSE 4000

# Sync schema to the database on boot, then start the server.
CMD ["sh", "-c", "./node_modules/.bin/prisma db push --skip-generate && node --experimental-sqlite dist/index.js"]
