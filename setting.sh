#!/usr/bin/env bash
set -euo pipefail

# Local defaults (override with env vars if needed)
LOCAL_DB_URL="${LOCAL_DB_URL:-jdbc:oracle:thin:@localhost:1521/FREEPDB1}"
LOCAL_DB_USER="${LOCAL_DB_USER:-SK_USER}"
LOCAL_DB_PASS="${LOCAL_DB_PASS:-password123}"
LOCAL_FRONTEND_URL="${LOCAL_FRONTEND_URL:-http://localhost:5173}"
LOCAL_CORS_ALLOWED_ORIGINS="${LOCAL_CORS_ALLOWED_ORIGINS:-http://localhost:5173,http://localhost:8080}"
LOCAL_JWT_SECRET="${LOCAL_JWT_SECRET:-your-very-secure-secret-key-at-least-256-bits-long}"
LOCAL_KAKAO_CLIENT_ID="${LOCAL_KAKAO_CLIENT_ID:-your_kakao_client_id}"
LOCAL_KAKAO_CLIENT_SECRET="${LOCAL_KAKAO_CLIENT_SECRET:-your_kakao_client_secret}"
LOCAL_NAVER_CLIENT_ID="${LOCAL_NAVER_CLIENT_ID:-your_naver_client_id}"
LOCAL_NAVER_CLIENT_SECRET="${LOCAL_NAVER_CLIENT_SECRET:-your_naver_client_secret}"
LOCAL_API_BASE_URL="${LOCAL_API_BASE_URL:-http://localhost:8080}"

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
FRONT_DIR="$ROOT_DIR/frontend"

append_gitignore_once() {
  local line="$1"
  grep -qxF "$line" "$ROOT_DIR/.gitignore" || echo "$line" >> "$ROOT_DIR/.gitignore"
}

update_gitignore() {
  append_gitignore_once "# Multi-env files"
  append_gitignore_once ".env.mac"
  append_gitignore_once ".env.windows"
  append_gitignore_once "frontend/.env.mac"
  append_gitignore_once "frontend/.env.windows"
  append_gitignore_once "frontend/.env"
}

write_backend_env_mac() {
  cat > "$ROOT_DIR/.env.mac" <<EOT
DB_URL=${LOCAL_DB_URL}
DB_USERNAME=${LOCAL_DB_USER}
DB_PASSWORD=${LOCAL_DB_PASS}

FRONTEND_URL=${LOCAL_FRONTEND_URL}
CORS_ALLOWED_ORIGINS=${LOCAL_CORS_ALLOWED_ORIGINS}

JWT_SECRET=${LOCAL_JWT_SECRET}
KAKAO_CLIENT_ID=${LOCAL_KAKAO_CLIENT_ID}
KAKAO_CLIENT_SECRET=${LOCAL_KAKAO_CLIENT_SECRET}
NAVER_CLIENT_ID=${LOCAL_NAVER_CLIENT_ID}
NAVER_CLIENT_SECRET=${LOCAL_NAVER_CLIENT_SECRET}

KAKAO_REDIRECT_URI=${LOCAL_FRONTEND_URL}/login/oauth2/code/kakao
NAVER_REDIRECT_URI=${LOCAL_FRONTEND_URL}/login/oauth2/code/naver
SERVER_FORWARD_HEADERS_STRATEGY=framework
EOT
}

write_backend_env_windows() {
  cat > "$ROOT_DIR/.env.windows" <<EOT
DB_URL=${LOCAL_DB_URL}
DB_USERNAME=${LOCAL_DB_USER}
DB_PASSWORD=${LOCAL_DB_PASS}

FRONTEND_URL=${LOCAL_FRONTEND_URL}
CORS_ALLOWED_ORIGINS=${LOCAL_CORS_ALLOWED_ORIGINS}

JWT_SECRET=${LOCAL_JWT_SECRET}
KAKAO_CLIENT_ID=${LOCAL_KAKAO_CLIENT_ID}
KAKAO_CLIENT_SECRET=${LOCAL_KAKAO_CLIENT_SECRET}
NAVER_CLIENT_ID=${LOCAL_NAVER_CLIENT_ID}
NAVER_CLIENT_SECRET=${LOCAL_NAVER_CLIENT_SECRET}

KAKAO_REDIRECT_URI=${LOCAL_FRONTEND_URL}/login/oauth2/code/kakao
NAVER_REDIRECT_URI=${LOCAL_FRONTEND_URL}/login/oauth2/code/naver
SERVER_FORWARD_HEADERS_STRATEGY=framework
EOT
}

write_frontend_env_mac() {
  mkdir -p "$FRONT_DIR"

  cat > "$FRONT_DIR/.env.mac" <<EOT
VITE_API_BASE_URL=${LOCAL_API_BASE_URL}
EOT
}

write_frontend_env_windows() {
  mkdir -p "$FRONT_DIR"

  cat > "$FRONT_DIR/.env.windows" <<EOT
VITE_API_BASE_URL=${LOCAL_API_BASE_URL}
EOT
}

main() {
  update_gitignore
  write_backend_env_mac
  write_backend_env_windows
  write_frontend_env_mac
  write_frontend_env_windows
  echo "setting.sh: local mac/windows setting files are updated."
}

main
