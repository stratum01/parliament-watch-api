FROM node:18-slim

WORKDIR /app

# Copy package.json first for better caching
COPY package*.json ./
RUN npm install --production

# Copy all backend files
COPY . .

# Enable CORS for all routes to allow frontend to connect
RUN sed -i 's/app.use(cors());/app.use(cors({ origin: "*" }));/' src/app.js

# Expose port
EXPOSE 8080
ENV PORT=8080

# Start the server please
CMD ["node", "src/server.js"]