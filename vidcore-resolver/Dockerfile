FROM node:22-alpine
WORKDIR /app
COPY upstream/package.json upstream/package-lock.json ./
RUN npm ci --include=dev
COPY upstream/tsconfig.json upstream/tsconfig.web.json ./
COPY upstream/src ./src
COPY upstream/web ./web
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
EXPOSE 3000
USER node
CMD ["npm", "start"]
