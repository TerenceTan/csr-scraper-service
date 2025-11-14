# Use official Playwright image with pre-installed browsers
FROM mcr.microsoft.com/playwright:v1.56.1-noble

# Set working directory
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@10.4.1

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy application code
COPY . .

# Build the application
RUN pnpm run build

# Expose port
EXPOSE 3000

# Set environment to production
ENV NODE_ENV=production

# Start the application
CMD ["pnpm", "start"]
