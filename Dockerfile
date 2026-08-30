# 1. Choose your base runtime image
FROM node:18-alpine

# 2. Set the working directory inside the container
WORKDIR /home/runner/work/GTIH/GTIH/

# 3. Copy dependency files first (optimizes build caching)
COPY package*.json ./

# 4. Install production dependencies
RUN npm install --only=production

# 5. Copy the rest of your application code
COPY . .

# 6. Inform Docker which port the app listens on at runtime
EXPOSE 3000

# 7. Define the command to start your application
CMD ["node", "server.js"]
