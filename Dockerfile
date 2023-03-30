FROM node:gallium-alpine3.17

RUN apk add --no-cache chromium --repository=https://dl-cdn.alpinelinux.org/alpine/v3.17/main/

WORKDIR /app

COPY package*.json ./

RUN yarn install --omit=dev

COPY . .

RUN yarn build

CMD [ "yarn", "start" ]