FROM node:22-bookworm-slim

ENV NODE_ENV=production
WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev --omit=optional --no-package-lock

COPY server.js ./
COPY public ./public
USER node
EXPOSE 3000
CMD ["npm", "start"]
