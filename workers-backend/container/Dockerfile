FROM --platform=linux/amd64 node:20-slim

RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

RUN npm install -g @openai/codex typescript

WORKDIR /app
COPY package.json tsconfig.json ./
RUN npm install

COPY server.ts ./
RUN npx tsc

EXPOSE 4000

CMD ["node", "dist/server.js"]
