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

# Configure nginx to run as non-root on the dynamic $PORT
# We use a template for nginx config to substitute $PORT
RUN printf "server {\n  listen %s;\n  location / {\n    root /usr/share/nginx/html;\n    index index.html index.htm;\n    try_files \$uri \$uri/ /index.html;\n  }\n}\n" '${PORT}' > /etc/nginx/conf.d/default.conf.template

COPY --from=build /app/dist /usr/share/nginx/html

# We use a wrapper to substitute the port in nginx config at runtime
CMD /bin/sh -c "envsubst '\$PORT' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf && exec nginx -g 'daemon off;'"
