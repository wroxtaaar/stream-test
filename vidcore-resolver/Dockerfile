FROM --platform=$BUILDPLATFORM node:22-bookworm-slim

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --include=dev --no-audit --no-fund

COPY . .

ENV HOST=0.0.0.0
ENV PORT=3000
EXPOSE 3000

CMD ["npm", "start"]
