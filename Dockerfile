FROM node:20-bookworm

# Install LibreOffice and fonts for PDF generation
# we install 'libreoffice-nogui' to avoid X11 dependencies if available, 
# otherwise standard libreoffice plus some fonts
RUN apt-get update && apt-get install -y \
    libreoffice \
    fonts-noto \
    fonts-noto-cjk \
    && apt-get clean && rm -rf /var/lib/apt/lists/*


# App Setup
WORKDIR /app

# Copy package files first for caching
COPY package*.json ./
RUN npm install

# Copy source
COPY index.js ./
# If you have other folders like 'docs', copy them too or use COPY . .
COPY docs ./docs

EXPOSE 3001

CMD [ "node", "index.js" ]

