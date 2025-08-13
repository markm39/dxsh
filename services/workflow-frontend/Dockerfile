# Builder service Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# Install python and build tools for native dependencies
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Clean install dependencies
RUN npm ci || npm install

# Copy all source files
COPY . .

# Set build-time environment variables
ARG VITE_API_BASE_URL=http://localhost:8001
ARG VITE_APP_NAME=Dxsh Workflow Builder
ARG VITE_NODE_ENV=production

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Install serve globally
RUN npm install -g serve

# Copy built files from builder stage
COPY --from=builder /app/dist ./dist

# Expose port
EXPOSE 3000

# Serve the built application
CMD ["serve", "-s", "dist", "-l", "3000"]