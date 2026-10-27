FROM node:18-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 7000
ENV PORT=7000

CMD ["npm", "start"]
