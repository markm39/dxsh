# Dashboard Application Dockerfile
# Multi-stage build for production optimization

# Stage 1: Build stage
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including devDependencies for build)
RUN npm ci && npm cache clean --force

# Copy source code
COPY . .

# Build arguments for configuration
ARG VITE_WORKFLOW_API_URL=http://localhost:5000
ARG VITE_WORKFLOW_API_KEY=""

# Set environment variables for build
ENV VITE_WORKFLOW_API_URL=$VITE_WORKFLOW_API_URL
ENV VITE_WORKFLOW_API_KEY=$VITE_WORKFLOW_API_KEY

# Build the application
RUN npm run build

# Stage 2: Production stage
FROM nginx:alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Copy custom nginx config
COPY nginx.conf /etc/nginx/nginx.conf

# Copy built application
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy startup script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Start nginx
CMD ["/docker-entrypoint.sh"]