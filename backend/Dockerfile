# syntax=docker/dockerfile:1
# Build context: repository root (the Prisma schema lives in database/).
#   docker build -f backend/Dockerfile -t securedeploy-backend .
FROM node:22-alpine AS builder
WORKDIR /app/backend
COPY backend/package*.json ./
COPY database ../database
RUN npm ci
COPY backend/ .
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine AS runner
ENV NODE_ENV=production
# Scanner CLIs for /api/scans (grype, syft, trivy).
RUN apk add --no-cache curl \
 && curl -sSfL https://raw.githubusercontent.com/anchore/grype/main/install.sh | sh -s -- -b /usr/local/bin \
 && curl -sSfL https://raw.githubusercontent.com/anchore/syft/main/install.sh | sh -s -- -b /usr/local/bin \
 && curl -sSfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin
WORKDIR /app/backend
COPY --from=builder /app/database ../database
COPY --from=builder /app/backend/dist ./dist
COPY --from=builder /app/backend/node_modules ./node_modules
COPY --from=builder /app/backend/package.json ./
USER node
EXPOSE 3001
HEALTHCHECK --interval=15s --timeout=3s --start-period=30s CMD wget -qO- http://127.0.0.1:3001/api/health || exit 1
# Apply pending migrations, then start.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
