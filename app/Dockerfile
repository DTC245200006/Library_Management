# Use official lightweight Node.js 20 LTS image
FROM node:20-alpine

# Hardening: Run as non-root user
WORKDIR /usr/src/app

# Copy dependency definition
COPY package*.json ./

# Install production dependencies
RUN npm install --only=production

# Copy source code and change ownership to non-root user 'node'
COPY . .
RUN chown -R node:node /usr/src/app

# Switch to non-root user (Hardening criterion)
USER node

# Expose internal application port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start server
CMD ["node", "server.js"]
