## Deployment Env Split

This project now uses separate env files per deployment target.

### 1. Backend

File:
- `.env.backend`

Create it from:
- `.env.backend.example`

Used by:
- `docker compose -f docker-compose.app.yml up -d --build`

Notes:
- `SPRING_DATASOURCE_URL` should point to the RDS endpoint.
- `FRONTEND_URL` should normally be `https://vceapp.com`.
- `CORS_ALLOWED_ORIGINS` should include both `https://vceapp.com` and `https://bank.vceapp.com`.
- OAuth redirect URIs must use the backend public origin.

### 2. Exchange Frontend

File:
- `frontend/.env.exchange`

Create it from:
- `frontend/.env.exchange.example`

Used by:
- `docker compose -f docker-compose.exchange-front.yml up -d --build`
- `npm run dev:exchange`

Notes:
- `NEXT_PUBLIC_API_BASE_URL` must point to the integrated backend public URL.
- `NEXT_PUBLIC_APP_MODE=exchange`
- `NEXT_SERVER_ACTION_ALLOWED_ORIGINS` must include every frontend origin that can call server actions.

### 3. Bank Frontend

File:
- `frontend/.env.bank`

Create it from:
- `frontend/.env.bank.example`

Used by:
- `npm run dev:bank`
- `npm run build:bank`

Notes:
- Build `frontend/dist` and publish that output to IIS on `bank.vceapp.com`.
- `NEXT_PUBLIC_APP_MODE=bank`
