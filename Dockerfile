FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies (required for some packages with native extensions)
RUN apk add --no-cache libc6-compat

# Copy dependency definitions
COPY package.json package-lock.json* bun.lock* ./

# Install dependencies
RUN npm install

# Copy application source
COPY . .

# Disable Next.js telemetry during build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build the production application
RUN npm run build

# --- Runner Stage ---
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Install runtime dependencies if needed
RUN apk add --no-cache libc6-compat

# Create a non-privileged nextjs system user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Create persistent data directory and set ownership
RUN mkdir -p /app/data && chown -R nextjs:nodejs /app/data

# Copy built application, static files, and modules
COPY --from=builder /app/.next /app/.next
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/package.json /app/package.json
COPY --from=builder /app/next.config.ts /app/next.config.ts
COPY --from=builder /app/app /app/app
COPY --from=builder /app/lib /app/lib

# Ensure correct permissions for the whole app
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

# Start the application
CMD ["npm", "run", "start"]
