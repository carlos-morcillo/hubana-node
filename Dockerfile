# Use Node.js with Debian (same as official Carbone images)
FROM node:20-bookworm-slim

# Install LibreOffice and dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice-writer \
    libreoffice-calc \
    libreoffice-impress \
    fonts-liberation \
    fonts-dejavu \
    && rm -rf /var/lib/apt/lists/*

# App Setup
WORKDIR /app

# Copy package files first for caching
COPY package*.json ./
RUN npm install --production

# Copy source
COPY index.js ./

EXPOSE 3001

CMD [ "node", "index.js" ]
