# Monorepo build — context MUST be repo root:
#   docker build -f admin/Dockerfile .
# Railway: rootDirectory=/ , dockerfilePath=admin/Dockerfile (see admin/railway.json)

FROM node:20-slim AS build

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Workspace manifests (layer cache)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY admin/package.json ./admin/
COPY mobile/package.json ./mobile/
COPY packages/tokens/package.json ./packages/tokens/
COPY packages/api-client/package.json ./packages/api-client/
COPY packages/tsconfig/package.json ./packages/tsconfig/
COPY packages/eslint-config/package.json ./packages/eslint-config/

RUN pnpm install --frozen-lockfile --filter admin...

COPY packages/ ./packages/
COPY admin/ ./admin/

ARG VITE_APP_MODE=GLOBAL_ADMIN
ARG VITE_API_URL
ENV VITE_APP_MODE=$VITE_APP_MODE
ENV VITE_API_URL=$VITE_API_URL

RUN pnpm --filter admin build

FROM nginx:alpine

COPY admin/nginx.conf.template /etc/nginx/conf.d/default.conf.template
COPY --from=build /app/admin/dist /usr/share/nginx/html

RUN chmod -R a+rwx /etc/nginx /var/cache/nginx /var/run /var/log/nginx

CMD /bin/sh -c "export PORT=\${PORT:-8080} && envsubst '\$PORT' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf && exec nginx -g 'daemon off;'"
