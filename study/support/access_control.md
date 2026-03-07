================================================================================
[VCE-SUPPORT-03] 문의 답변 권한 우회 → 일반 사용자가 답변 가능
도메인: support (고객센터)
================================================================================

## 1. 진단 항목 개요

- **항목명**: 고객 문의 답변 RBAC 우회
- **번호**: SUPPORT-03
- **위험도**: High
- **OWASP**: A01:2021 – Broken Access Control

## 2. 대상 기능 & 엔드포인트

| 항목 | 내용 |
|------|------|
| 로컬 | http://localhost:8080/api/admin/inquiries/{id}/reply |
| 운영 | https://vceapp.com/api/admin/inquiries/{id}/reply |
| HTTP 메서드 | PATCH |
| 인증 요건 | ADMIN 역할 필요 (설계), 실제 검증 여부 확인 |

## 3. 취약점 원리 (Why this works)

AdminController의 `/api/admin/**` 엔드포인트는 SecurityConfig에서 `hasRole("ADMIN")`으로 보호된다.
그러나 설정 오류나 누락으로 특정 엔드포인트가 보호되지 않을 수 있다.

또한 `/api/community/admin/members/{id}/status`처럼 다른 namespace에 숨겨진 관리자 API가
존재할 수 있다.

## 4. 테스트 절차 (Step-by-step)

### Step 1. 일반 사용자 JWT로 문의 답변 시도

```
PATCH /api/admin/inquiries/1/reply HTTP/1.1
Host: localhost:8080
Authorization: Bearer <일반사용자_JWT>
Content-Type: application/json

{
  "reply": "일반 사용자가 작성한 답변입니다"
}
```

---

### Step 2. JWT 없이 시도

```
PATCH /api/admin/inquiries/1/reply HTTP/1.1
Host: localhost:8080
Content-Type: application/json

{"reply": "비인증 답변"}
```

---

### Step 3. 대소문자 우회

```
PATCH /api/Admin/inquiries/1/reply HTTP/1.1
PATCH /api/ADMIN/inquiries/1/reply HTTP/1.1
```

---

### Step 4. FAQ 수정/삭제 시도

```
POST /api/support/faqs HTTP/1.1
Host: localhost:8080
Authorization: Bearer <일반사용자_JWT>
Content-Type: application/json

{"question": "공격자가 추가한 FAQ", "answer": "악성 링크: https://evil.com"}
```

## 5. 취약 여부 판단 기준

✅ **취약 (Vulnerable)**:
- 일반 사용자 JWT로 문의 답변 성공 (HTTP 200)
- 일반 사용자가 FAQ 등록/수정 가능

✗ **안전 (Not Vulnerable)**:
- HTTP 403 Forbidden
- "관리자 권한이 필요합니다" 응답

## 6. 예상 취약 포인트 (코드 위치)

- `AdminController.java` — PATCH /inquiries/{id}/reply 권한 검증
- `SecurityConfig.java` — /api/admin/** hasRole("ADMIN") 설정

## 7. 권고 조치

- SecurityConfig에서 `/api/admin/**` 전체에 `hasRole("ADMIN")` 적용 확인
- 각 Controller에서도 `@PreAuthorize("hasRole('ADMIN')")` 이중 적용
- FAQ 관련 쓰기 엔드포인트 관리자 전용으로 분리
