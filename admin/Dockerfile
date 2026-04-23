# Use Node.js for building
FROM node:20-slim AS build

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy project files
COPY . .

# Build the project
RUN npm run build

# Use Nginx to serve the static files
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
# Copy custom nginx config if needed, but default is usually fine for simple SPA
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
