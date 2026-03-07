================================================================================
[VCE-ASSETS-01] 입출금 amount 파라미터 조작 (음수/MAX_VALUE/소수점)
도메인: assets (입출금/잔고)
================================================================================

## 1. 진단 항목 개요

- **항목명**: 입출금 금액 파라미터 조작
- **번호**: ASSETS-01
- **위험도**: High
- **OWASP**: A03:2021 – Injection / Business Logic

## 2. 대상 기능 & 엔드포인트

| 항목 | 내용 |
|------|------|
| 로컬 | http://localhost:8080/api/assets/deposit |
| 운영 | https://vceapp.com/api/assets/deposit |
| HTTP 메서드 | POST |
| 인증 요건 | Bearer JWT 필요 |

관련 엔드포인트:
- POST /api/assets/deposit   — 입금
- POST /api/assets/withdraw  — 출금
- GET  /api/assets/{assetType} — 잔고 조회

## 3. 취약점 원리 (Why this works)

서버 측에서 amount 값에 대한 유효성 검증(음수 방지, 최대값 제한, 소수점 자리수 제한)이
충분하지 않으면 다음 공격이 가능하다:

1. **음수 입금**: amount=-1000 → 잔고 감소 대신 증가 (비즈니스 로직 역전)
2. **음수 출금**: amount=-1000 → 잔고 증가 (출금인데 입금 효과)
3. **BigDecimal overflow**: 매우 큰 값으로 내부 연산 오류 유발
4. **소수점 조작**: 0.000000001 단위 입금으로 수수료 우회

프론트엔드에서만 유효성 검증하고 백엔드에서 검증하지 않으면,
Burp Suite로 요청을 수정하여 클라이언트 검증을 완전히 우회할 수 있다.

## 4. 테스트 절차 (Step-by-step)

### [사전 준비]
1. test@vce.com 로그인 → JWT 획득
2. 현재 KRW 잔고 확인: GET /api/assets/KRW

---

### Step 1. 정상 입금 요청 캡처

```
POST /api/assets/deposit HTTP/1.1
Host: localhost:8080
Authorization: Bearer <JWT>
Content-Type: application/json

{
  "assetType": "KRW",
  "amount": 10000
}
```

응답: `{"balance": 10000}`

---

### Step 2. 음수 금액 입금

```
POST /api/assets/deposit HTTP/1.1
Host: localhost:8080
Authorization: Bearer <JWT>
Content-Type: application/json

{
  "assetType": "KRW",
  "amount": -10000
}
```

**예상**: 400 Bad Request (잔고 감소 없어야 함)
**취약 시**: 잔고가 -10000 감소하거나, 잔고가 10000 증가

---

### Step 3. 음수 금액 출금 (잔고 증가 시도)

```
POST /api/assets/withdraw HTTP/1.1
Host: localhost:8080
Authorization: Bearer <JWT>
Content-Type: application/json

{
  "assetType": "KRW",
  "amount": -50000
}
```

**취약 시**: 출금인데 잔고가 50000 증가

---

### Step 4. 극단값 테스트

```json
{"assetType": "KRW", "amount": 999999999999999}
{"assetType": "KRW", "amount": 9.9E+18}
{"assetType": "KRW", "amount": 0}
{"assetType": "KRW", "amount": 0.000000001}
{"assetType": "KRW", "amount": null}
{"assetType": "KRW", "amount": "ten thousand"}
{"assetType": "KRW", "amount": true}
```

---

### Step 5. 잔고 초과 출금 시도

현재 잔고: 10,000원일 때:
```json
{"assetType": "KRW", "amount": 999999999}
```

**예상**: 잔고 부족 오류
**취약 시**: 마이너스 잔고 허용

## 5. 취약 여부 판단 기준

✅ **취약 (Vulnerable)**:
- 음수 amount 입금 → 잔고 변화 발생
- 잔고 초과 출금 → 음수 잔고 허용
- 숫자가 아닌 값 입력 → 500 Internal Server Error (스택 트레이스 노출)

✗ **안전 (Not Vulnerable)**:
- 음수/0/비정상 값 → HTTP 400 + 명확한 에러 메시지
- 잔고 초과 → "잔고가 부족합니다" 응답

## 6. 예상 취약 포인트 (코드 위치)

- `AssetService.java` — deposit/withdraw 메서드의 amount 유효성 검증
- `AssetController.java` — @RequestBody DTO의 @Min, @Positive 등 Bean Validation 미적용

## 7. 권고 조치

- DTO에 Bean Validation 적용: `@Positive`, `@DecimalMin("0.01")`
- 서비스 레이어에서 이중 검증: `if (amount.compareTo(BigDecimal.ZERO) <= 0) throw`
- 잔고 확인 후 차감 (낙관적 락 또는 비관적 락 적용)
- 최대 입출금 한도 설정 (단일 거래, 일일 한도)
