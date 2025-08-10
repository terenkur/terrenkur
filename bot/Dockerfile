# Use Node.js 18 LTS on Alpine
FROM node:18-alpine

# Create app directory
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy source code
COPY . .

# Run the bot
CMD ["npm", "start"]
