FROM node:20-slim AS builder

WORKDIR /app

# Install build dependencies required for compiling native node modules if any
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency definitions
COPY package.json package-lock.json* ./

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
FROM node:20-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Create a non-privileged nextjs system user
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 nextjs

# Create persistent data directory and set ownership
RUN mkdir -p /app/data && chown -R nextjs:nodejs /app/data

# Copy built application, static files, and modules
COPY --from=builder --chown=nextjs:nodejs /app/.next /app/.next
COPY --from=builder --chown=nextjs:nodejs /app/node_modules /app/node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json /app/package.json
COPY --from=builder --chown=nextjs:nodejs /app/next.config.ts /app/next.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/app /app/app
COPY --from=builder --chown=nextjs:nodejs /app/lib /app/lib

# Ensure correct permissions for the whole app
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

# Start the application
CMD ["npm", "run", "start"]
