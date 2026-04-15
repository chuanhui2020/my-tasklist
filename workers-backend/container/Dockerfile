FROM node:20-slim

WORKDIR /app
COPY package.json tsconfig.json ./
RUN npm install

COPY server.ts ./
RUN npx tsc

EXPOSE 4000

CMD ["node", "dist/server.js"]
