================================================================================
[VCE-WALLET-02] 내부 이체 파라미터 조작 → 0원 이체, 음수 이체
도메인: wallet (지갑/이체)
================================================================================

## 1. 진단 항목 개요

- **항목명**: 내부 이체 amount/assetType 파라미터 조작
- **번호**: WALLET-02
- **위험도**: High
- **OWASP**: A03:2021 – Injection / Business Logic

## 2. 대상 기능 & 엔드포인트

| 항목 | 내용 |
|------|------|
| 로컬 | http://localhost:8080/api/wallets/transfer |
| 운영 | https://vceapp.com/api/wallets/transfer |
| HTTP 메서드 | POST |
| 인증 요건 | Bearer JWT 필요 |

## 3. 취약점 원리 (Why this works)

내부 이체 시 amount 파라미터에 비정상값(음수, 0, 매우 큰 수)을 입력하여
비즈니스 로직을 역전시킬 수 있다.

음수 이체: fromAddress에서 돈이 빠져나가는 대신 들어올 수 있음.

## 4. 테스트 절차 (Step-by-step)

### Step 1. 정상 이체 확인

```
POST /api/wallets/transfer HTTP/1.1
Host: localhost:8080
Authorization: Bearer <JWT>
Content-Type: application/json

{
  "toAddress": "대상_지갑주소",
  "amount": 0.001,
  "assetType": "BTC"
}
```

---

### Step 2. 음수/0 amount 이체

```json
{"toAddress": "대상주소", "amount": -0.001, "assetType": "BTC"}
{"toAddress": "대상주소", "amount": 0, "assetType": "BTC"}
{"toAddress": "대상주소", "amount": 9999999999, "assetType": "BTC"}
```

---

### Step 3. 자기 자신에게 이체 (레퍼럴 코드 남용 유사)

```json
{"toAddress": "자신의_지갑주소", "amount": 0.001, "assetType": "BTC"}
```

자기 자신에게 이체 시 수수료가 발생하지 않으면서 이체 성공 여부 확인.

---

### Step 4. 존재하지 않는 주소로 이체

```json
{"toAddress": "INVALID_ADDRESS_XYZ", "amount": 0.001, "assetType": "BTC"}
```

이체 성공 시 잔고만 감소하고 상대방 지갑에는 반영 안 됨 가능성.

## 5. 취약 여부 판단 기준

✅ **취약 (Vulnerable)**:
- 음수 amount 이체 → 잔고 증가
- 잔고 초과 이체 성공 → 음수 잔고 허용
- 존재하지 않는 주소 이체 성공

✗ **안전 (Not Vulnerable)**:
- 모든 비정상 값에 HTTP 400

## 6. 예상 취약 포인트 (코드 위치)

- `WalletService.java` — transfer 메서드 유효성 검증

## 7. 권고 조치

- amount > 0 검증: `@Positive`
- 수신 주소 유효성 검증 (DB에서 주소 존재 여부 확인)
- 자기 자신에게 이체 차단
- 이체 전 잔고 확인 및 원자적 처리
