#!/usr/bin/env bash

mkdir -p logs

if [ ! -f .env.mac ]; then
  echo "❌ .env.mac not found"
  exit 1
fi

if [ ! -f frontend/.env.mac ]; then
  echo "❌ frontend/.env.mac not found"
  exit 1
fi

cp .env.mac .env
cp frontend/.env.mac frontend/.env

echo "🧹 Cleaning up existing processes..."

./gradlew --stop > /dev/null 2>&1 || true

for port in 8080 5173; do
  PID=$(lsof -Pi :$port -sTCP:LISTEN -t)
  if [ ! -z "$PID" ]; then
    echo "Terminating stray process on port $port (PID: $PID)..."
    kill -9 $PID 2>/dev/null
  fi
done

pkill -f "bootRun" > /dev/null 2>&1 || true
pkill -f "SkApplication" > /dev/null 2>&1 || true
pkill -f "vite" > /dev/null 2>&1 || true
pkill -f "npm run dev" > /dev/null 2>&1 || true

sleep 1

echo "🚀 Starting Project (MAC profile)..."

set -a
source .env
set +a

echo "🗄️ Checking Oracle Database..."
docker-compose up -d oracle-db

echo "⏳ Waiting for Database to be ready..."
sleep 10

echo "☕ Starting Spring Boot Backend (Logs: logs/backend.log)..."
./gradlew bootRun > logs/backend.log 2>&1 &
BACKEND_PID=$!

echo "⚛️ Starting React Frontend (Logs: logs/frontend.log)..."
cd frontend && npm run dev > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!

echo "✅ All systems are starting up!"
echo "- Backend: http://localhost:8080"
echo "- Frontend: http://localhost:5173"
echo "- Active profile: mac (.env.mac, frontend/.env.mac)"
echo "- Logs: tail -f logs/backend.log logs/frontend.log"

trap "kill $BACKEND_PID $FRONTEND_PID; echo 'Terminated Services'; exit" INT
wait
