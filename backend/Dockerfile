FROM node:20-alpine AS builder

WORKDIR /app

# Install ALL dependencies (including dev for build)
# Cache bust: force reinstall
COPY package*.json ./
RUN echo "Installing all deps for build..." && npm ci

# Copy source and build
COPY . .
RUN echo "Building TypeScript..." && npx tsc

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy built files from builder
COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/server.js"]
