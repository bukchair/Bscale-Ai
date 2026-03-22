FROM node:22-slim AS builder
WORKDIR /app

# Install build tools needed for native modules (e.g. better-sqlite3)
# python-is-python3 creates /usr/bin/python symlink required by node-gyp
RUN apt-get update && apt-get install -y python3 python-is-python3 make g++ && rm -rf /var/lib/apt/lists/*
ENV npm_config_python=python3

# Install dependencies (all, including devDeps needed for build)
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

# Admin email – baked into client bundle at build time and available at runtime
ENV NEXT_PUBLIC_ADMIN_EMAIL="asher205@gmail.com"

# Build: runs prisma generate + next build
RUN npm run build

# ── Production image ────────────────────────────────────────────────────────
FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
ENV NEXT_PUBLIC_ADMIN_EMAIL="asher205@gmail.com"

# Install build tools needed for native modules (e.g. better-sqlite3)
# python-is-python3 creates /usr/bin/python symlink required by node-gyp
RUN apt-get update && apt-get install -y python3 python-is-python3 make g++ && rm -rf /var/lib/apt/lists/*
ENV npm_config_python=python3

COPY package*.json ./
RUN npm ci --omit=dev

# Copy build artifacts
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
