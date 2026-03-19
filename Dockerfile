FROM node:22-slim AS builder
WORKDIR /app

# Install dependencies (all, including devDeps needed for vite/tsx build)
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

# Generate Prisma client
RUN ./node_modules/.bin/prisma generate

# Build Vite SPA frontend → ./dist
RUN npm run build

# Build Next.js API routes → ./.next
RUN npm run next:build

# ── Production image ────────────────────────────────────────────────────────
FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

COPY package*.json ./
RUN npm ci --omit=dev

# Copy build artifacts
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copy runtime source files
COPY server.ts .
COPY tsconfig*.json ./
COPY prisma/ ./prisma/
COPY public/ ./public/
COPY next.config.* ./

EXPOSE 8080

# Node 22 has built-in TypeScript strip-types support
CMD ["node", "--experimental-strip-types", "server.ts"]
