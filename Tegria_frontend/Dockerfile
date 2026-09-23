# Step 1: Use an official lightweight Node.js image
FROM node:22-alpine

# 2. Set the working directory inside the container
WORKDIR /app

# 3. Copy dependency files first (optimizes build caching)
COPY package*.json ./

# Copy all files from your current local directory into the container's WORKDIR
COPY . .

# 5. Copy the rest of your application code
#COPY scripts/ ./scripts/

# 4. Install production dependencies
#RUN npm install --only=production
RUN npm install 

# Change ownership of the /app folder to the 'node' user
RUN chown -R node:node /app

# Step 6: Use a non-root user for security
USER node

# 6. Inform Docker which port the app listens on at runtime (5173)
EXPOSE 5173

# 7. Define the command to start your application
#CMD ["npm", "start"]
#CMD ["sh", "-c", "npm run dev --host 0.0.0.0 --port 5173"]
CMD ["sh", "-c", "npm run dev -- --host 0.0.0.0 --port 5173"]
