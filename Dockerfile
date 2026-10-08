# Loopwave frontend — static Vite build, served by nginx with the SPA
# fallback (/* -> index.html) that vercel.json's rewrite rule also provides.
#
# VITE_API_URL is baked into the JS bundle at BUILD time (Vite env vars are
# compile-time, not runtime) — it must be supplied as a Coolify build-time
# variable, pointing at wherever this environment's API is actually reachable.
FROM node:24-alpine AS build
WORKDIR /app
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
