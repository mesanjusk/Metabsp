# Build context must be the REPO ROOT (not backend/), because this is an npm
# workspaces monorepo — dependency resolution/hoisting needs the root
# package.json + package-lock.json. Build with:
#   docker build -f backend/Dockerfile -t metabsp-backend .

FROM node:20-alpine AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
RUN npm ci --workspace=backend --omit=dev

FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=deps --chown=node:node /repo/node_modules ./node_modules
COPY --chown=node:node backend ./backend

WORKDIR /repo/backend
EXPOSE 5000

# Not root — reduces blast radius if the process is ever compromised.
USER node

CMD ["node", "src/index.js"]
