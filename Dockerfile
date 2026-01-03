ARG NODE_IMAGE
FROM $NODE_IMAGE

# Carbone
USER node
WORKDIR /home/node
COPY --chown=node:node package*.json ./
RUN npm install
COPY --chown=node:node index.js ./
EXPOSE 3001
CMD [ "node", "index.js" ]

