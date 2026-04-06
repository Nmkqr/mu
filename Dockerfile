FROM node:20-alpine

RUN apk add --no-cache ffmpeg

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev   # 👈 استخدم npm install بدل npm ci

COPY . .

CMD ["node", "index.js"]
