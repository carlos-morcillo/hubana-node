FROM carboneio/node-carbone:latest

# App Setup
WORKDIR /app

# Copy package files first for caching
COPY package*.json ./
RUN npm install

# Copy source
COPY index.js ./
COPY docs ./docs

EXPOSE 3001

CMD [ "node", "index.js" ]
