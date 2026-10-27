FROM node:20-bookworm-slim

ENV NODE_ENV=production
WORKDIR /app

# Puppeteer is a dependency upstream. Download its browser during build, and
# include system libraries commonly required by Chromium on Debian.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl dumb-init \
    chromium \
    fonts-liberation libasound2 libatk-bridge2.0-0 libatk1.0-0 \
    libatspi2.0-0 libcups2 libdbus-1-3 libdrm2 libgbm1 libglib2.0-0 \
    libnss3 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxdamage1 \
    libxext6 libxfixes3 libxkbcommon0 libxrandr2 libxshmfence1 \
    libxss1 libxtst6 xdg-utils \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV PORT=7000
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_DOWNLOAD=true
EXPOSE 7000

ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "start"]
