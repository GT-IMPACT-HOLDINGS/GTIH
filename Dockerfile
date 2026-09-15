# Step 1: Use an official lightweight Node.js image
FROM node:22-alpine

ARG GT3_LEXIOM_DEMO_KEY='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'

ARG GT3_LEXIOM_AGENT_KEY='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'

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

# Step 6: Use a non-root user for security
USER node

# 6. Inform Docker which port the app listens on at runtime
EXPOSE 8080

# 7. Define the command to start your application
#CMD ["npm", "start"]
CMD ["sh", "-c", "npm start"]
