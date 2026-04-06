FROM node:20-alpine

# تثبيت ffmpeg
RUN apk add --no-cache ffmpeg python3 make g++

WORKDIR /app

COPY package.json .
RUN npm install

COPY . .

CMD ["node", "index.js"]
