================================================================================
[VCE-MARKET-02] 시세/호가 API 인증 없이 접근 가능 여부
도메인: market (코인시세/트렌드)
================================================================================

## 1. 진단 항목 개요

- **항목명**: 마켓 API 공개 접근 의도 확인 및 정보 노출
- **번호**: MARKET-02
- **위험도**: Info
- **OWASP**: A01:2021 – Broken Access Control (의도적 공개인지 검증)

## 2. 대상 기능 & 엔드포인트

| 항목 | 내용 |
|------|------|
| 로컬 | http://localhost:8080/api/market/** |
| 운영 | https://vceapp.com/api/market/** |
| HTTP 메서드 | GET |
| 인증 요건 | 없음 (설계상 공개 — 의도 확인 필요) |

공개 엔드포인트 목록:
- GET /api/market/all
- GET /api/market/ticker
- GET /api/market/candles/minutes/{unit}
- GET /api/market/candles/days
- GET /api/market/orderbook
- GET /api/market/trades/ticks

## 3. 취약점 원리 (Why this works)

시세 데이터는 통상 공개 정보이므로 인증 없이 제공하는 것은 설계상 의도일 수 있다.
그러나 다음 시나리오는 문제가 될 수 있다:

1. 호가(orderbook) 데이터에 다른 사용자 주문 정보(이메일, ID)가 포함되는 경우
2. 과도한 API 요청으로 서비스 가용성 영향 (Rate Limit 없음)
3. 내부 서버 구조 정보가 오류 응답에 포함되는 경우

## 4. 테스트 절차 (Step-by-step)

### Step 1. 비인증 상태로 모든 마켓 API 접근

```bash
# 전체 마켓 조회
curl http://localhost:8080/api/market/all

# 티커 조회
curl "http://localhost:8080/api/market/ticker?markets=KRW-BTC,KRW-ETH"

# 분봉 차트
curl "http://localhost:8080/api/market/candles/minutes/1?market=KRW-BTC&count=200"

# 호가 조회
curl "http://localhost:8080/api/market/orderbook?markets=KRW-BTC"

# 최근 거래
curl "http://localhost:8080/api/market/trades/ticks?market=KRW-BTC&count=100"
```

---

### Step 2. 호가 응답에서 민감 정보 확인

orderbook 응답 분석:
```json
{
  "market": "KRW-BTC",
  "orderbook_units": [
    {
      "ask_price": 90000000,
      "bid_price": 89990000,
      "memberId": 123,        ← 이런 필드가 있으면 취약
      "memberEmail": "..."    ← 민감정보 노출
    }
  ]
}
```

---

### Step 3. Rate Limiting 없음 확인

```bash
for i in $(seq 1 1000); do
  curl -s http://localhost:8080/api/market/all -o /dev/null &
done
wait
```

서버 응답 저하 또는 429 반환 여부 확인.

---

### Step 4. count/size 파라미터 과도한 값

```
GET /api/market/candles/minutes/1?market=KRW-BTC&count=9999999 HTTP/1.1
```

과도한 데이터 반환으로 서버 부하 유발 여부.

## 5. 취약 여부 판단 기준

✅ **취약 (Vulnerable)**:
- 호가 응답에 회원 개인 정보 포함
- 비정상적으로 큰 count 값으로 대용량 데이터 반환
- Rate Limit 없어 서버 가용성 영향

✗ **안전 (Not Vulnerable)**:
- 호가 데이터에 개인 정보 없음 (집계 데이터만)
- count 최대값 제한 (예: 200)
- Rate Limit 적용

## 6. 예상 취약 포인트 (코드 위치)

- `MarketController.java` — count 파라미터 상한 없음 가능성
- 업비트 API 프록시 구조

## 7. 권고 조치

- count/size 파라미터 최대값 제한: `@Max(200)`
- 마켓 API에도 Rate Limiting 적용 (IP당 분당 60회)
- 응답 데이터에 회원 개인 정보가 포함되지 않도록 DTO 검토
