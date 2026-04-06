FROM node:20-alpine

RUN apk add --no-cache ffmpeg

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production   # 👈 هذا يسبب المشكلة

COPY . .

CMD ["node", "index.js"]
