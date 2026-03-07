================================================================================
[VCE-ORDERS-04] 거래내역 IDOR → 타 사용자 거래 조회
도메인: orders (주문/거래내역)
================================================================================

## 1. 진단 항목 개요

- **항목명**: 거래내역 조회 IDOR
- **번호**: ORDERS-04
- **위험도**: Medium
- **OWASP**: A01:2021 – Broken Access Control

## 2. 대상 기능 & 엔드포인트

| 항목 | 내용 |
|------|------|
| 로컬 | http://localhost:8080/api/transactions |
| 운영 | https://vceapp.com/api/transactions |
| HTTP 메서드 | GET |
| 인증 요건 | Bearer JWT 필요 |

## 3. 취약점 원리 (Why this works)

GET /api/transactions에서 현재 사용자 기반 필터링이 제대로 적용되지 않으면,
assetType 파라미터 조작이나 특정 요청으로 다른 사용자의 거래 내역이 노출될 수 있다.

## 4. 테스트 절차 (Step-by-step)

---

### Step 1. 정상 거래내역 조회

```
GET /api/transactions HTTP/1.1
Host: localhost:8080
Authorization: Bearer <JWT>
```

응답에 memberId 또는 email 필드가 포함되는지 확인.

---

### Step 2. assetType 파라미터 조작

```
GET /api/transactions?assetType=BTC HTTP/1.1
GET /api/transactions?assetType=ALL HTTP/1.1
GET /api/transactions?assetType= HTTP/1.1
GET /api/transactions?memberId=1 HTTP/1.1
GET /api/transactions?userId=1 HTTP/1.1
```

---

### Step 3. 페이지 파라미터로 다른 사용자 내역 접근

```
GET /api/transactions?page=0&size=1000 HTTP/1.1
Host: localhost:8080
Authorization: Bearer <JWT>
```

응답에 현재 사용자 외 다른 사용자 거래 포함 여부 확인.

---

### Step 4. 관리자 권한 없이 전체 거래내역 조회

```
GET /api/admin/transactions HTTP/1.1
Host: localhost:8080
Authorization: Bearer <일반사용자_JWT>
```

## 5. 취약 여부 판단 기준

✅ **취약 (Vulnerable)**:
- 응답에 다른 memberId의 거래 내역 포함
- memberId 파라미터로 타 사용자 거래 조회 성공

✗ **안전 (Not Vulnerable)**:
- 항상 현재 인증된 사용자의 거래만 반환
- 타 사용자 조회 시도 → HTTP 403

## 6. 예상 취약 포인트 (코드 위치)

- `TransactionController.java:20-29` — getTransactions 메서드에서 필터링 확인 필요
- `TransactionService.java` — 현재 사용자 email 기반 조회 여부

## 7. 권고 조치

- 거래내역 조회 시 항상 `WHERE member.email = :email` 조건 추가
- @AuthenticationPrincipal로 현재 사용자만 조회하도록 강제
