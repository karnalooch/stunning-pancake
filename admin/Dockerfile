# Use Node.js for building
FROM node:20-slim AS build

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy project files
COPY . .

# Build the project
ARG VITE_APP_MODE=GLOBAL_ADMIN
ARG VITE_API_URL
ENV VITE_APP_MODE=$VITE_APP_MODE
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# Use Nginx to serve the static files
FROM nginx:alpine

COPY nginx.conf.template /etc/nginx/conf.d/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

RUN chmod -R a+rwx /etc/nginx /var/cache/nginx /var/run /var/log/nginx

CMD /bin/sh -c "export PORT=\${PORT:-8080} && envsubst '\$PORT' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf && exec nginx -g 'daemon off;'"
