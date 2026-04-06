# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

ARG VITE_APP_MODE=exchange
ARG VITE_API_BASE_URL
ARG VITE_EXCHANGE_FRONTEND_URL
ARG VITE_BANK_FRONTEND_URL
ARG VITE_ENABLE_API_DOCS=false

ENV VITE_APP_MODE=$VITE_APP_MODE
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_EXCHANGE_FRONTEND_URL=$VITE_EXCHANGE_FRONTEND_URL
ENV VITE_BANK_FRONTEND_URL=$VITE_BANK_FRONTEND_URL
ENV VITE_ENABLE_API_DOCS=$VITE_ENABLE_API_DOCS

RUN npm run build

# Serve stage
FROM openresty/openresty:alpine
COPY --from=builder /app/dist /usr/local/openresty/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3000
CMD ["openresty", "-g", "daemon off;"]
