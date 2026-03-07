================================================================================
[VCE-ASSETS-02] 입금 한도 없음 → 무제한 자산 충전
도메인: assets (입출금/잔고)
================================================================================

## 1. 진단 항목 개요

- **항목명**: 입금 금액 상한선 없음 (비즈니스 로직 취약점)
- **번호**: ASSETS-02
- **위험도**: High
- **OWASP**: Business Logic Vulnerability

## 2. 대상 기능 & 엔드포인트

| 항목 | 내용 |
|------|------|
| 로컬 | http://localhost:8080/api/assets/deposit |
| 운영 | https://vceapp.com/api/assets/deposit |
| HTTP 메서드 | POST |
| 인증 요건 | Bearer JWT 필요 |

## 3. 취약점 원리 (Why this works)

실제 금융 시스템에서는 다음 제한이 필요하다:
- 단일 거래 최대 한도 (예: 1회 1억원)
- 일일 입금 한도 (예: 하루 10억원)
- KYC 완료 전 제한 (예: 미인증 계정 최대 100만원)
- 연속 입금 횟수 제한

이런 제한이 없으면:
1. 임의로 큰 금액을 입금하여 거래소 내 자산을 인위적으로 부풀릴 수 있다
2. 특히 테스트/개발 환경에서 실제 입금 검증 없이 잔고가 증가한다면 치명적이다

## 4. 테스트 절차 (Step-by-step)

### [사전 준비]
- test@vce.com 로그인 → JWT 획득

---

### Step 1. 초대형 금액 입금 시도

```
POST /api/assets/deposit HTTP/1.1
Host: localhost:8080
Authorization: Bearer <JWT>
Content-Type: application/json

{
  "assetType": "KRW",
  "amount": 999999999999
}
```

---

### Step 2. 반복 소액 입금 (일일 한도 테스트)

```bash
for i in $(seq 1 100); do
  curl -s -X POST http://localhost:8080/api/assets/deposit \
    -H "Authorization: Bearer <JWT>" \
    -H "Content-Type: application/json" \
    -d '{"assetType":"KRW","amount":1000000}' \
    -w "[$i] %{http_code}\n" -o /dev/null
done
```

100회 × 1,000,000원 = 100,000,000원 입금 시도.
어느 시점부터 제한되는지 확인.

---

### Step 3. 코인 자산 직접 입금 시도

```json
{"assetType": "BTC", "amount": 1000}
{"assetType": "ETH", "amount": 5000}
```

암호화폐 자산도 KRW처럼 직접 입금 가능한지 확인.

---

### Step 4. 잔고 조회로 변화 확인

```
GET /api/assets/KRW HTTP/1.1
Host: localhost:8080
Authorization: Bearer <JWT>
```

## 5. 취약 여부 판단 기준

✅ **취약 (Vulnerable)**:
- 999,999,999,999원 입금 성공 (HTTP 200 + 잔고 반영)
- 100회 반복 입금 제한 없음
- 암호화폐 자산 직접 입금 가능

✗ **안전 (Not Vulnerable)**:
- 최대 한도 초과 시 HTTP 400 + "한도 초과" 메시지
- 일일 입금 횟수/금액 제한 적용
- 실제 은행 이체 검증 연동

## 6. 예상 취약 포인트 (코드 위치)

- `AssetService.java` — deposit 메서드에 한도 검증 없음
- `AssetController.java` — amount 최대값 제한 없음

## 7. 권고 조치

- 단일 거래 최대 한도: `@Max(100_000_000)`
- 일일 입금 한도 DB 기반 추적 및 제한
- 실제 입금 확인 프로세스(가상계좌 매칭, 입금 대기 상태) 적용
- KYC 완료 전 제한된 입금 한도 적용
