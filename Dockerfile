# Ohr Hanachal — Medusa v2 backend (production)
FROM node:22-slim
WORKDIR /app
RUN apt-get update && apt-get install -y python3 make g++ curl \
    && rm -rf /var/lib/apt/lists/*
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build
# Medusa v2 build output is a self-contained app under .medusa/server
WORKDIR /app/.medusa/server
RUN npm install
ENV NODE_ENV=production
EXPOSE 9000
# Run pending migrations, then start the server + admin
CMD ["sh","-c","npx medusa db:migrate && npm run start"]
