# Use Node.js 20 LTS on Alpine
FROM node:20-alpine

# Create app directory
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy source code
COPY . .

# Expose healthcheck port
EXPOSE 3000

# Run the bot
CMD ["npm", "start"]
