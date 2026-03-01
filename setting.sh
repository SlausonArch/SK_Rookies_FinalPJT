#!/usr/bin/env bash
set -euo pipefail

# AWS defaults (override with env vars if needed)
APP_DOMAIN="${APP_DOMAIN:-https://vceapp.com}"
RDS_URL="${RDS_URL:-jdbc:oracle:thin:@//oracle-rds.chuo402g03rl.ap-northeast-2.rds.amazonaws.com:1521/ORCL}"
DB_USER="${DB_USER:-SK_USER}"
DB_PASS="${DB_PASS:-<AWS_DB_PASSWORD>}"
JWT_SECRET_VALUE="${JWT_SECRET_VALUE:-<JWT_SECRET>}"
KAKAO_CLIENT_ID_VALUE="${KAKAO_CLIENT_ID_VALUE:-<KAKAO_CLIENT_ID>}"
KAKAO_CLIENT_SECRET_VALUE="${KAKAO_CLIENT_SECRET_VALUE:-<KAKAO_CLIENT_SECRET>}"
NAVER_CLIENT_ID_VALUE="${NAVER_CLIENT_ID_VALUE:-<NAVER_CLIENT_ID>}"
NAVER_CLIENT_SECRET_VALUE="${NAVER_CLIENT_SECRET_VALUE:-<NAVER_CLIENT_SECRET>}"

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
  append_gitignore_once ".env.aws_linux"
  append_gitignore_once ".env.app"
  append_gitignore_once "frontend/.env.mac"
  append_gitignore_once "frontend/.env.windows"
  append_gitignore_once "frontend/.env.aws_linux"
  append_gitignore_once "frontend/.env"
}

write_env_app() {
  cat > "$ROOT_DIR/.env.app" <<EOT
SPRING_DATASOURCE_URL=${RDS_URL}
SPRING_DATASOURCE_USERNAME=${DB_USER}
SPRING_DATASOURCE_PASSWORD=${DB_PASS}

FRONTEND_URL=${APP_DOMAIN}
CORS_ALLOWED_ORIGINS=${APP_DOMAIN},https://www.vceapp.com

JWT_SECRET=${JWT_SECRET_VALUE}
KAKAO_CLIENT_ID=${KAKAO_CLIENT_ID_VALUE}
KAKAO_CLIENT_SECRET=${KAKAO_CLIENT_SECRET_VALUE}
NAVER_CLIENT_ID=${NAVER_CLIENT_ID_VALUE}
NAVER_CLIENT_SECRET=${NAVER_CLIENT_SECRET_VALUE}

KAKAO_REDIRECT_URI=${APP_DOMAIN}/login/oauth2/code/kakao
NAVER_REDIRECT_URI=${APP_DOMAIN}/login/oauth2/code/naver
SERVER_FORWARD_HEADERS_STRATEGY=framework
EOT
}

write_env_app_example() {
  cat > "$ROOT_DIR/.env.app.example" <<'EOT'
SPRING_DATASOURCE_URL=jdbc:oracle:thin:@//oracle-rds.your-region.rds.amazonaws.com:1521/ORCL
SPRING_DATASOURCE_USERNAME=SK_USER
SPRING_DATASOURCE_PASSWORD=your_db_password

FRONTEND_URL=https://vceapp.com
CORS_ALLOWED_ORIGINS=https://vceapp.com,https://www.vceapp.com

JWT_SECRET=your-very-secure-secret-key-at-least-256-bits-long
KAKAO_CLIENT_ID=your_kakao_client_id
KAKAO_CLIENT_SECRET=your_kakao_client_secret
NAVER_CLIENT_ID=your_naver_client_id
NAVER_CLIENT_SECRET=your_naver_client_secret

KAKAO_REDIRECT_URI=https://vceapp.com/login/oauth2/code/kakao
NAVER_REDIRECT_URI=https://vceapp.com/login/oauth2/code/naver
SERVER_FORWARD_HEADERS_STRATEGY=framework
EOT
}

write_front_env_files() {
  mkdir -p "$FRONT_DIR"

  cat > "$FRONT_DIR/.env.aws_linux" <<EOT
VITE_API_BASE_URL=${APP_DOMAIN}
EOT

  cat > "$FRONT_DIR/.env.example" <<'EOT'
# Frontend API Base URL Configuration
# 단일 도메인 배포: https://vceapp.com
# API 서브도메인 분리 시: https://api.vceapp.com
VITE_API_BASE_URL=https://vceapp.com
EOT
}

main() {
  update_gitignore
  write_env_app
  write_env_app_example
  write_front_env_files
  echo "setting.sh: AWS setting files are updated."
}

main
