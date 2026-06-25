FROM node:20-alpine
RUN apk add --no-cache bash postgresql-client wget python3 make g++
WORKDIR /app
COPY package*.json ./
RUN npm ci && npm cache clean --force
COPY . .
EXPOSE 3000
CMD ["node", "index.js"]
