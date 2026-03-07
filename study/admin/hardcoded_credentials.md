================================================================================
[VCE-ADMIN-02] 하드코딩된 관리자 계정 → 기본 자격증명 공격
도메인: admin (관리자)
================================================================================

## 1. 진단 항목 개요

- **항목명**: DataInitializer 하드코딩 관리자 계정 (admin@vce.com / admin1234)
- **번호**: ADMIN-02
- **위험도**: High
- **OWASP**: A07:2021 – Identification and Authentication Failures

## 2. 대상 기능 & 엔드포인트

| 항목 | 내용 |
|------|------|
| 로컬 | http://localhost:8080/api/auth/admin/login |
| 운영 | https://vceapp.com/api/auth/admin/login |
| HTTP 메서드 | POST |
| 인증 요건 | 없음 |

## 3. 취약점 원리 (Why this works)

`DataInitializer.java:41`에서 애플리케이션 시작 시 관리자 계정을 생성한다:
```java
Member admin = new Member();
admin.setEmail("admin@vce.com");
admin.setPassword(passwordEncoder.encode("admin1234"));
admin.setRole(Role.ADMIN);
```

이 자격증명이 변경되지 않은 채 운영 환경에서 사용되면:
1. 누구나 admin@vce.com / admin1234로 로그인 가능
2. 관리자 JWT 획득 후 /api/admin/** 모든 기능 접근
3. 회원 정보 조회, 자산 회수, 신분증 승인 등 악용 가능

## 4. 테스트 절차 (Step-by-step)

### Step 1. 하드코딩 자격증명으로 로그인 시도

```
POST /api/auth/admin/login HTTP/1.1
Host: localhost:8080
Content-Type: application/json

{
  "email": "admin@vce.com",
  "password": "admin1234"
}
```

또는 일반 로그인:
```
POST /api/auth/login HTTP/1.1
Host: localhost:8080
Content-Type: application/json

{
  "email": "admin@vce.com",
  "password": "admin1234"
}
```

---

### Step 2. 획득한 ADMIN JWT로 관리자 기능 접근

```
GET /api/admin/members HTTP/1.1
Host: localhost:8080
Authorization: Bearer <ADMIN_JWT>
```

```
GET /api/admin/stats HTTP/1.1
Host: localhost:8080
Authorization: Bearer <ADMIN_JWT>
```

---

### Step 3. 자산 회수 기능 테스트

```
PATCH /api/admin/members/1/assets/reclaim HTTP/1.1
Host: localhost:8080
Authorization: Bearer <ADMIN_JWT>
Content-Type: application/json

{"assetType": "KRW", "amount": 1000}
```

---

### Step 4. 다른 기본 자격증명 시도

```
{"email": "admin@vce.com", "password": "admin"}
{"email": "admin@vce.com", "password": "Admin1234!"}
{"email": "admin@vce.com", "password": "vce_admin"}
{"email": "admin@vceapp.com", "password": "admin1234"}
```

## 5. 취약 여부 판단 기준

✅ **취약 (Vulnerable)**:
- admin@vce.com / admin1234로 로그인 성공 (HTTP 200 + JWT)
- 획득한 JWT로 /api/admin/members 접근 성공

✗ **안전 (Not Vulnerable)**:
- 운영 배포 시 자동으로 복잡한 패스워드 생성
- 최초 로그인 시 패스워드 변경 강제

## 6. 예상 취약 포인트 (코드 위치)

- `DataInitializer.java:41` — admin@vce.com / admin1234 하드코딩

## 7. 권고 조치

- 관리자 초기 패스워드를 환경변수에서 로드: `@Value("${admin.password}")`
- 최초 로그인 시 패스워드 변경 강제 (ADMIN_SETUP 역할 별도 구현)
- DataInitializer를 개발 환경 전용으로 제한: `@Profile("dev")`
- 운영 환경 관리자 계정 별도 생성 스크립트 제공
