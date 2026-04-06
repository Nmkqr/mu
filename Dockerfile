FROM node:20-alpine

RUN apk add --no-cache ffmpeg

WORKDIR /app

# نسخ package.json أولاً للاستفادة من cache
COPY package*.json ./

# تنظيف cache و تثبيت
RUN npm cache clean --force && \
    npm install --omit=dev

COPY . .

CMD ["node", "index.js"]
