# Build context must be the REPO ROOT (not frontend/), because this is an
# npm workspaces monorepo. Build with:
#   docker build -f frontend/Dockerfile \
#     --build-arg VITE_API_SERVER=https://api.example.com \
#     -t metabsp-frontend .

FROM node:20-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/package.json
RUN npm ci --workspace=frontend
COPY frontend ./frontend

ARG VITE_API_SERVER
ARG VITE_API_URL
ARG VITE_SOCKET_URL
ENV VITE_API_SERVER=$VITE_API_SERVER
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL

RUN npm run build --workspace=frontend

FROM nginx:1.27-alpine
COPY --from=build /repo/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
