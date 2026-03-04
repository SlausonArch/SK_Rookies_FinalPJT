#!/bin/bash

# 로그 디렉토리 생성
mkdir -p logs

echo "🧹 Cleaning up existing processes..."

# 1. Gradle 데몬 자체를 종료 (가장 확실한 백엔드 중복 방지)
./gradlew --stop > /dev/null 2>&1 || true

# 2. 포트 점유 직접 확인 후 킬 (백엔드 8080, 프론트엔드 5173)
for port in 8080 5173; do
  PID=$(lsof -Pi :$port -sTCP:LISTEN -t)
  if [ ! -z "$PID" ]; then
    echo "Terminating stray process on port $port (PID: $PID)..."
    kill -9 $PID 2>/dev/null
  fi
done

# 3. 남아있을 수 있는 프로세스 이름 기반 킬
pkill -f "bootRun" > /dev/null 2>&1 || true
pkill -f "SkApplication" > /dev/null 2>&1 || true
pkill -f "vite" > /dev/null 2>&1 || true
pkill -f "npm run dev" > /dev/null 2>&1 || true

# 포트 해제 캐치까지 약 1초 대기
sleep 1

echo "🚀 Starting Vulnerability Lab Project..."

# .env 파일 로드 (백엔드)
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

# 프론트엔드 .env 확인 로직 추가
if [ ! -f frontend/.env ]; then
  echo "⚠️ Warning: frontend/.env file not found. Frontend might use default localhost:8080 for API_BASE."
fi

# 1. Database Check (Docker)
echo "🗄️ Checking Oracle Database..."
docker-compose up -d oracle-db

echo "⏳ Waiting for Database to be ready..."
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
echo "- Backend: http://localhost:8080 (or as configured in .env)"
echo "- Frontend: http://localhost:5173 (or as configured in frontend/.env VITE_API_BASE_URL)"
echo "- Logs: tail -f logs/backend.log & logs/frontend.log"

# 프로세스 종료 관리 (Ctrl+C 시 함께 종료)
trap "kill $BACKEND_PID $FRONTEND_PID; echo 'Terminated Services'; exit" INT
wait
