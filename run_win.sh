#!/usr/bin/env bash

mkdir -p logs

if [ ! -f .env.windows ]; then
  echo "❌ .env.windows not found"
  exit 1
fi

if [ ! -f frontend/.env.windows ]; then
  echo "❌ frontend/.env.windows not found"
  exit 1
fi

cp .env.windows .env
cp frontend/.env.windows frontend/.env

echo "Cleaning up existing processes..."

./gradlew --stop > /dev/null 2>&1 || true

if command -v powershell.exe >/dev/null 2>&1; then
  powershell.exe -NoProfile -Command "Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id \$_.OwningProcess -Force -ErrorAction SilentlyContinue }" >/dev/null 2>&1 || true
  powershell.exe -NoProfile -Command "Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id \$_.OwningProcess -Force -ErrorAction SilentlyContinue }" >/dev/null 2>&1 || true
fi

sleep 1

echo "Starting Project (WINDOWS profile)..."

set -a
source .env
set +a

echo "Checking Oracle Database..."
docker-compose up -d oracle-db

echo "Waiting for Database to be ready..."
sleep 10

echo "Starting Spring Boot Backend (Logs: logs/backend.log)..."
./gradlew bootRun > logs/backend.log 2>&1 &
BACKEND_PID=$!

echo "Starting React Frontend (Logs: logs/frontend.log)..."
cd frontend && npm run dev > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!

echo "All systems are starting up!"
echo "- Backend: http://localhost:8080"
echo "- Frontend: http://localhost:5173"
echo "- Active profile: windows (.env.windows, frontend/.env.windows)"
echo "- Logs: tail -f logs/backend.log logs/frontend.log"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo 'Terminated Services'; exit" INT
wait
