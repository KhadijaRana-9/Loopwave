# Loopwave API — mirrors the Railway deploy exactly:
# build with devDependencies, then run `prisma migrate deploy && node dist/server.js`
# against whatever DATABASE_URL/DIRECT_URL this environment provides.
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
# Prisma CLI (for `prisma migrate deploy` on boot) is a devDependency —
# install everything, same as the build stage, rather than maintaining a
# second, easy-to-drift dependency list for "what's needed at runtime".
RUN npm ci
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
EXPOSE 4000
CMD ["sh", "-c", "npm run prisma:deploy && npm start"]
