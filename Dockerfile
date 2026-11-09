FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Placeholders only for the build step; real values come from env at runtime.
RUN SUPABASE_URL=http://build.invalid SUPABASE_SERVICE_ROLE_KEY=build NEXT_TELEMETRY_DISABLED=1 npm run build
ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "start"]
