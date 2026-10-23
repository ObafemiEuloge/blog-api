FROM node:24-alpine

WORKDIR /app
ENV NODE_ENV=production

# Install production dependencies first to benefit from layer caching.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY cloud ./cloud

USER node
EXPOSE 1337
CMD ["node", "src/index.js"]
