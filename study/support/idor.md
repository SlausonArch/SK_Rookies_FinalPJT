================================================================================
[VCE-SUPPORT-01] 고객 문의 IDOR → 타 사용자 문의 조회/수정
도메인: support (고객센터)
================================================================================

## 1. 진단 항목 개요

- **항목명**: 고객 문의 IDOR (Insecure Direct Object Reference)
- **번호**: SUPPORT-01
- **위험도**: High
- **OWASP**: A01:2021 – Broken Access Control

## 2. 대상 기능 & 엔드포인트

| 항목 | 내용 |
|------|------|
| 로컬 | http://localhost:8080/api/support/inquiries |
| 운영 | https://vceapp.com/api/support/inquiries |
| HTTP 메서드 | GET, POST |
| 인증 요건 | Bearer JWT 필요 |

## 3. 취약점 원리 (Why this works)

문의 목록 조회 시 현재 사용자 기반 필터링이 없으면,
다른 사용자의 문의(계좌 정보, 개인 금융 정보 포함 가능)가 노출된다.

문의 ID가 순차적 정수(1, 2, 3...)이면 IDOR 공격으로 타 사용자 문의에 접근 가능하다.

## 4. 테스트 절차 (Step-by-step)

### Step 1. 내 문의 조회

```
GET /api/support/inquiries HTTP/1.1
Host: localhost:8080
Authorization: Bearer <JWT>
```

응답에서 inquiryId 값 확인.

---

### Step 2. 다른 inquiryId로 직접 접근 시도

```
GET /api/support/inquiries/1 HTTP/1.1
Host: localhost:8080
Authorization: Bearer <JWT>
```

```
GET /api/support/inquiries/2 HTTP/1.1
```

(실제 엔드포인트가 없으면 /api/support/inquiries?id=1 형태로 시도)

---

### Step 3. 전체 문의 목록 접근 시도

```
GET /api/support/inquiries?page=0&size=1000 HTTP/1.1
```

다른 사용자 문의가 포함되는지 확인.

---

### Step 4. 관리자 API로 전체 문의 접근

```
GET /api/admin/inquiries HTTP/1.1
Host: localhost:8080
Authorization: Bearer <일반사용자_JWT>
```

## 5. 취약 여부 판단 기준

✅ **취약 (Vulnerable)**:
- 응답에 타 사용자 문의 내용 포함
- 특정 ID로 타 사용자 문의 상세 조회 성공

✗ **안전 (Not Vulnerable)**:
- 항상 현재 사용자 문의만 반환
- 타 사용자 문의 ID 접근 시 HTTP 403

## 6. 예상 취약 포인트 (코드 위치)

- `SupportController.java` — getInquiries 메서드 필터링 확인
- `SupportService.java` — 현재 사용자 기반 조회 여부

## 7. 권고 조치

- 문의 조회 시 항상 `WHERE member.email = :email` 조건 추가
- 개별 문의 조회 시 소유자 검증 후 반환
