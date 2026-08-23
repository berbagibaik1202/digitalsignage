FROM node:20-alpine AS builder

WORKDIR /app

# Install ALL dependencies (including dev for build)
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npx tsc

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Copy source files (needed for ts-node migration)
COPY --from=builder /app/src ./src

# Copy migrations folder (needed for npm run migrate)
COPY --from=builder /app/migrations ./migrations

# Copy config files needed at runtime
COPY --from=builder /app/.env* ./

EXPOSE 3000

CMD ["node", "dist/server.js"]
