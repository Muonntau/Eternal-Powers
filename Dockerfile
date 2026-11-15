FROM node:24-alpine AS build
WORKDIR /app
COPY --chown=node:node package*.json ./
RUN --mount=type=secret,id=build_ca \
    if [ -f /run/secrets/build_ca ]; then npm_config_cafile=/run/secrets/build_ca npm ci; else npm ci; fi
COPY . .
RUN npm run build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=5176 ETERNAL_CAPACITY=64 ETERNAL_DB=/data/private-worlds.sqlite
COPY --chown=node:node package*.json ./
RUN --mount=type=secret,id=build_ca \
    if [ -f /run/secrets/build_ca ]; then npm_config_cafile=/run/secrets/build_ca npm ci --omit=dev; else npm ci --omit=dev; fi \
    && npm cache clean --force
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/server ./server
COPY --from=build --chown=node:node /app/src ./src
RUN mkdir /data && chown node:node /data
USER node
VOLUME ["/data"]
EXPOSE 5176
CMD ["node", "server/index.js"]
