FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json ./
COPY server.js ./
USER node
EXPOSE 10081
ENV PORT=10081
CMD ["npm", "start"]
