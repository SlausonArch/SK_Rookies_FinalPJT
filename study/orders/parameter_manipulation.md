================================================================================
[VCE-ORDERS-03] 주문 파라미터 조작 (price/amount 음수, 0, 조작)
도메인: orders (주문/거래내역)
================================================================================

## 1. 진단 항목 개요

- **항목명**: 주문 생성 파라미터 조작
- **번호**: ORDERS-03
- **위험도**: High
- **OWASP**: A03:2021 – Injection

## 2. 대상 기능 & 엔드포인트

| 항목 | 내용 |
|------|------|
| 로컬 | http://localhost:8080/api/orders |
| 운영 | https://vceapp.com/api/orders |
| HTTP 메서드 | POST |
| 인증 요건 | Bearer JWT 필요 |

## 3. 취약점 원리 (Why this works)

주문 생성 시 price와 amount 필드에 비정상적인 값이 입력될 수 있다.
프론트엔드 검증만 있고 백엔드 검증이 없으면 Burp Suite로 우회 가능하다.

- price=0: 0원에 코인 매수 → 무료 코인 획득
- price=-1: 음수 가격으로 매수 시 잔고 증가?
- amount=-1: 음수 수량 SELL = 실질적 BUY?
- orderType을 임의 문자열로 설정

## 4. 테스트 절차 (Step-by-step)

### [사전 준비]
- test@vce.com 로그인 → JWT 획득

---

### Step 1. 정상 주문 캡처 후 파라미터 변조

정상 주문:
```json
{
  "assetType": "BTC",
  "orderType": "BUY",
  "price": 90000000,
  "amount": 0.001
}
```

변조 시도 목록:
```json
{"assetType": "BTC", "orderType": "BUY", "price": 0, "amount": 0.001}
{"assetType": "BTC", "orderType": "BUY", "price": -1, "amount": 0.001}
{"assetType": "BTC", "orderType": "BUY", "price": 90000000, "amount": -0.001}
{"assetType": "BTC", "orderType": "BUY", "price": 90000000, "amount": 0}
{"assetType": "BTC", "orderType": "HACK", "price": 90000000, "amount": 0.001}
{"assetType": "INVALID_COIN", "orderType": "BUY", "price": 1, "amount": 999999}
{"assetType": "BTC", "orderType": "BUY", "price": 1, "amount": 9999999}
```

---

### Step 2. price=0으로 코인 무료 매수

```
POST /api/orders HTTP/1.1
Host: localhost:8080
Authorization: Bearer <JWT>
Content-Type: application/json

{
  "assetType": "BTC",
  "orderType": "BUY",
  "price": 0,
  "amount": 1
}
```

성공 시: BTC 1개를 0원에 매수하는 주문 등록됨

---

### Step 3. assetType XSS/Injection 테스트

```json
{"assetType": "<script>alert(1)</script>", "orderType": "BUY", "price": 1, "amount": 1}
{"assetType": "BTC' OR '1'='1", "orderType": "BUY", "price": 1, "amount": 1}
{"assetType": "../../../etc/passwd", "orderType": "BUY", "price": 1, "amount": 1}
```

## 5. 취약 여부 판단 기준

✅ **취약 (Vulnerable)**:
- price=0 주문 생성 성공 (HTTP 200)
- amount 음수 주문 생성 성공
- 잘못된 assetType이 그대로 DB에 저장됨

✗ **안전 (Not Vulnerable)**:
- 모든 비정상 값에 HTTP 400 + 명확한 에러 메시지

## 6. 예상 취약 포인트 (코드 위치)

- `OrderController.java` — @RequestBody OrderCreateDto에 Bean Validation 없음
- `OrderService.java` — createOrder 메서드에서 파라미터 검증 부재

## 7. 권고 조치

- DTO에 Bean Validation: `@Positive`, `@DecimalMin("0.00000001")`, `@NotNull`
- assetType Enum 타입으로 강제 변환
- orderType Enum 검증: BUY/SELL 외 허용 안 함
