FROM node:22-slim AS base
WORKDIR /app

# Install dependencies (including Prisma CLI for generate)
COPY package.json package-lock.json* ./
RUN npm install

# Copy source and generate Prisma client
COPY . .
RUN npx prisma generate
RUN npm run build

EXPOSE 4000

# Apply any pending migrations, then start the server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
