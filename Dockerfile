FROM node:20-alpine

RUN apk add --no-cache ffmpeg python3 make g++

WORKDIR /app

COPY package.json package-lock.json* ./

# 👇 هذا السطر يخلي الكاش ينكسر
RUN npm install --force

COPY . .

CMD ["node", "index.js"]
