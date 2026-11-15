# Stage 1: Build the React + TypeScript + Vite application
FROM node:20-alpine AS build

WORKDIR /app

# Copy dependency specifications
COPY package*.json ./

# Deterministic package installation
RUN npm ci

# Copy application source files
COPY . .

# Build-time argument for production backend URL
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# Build optimized production bundle to dist/
RUN npm run build

# Stage 2: Serve production bundle with Nginx on port 8080
FROM nginx:alpine

# Remove default nginx configurations
RUN rm -rf /etc/nginx/conf.d/*

# Copy custom Nginx configuration supporting port 8080 and SPA routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled frontend assets from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Expose Cloud Run port 8080
EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
