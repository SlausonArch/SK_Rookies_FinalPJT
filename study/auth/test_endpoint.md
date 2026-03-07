================================================================================
[VCE-AUTH-05] 테스트 로그인 엔드포인트 운영 환경 노출
도메인: auth
================================================================================

## 1. 진단 항목 개요

- **항목명**: /api/auth/test/login 테스트 엔드포인트 운영 노출
- **번호**: AUTH-05
- **위험도**: High
- **OWASP**: A05:2021 – Security Misconfiguration

## 2. 대상 기능 & 엔드포인트

| 항목 | 내용 |
|------|------|
| 로컬 | http://localhost:8080/api/auth/test/login |
| 운영 | https://vceapp.com/api/auth/test/login |
| HTTP 메서드 | POST |
| 인증 요건 | 없음 (permitAll) |

관련 파일:
- SecurityConfig.java:72 — `/api/auth/**` 전체 permitAll
- DataInitializer.java:41 — admin@vce.com / admin1234 하드코딩

## 3. 취약점 원리 (Why this works)

개발/테스트 편의를 위해 만든 빠른 로그인 엔드포인트가 운영 환경에 그대로 노출된 경우,
공격자는 인증 흐름을 우회하거나 특정 계정(하드코딩된 admin 등)으로 즉시 로그인 가능하다.

`/api/auth/**` 경로 전체가 permitAll이므로 인증 없이 접근 가능하며,
테스트 전용 로직(예: 패스워드 검증 생략, 특정 role 강제 부여)이 남아있을 수 있다.

## 4. 테스트 절차 (Step-by-step)

### [사전 준비]
1. Burp Suite 또는 curl 준비
2. 하드코딩된 관리자 계정 정보: admin@vce.com / admin1234

---

### Step 1. 엔드포인트 존재 여부 확인

```
POST /api/auth/test/login HTTP/1.1
Host: localhost:8080
Content-Type: application/json

{
  "email": "admin@vce.com",
  "password": "admin1234"
}
```

curl:
```bash
curl -X POST http://localhost:8080/api/auth/test/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@vce.com","password":"admin1234"}'
```

---

### Step 2. 다양한 계정으로 시도

```bash
# 하드코딩 관리자
curl -X POST http://localhost:8080/api/auth/test/login \
  -d '{"email":"admin@vce.com","password":"admin1234"}'

# 테스트 계정
curl -X POST http://localhost:8080/api/auth/test/login \
  -d '{"email":"test@vce.com","password":"test1234"}'

# 패스워드 없이 시도 (테스트 엔드포인트는 검증 생략할 수 있음)
curl -X POST http://localhost:8080/api/auth/test/login \
  -d '{"email":"admin@vce.com"}'
```

---

### Step 3. 운영 서버에서도 동일 확인

```bash
curl -X POST https://vceapp.com/api/auth/test/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@vce.com","password":"admin1234"}'
```

---

### Step 4. 응답 토큰으로 관리자 기능 접근

성공 응답에서 JWT 추출 후:
```
GET /api/admin/members HTTP/1.1
Host: localhost:8080
Authorization: Bearer <획득한_JWT>
```

## 5. 취약 여부 판단 기준

✅ **취약 (Vulnerable)**:
- HTTP 200 + JWT 토큰 반환
- 획득한 토큰으로 /api/admin/members 접근 성공

✗ **안전 (Not Vulnerable)**:
- HTTP 404 Not Found (엔드포인트 없음)
- HTTP 403 Forbidden
- 운영 프로파일에서 비활성화됨

## 6. 예상 취약 포인트 (코드 위치)

- `AuthController.java` — POST /api/auth/test/login 핸들러 존재
- `DataInitializer.java:41` — admin@vce.com / admin1234 하드코딩된 초기 데이터
- `SecurityConfig.java:72` — /api/auth/** 전체 인증 없이 접근 가능

## 7. 권고 조치

- 테스트 엔드포인트를 `@Profile("dev")` 또는 `@ConditionalOnProperty`로 운영 비활성화
- DataInitializer의 기본 관리자 패스워드를 환경변수에서 읽도록 변경
- /api/auth/test/** 경로를 SecurityConfig에서 명시적으로 차단
