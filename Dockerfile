# Built from the lockfile, so the image installs the versions that were tested
# rather than whatever resolves on the day of the build.

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# The test harness's browser is a development tool and has no business in an
# image: playwright would otherwise pull a hundred megabytes of Chromium here.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Every page that reads content is dynamic, so the build never opens a database
# connection and needs no DATABASE_URL.
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3100
ENV HOSTNAME=0.0.0.0
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# The migrations travel with the image, so a release can apply its own schema:
#   docker compose exec web node scripts/migrate.mjs
COPY --from=builder --chown=nextjs:nodejs /app/migrations ./migrations
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
# Uploaded images are not part of the build: they arrive at runtime and live in
# a volume mounted here. Creating it now, owned by the app, is what makes Docker
# hand the volume over with the right owner the first time it is mounted.
RUN mkdir -p /app/uploads && chown nextjs:nodejs /app/uploads
USER nextjs
EXPOSE 3100
CMD ["node", "server.js"]
