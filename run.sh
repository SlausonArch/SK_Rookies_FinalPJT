#!/bin/bash

# 로그 디렉토리 생성
mkdir -p logs

echo "🚀 Starting Vulnerability Lab Project..."

# .env 파일 로드
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi
# 1. Database Check (Docker)
echo "🗄️ Checking Oracle Database..."
docker-compose up -d oracle-db

echo "⏳ Waiting for Database to be ready..."
# DB가 준비될 때까지 간단한 체크 (nc 또는 docker healthcheck 활용 가능)
sleep 10

# 2. Backend Start (Background)
echo "☕ Starting Spring Boot Backend (Logs: logs/backend.log)..."
./gradlew bootRun > logs/backend.log 2>&1 &
BACKEND_PID=$!

# 3. Frontend Start (Background)
echo "⚛️ Starting React Frontend (Logs: logs/frontend.log)..."
cd frontend && npm run dev > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!

echo "✅ All systems are starting up!"
echo "- Backend: http://localhost:8080"
echo "- Frontend: http://localhost:5173"
echo "- Logs: tail -f logs/backend.log"

# 프로세스 종료 관리 (Ctrl+C 시 함께 종료)
trap "kill $BACKEND_PID $FRONTEND_PID; echo 'Terminated Services'; exit" INT
wait
