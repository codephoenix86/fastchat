FROM node:20-alpine AS builder

WORKDIR /usr/src/app

RUN apk add --no-cache python3 make g++

COPY package*.json .

RUN npm ci

COPY . .

RUN npm prune --omit=dev

FROM node:20-alpine AS runner

WORKDIR /usr/src/app

ENV NODE_ENV=production

COPY --from=builder --chown=node:node /usr/src/app/package*.json  .
COPY --from=builder --chown=node:node /usr/src/app/node_modules node_modules
COPY --from=builder --chown=node:node /usr/src/app/src src
COPY --from=builder --chown=node:node /usr/src/app/server.js .
COPY --from=builder --chown=node:node /usr/src/app/migrations migrations

RUN mkdir -p uploads logs && chown -R node:node uploads logs 

USER node

EXPOSE 3000

CMD ["node", "server.js"]