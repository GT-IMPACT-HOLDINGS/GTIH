# Step 1: Use an official lightweight Node.js image
FROM node:22-alpine

# 2. Set the working directory inside the container
#WORKDIR /usr/src/app

# 3. Copy dependency files first (optimizes build caching)
COPY package*.json ./

# 5. Copy the rest of your application code
COPY scripts/ ./scripts/

# 4. Install production dependencies
RUN npm install --only=production

# Step 6: Use a non-root user for security
USER node

# 6. Inform Docker which port the app listens on at runtime
EXPOSE 3000

# 7. Define the command to start your application
CMD ["node", "server.js"]
