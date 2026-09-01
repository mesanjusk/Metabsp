# Multi-stage build for the MetaBSP app.
#
# The app runs as one persistent Node process (server.js) rather than under
# `next start`, because Socket.IO needs the raw HTTP server and the queue
# workers need to outlive a request. That rules out Next's `standalone`
# output, which ships its own server — so this stage keeps node_modules and
# runs server.js directly.
FROM node:20-alpine AS deps
WORKDIR /app
COPY nextjs/package.json nextjs/package-lock.json ./
RUN npm ci

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY nextjs/ ./
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Never run as root; a compromise in the app should not own the container.
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=build --chown=nextjs:nodejs /app/.next ./.next
COPY --from=build --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=build --chown=nextjs:nodejs /app/server.js ./server.js
COPY --from=build --chown=nextjs:nodejs /app/next.config.js ./next.config.js
COPY --from=build --chown=nextjs:nodejs /app/lib ./lib
COPY --from=build --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
