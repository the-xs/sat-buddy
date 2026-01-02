FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy Prisma schema and generate client
COPY prisma ./prisma/
RUN npx prisma generate

# Copy application code
COPY src ./src/

# Create uploads directory
RUN mkdir -p uploads

EXPOSE 3000

CMD ["npm", "start"]
