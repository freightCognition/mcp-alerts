FROM node:18-alpine AS base

# Install pnpm
RUN npm install -g pnpm

WORKDIR /usr/src/app

# Copy package manifest and lockfile
COPY package.json pnpm-lock.yaml ./

# Install production dependencies
RUN pnpm install --prod

# Copy application code
COPY . .

# Expose the application port
EXPOSE ${PORT:-3001}

# Command to run the application
CMD ["node", "app.js"]
