FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json ./
COPY server.js ./
USER node
EXPOSE 10080
ENV PORT=10080
CMD ["npm", "start"]
