# API 명세서 — VCE 가상화폐 거래소

- **요청주소 (Base URL)**: `http://localhost:18080`
- **작성일**: 2026-04-06
- **대상 기술 스택**: Spring Boot 3 (REST API)

---

## 공통 사항

### 인증

| 방식 | 설명 |
|------|------|
| JWT Bearer 토큰 | `Authorization: Bearer {accessToken}` 헤더 |
| HttpOnly 쿠키 | `vce_token` (거래소) / `vce_bank_token` (은행) / `vce_admin_token` (관리자) |

인증이 필요한 API는 헤더 또는 쿠키 중 하나로 토큰을 전달합니다.

### 공통 오류 메시지

| No | 구분 | HTTP 코드 | 설명 |
|----|------|-----------|------|
| 1  | ERROR | 400 | 입력값 유효성 검사 실패 |
| 2  | ERROR | 401 | 인증 토큰 없음 또는 만료 |
| 3  | ERROR | 403 | 권한 없음 (역할 불일치) |
| 4  | ERROR | 404 | 리소스를 찾을 수 없음 |
| 5  | ERROR | 409 | 중복 요청 또는 상태 충돌 |
| 6  | ERROR | 500 | 서버 내부 오류 |
| 7  | INFO  | 200 | 정상 처리 |
| 8  | INFO  | 204 | 정상 처리 (응답 본문 없음) |

---

## 1. 인증 (`/api/auth`)

### 1-1. 소셜 로그인 (OAuth2)

| 항목 | 내용 |
|------|------|
| 요청주소 | `GET /oauth2/authorization/{provider}` |
| 인증 | 불필요 |

**요청인자 (Query String)**

| 변수명 | 타입 | 필수 | 설명 |
|--------|------|------|------|
| `frontend_url` | STRING | O | 로그인 성공 후 리다이렉트할 프론트엔드 Origin |

**provider 값**: `kakao`, `naver`

---

### 1-2. 소셜 로그인 콜백

| 항목 | 내용 |
|------|------|
| 요청주소 | `GET /login/oauth2/code/{provider}` |
| 인증 | 불필요 (내부 OAuth2 콜백) |

성공 시 `/oauth/callback?accessToken=...&refreshToken=...` 으로 리다이렉트.
신규 사용자는 `/signup/complete?code=...` 으로 리다이렉트.

---

### 1-3. 회원가입 임시코드 교환

| 항목 | 내용 |
|------|------|
| 요청주소 | `GET /api/auth/signup/token` |
| 인증 | 불필요 |

**요청인자 (Query String)**

| 변수명 | 타입 | 필수 | 설명 |
|--------|------|------|------|
| `code` | STRING | O | 소셜 로그인 후 발급된 임시 1회용 코드 |

**출력값**

| No | 출력명 | 출력 설명 |
|----|--------|---------|
| 1  | `accessToken` | GUEST 역할 JWT 액세스 토큰 |
| 2  | `email` | 소셜 계정 이메일 |

---

### 1-4. 회원가입 완료

| 항목 | 내용 |
|------|------|
| 요청주소 | `POST /api/auth/signup/complete` |
| 인증 | 필요 (GUEST 토큰) |
| Content-Type | `multipart/form-data` |

**요청인자 (multipart)**

| 변수명 | 타입 | 필수 | 제약 | 설명 |
|--------|------|------|------|------|
| `data.name` | STRING | O | 2~50자 | 이름 |
| `data.rrnPrefix` | STRING | O | `\d{6}-?[1-4]` | 주민등록번호 앞 7자리 |
| `data.phoneNumber` | STRING | O | `^01[0-9]-?\\d{3,4}-?\\d{4}$` | 전화번호 |
| `data.address` | STRING | X | 최대 200자 | 주소 |
| `data.bankName` | STRING | X | 최대 30자 | 은행명 |
| `data.accountNumber` | STRING | X | 숫자만, 최대 50자 | 계좌번호 |
| `data.referredByCode` | STRING | X | 영문·숫자 8자리 | 추천인 코드 |
| `file` | FILE | O | jpg/jpeg/png, 최대 10MB | 신분증 이미지 |

**출력값**: 새 JWT 액세스 토큰 (String)

---

### 1-5. 로그인 (테스트/일반)

| 항목 | 내용 |
|------|------|
| 요청주소 | `POST /api/auth/test/login` |
| 인증 | 불필요 |

**요청인자 (JSON Body)**

| 변수명 | 타입 | 필수 | 설명 |
|--------|------|------|------|
| `email` | STRING | O | 이메일 |
| `password` | STRING | O | 비밀번호 |
| `scope` | STRING | X | `EXCHANGE`(기본값) 또는 `BANK` |

**출력값**

| No | 출력명 | 출력 설명 |
|----|--------|---------|
| 1  | `accessToken` | JWT 액세스 토큰 (30분 만료) |
| 2  | `refreshToken` | JWT 리프레시 토큰 (7일 만료) |

응답 쿠키: scope=EXCHANGE → `vce_token` + `vce_refresh_token`, scope=BANK → `vce_bank_token` + `vce_bank_refresh_token`

**메시지 설명**

| No | 구분 | 코드 | 설명 |
|----|------|------|------|
| 1  | ERROR | 401 | 이메일 또는 비밀번호 불일치 |
| 2  | ERROR | 403 | 계정 잠금 (5회 실패 초과) |
| 3  | ERROR | 403 | 회원가입 미완료 계정 |
| 4  | ERROR | 403 | 탈퇴 계정 |

---

### 1-6. 관리자 로그인

| 항목 | 내용 |
|------|------|
| 요청주소 | `POST /api/auth/admin/login` |
| 인증 | 불필요 |

**요청인자 (JSON Body)**

| 변수명 | 타입 | 필수 | 설명 |
|--------|------|------|------|
| `email` | STRING | O | 관리자 이메일 |
| `password` | STRING | O | 관리자 비밀번호 |

**출력값**

| No | 출력명 | 출력 설명 |
|----|--------|---------|
| 1  | `accessToken` | 관리자 JWT 액세스 토큰 |

응답 쿠키: `vce_admin_token`

**메시지 설명**

| No | 구분 | 코드 | 설명 |
|----|------|------|------|
| 1  | ERROR | 401 | 로그인 실패 (이메일/비밀번호 불일치) |
| 2  | ERROR | 401 | 계정 잠금 (3회 실패 초과) |
| 3  | ERROR | 401 | 관리자 권한 없음 |

---

### 1-7. 내 정보 조회

| 항목 | 내용 |
|------|------|
| 요청주소 | `GET /api/auth/me` |
| 인증 | 필요 |

**출력값**

| No | 출력명 | 출력 설명 |
|----|--------|---------|
| 1  | `memberId` | 회원 ID |
| 2  | `email` | 이메일 |
| 3  | `name` | 이름 |
| 4  | `phoneNumber` | 전화번호 |
| 5  | `address` | 주소 |
| 6  | `bankName` | 은행명 |
| 7  | `accountNumber` | 계좌번호 |
| 8  | `accountHolder` | 예금주 |
| 9  | `role` | 역할 (`MEMBER`, `GUEST` 등) |
| 10 | `status` | 계정 상태 (`ACTIVE`, `LOCKED`, `WITHDRAWN` 등) |
| 11 | `createdAt` | 가입일시 |
| 12 | `totalVolume` | 총 거래량 (KRW) |
| 13 | `nextTierVolume` | 다음 등급 기준 거래량 |
| 14 | `referralCode` | 내 추천인 코드 |
| 15 | `hasIdPhoto` | 신분증 제출 여부 (boolean) |

---

### 1-8. 내 정보 수정

| 항목 | 내용 |
|------|------|
| 요청주소 | `PATCH /api/auth/me` |
| 인증 | 필요 |

**요청인자 (JSON Body, 수정할 항목만 포함)**

| 변수명 | 타입 | 필수 | 설명 |
|--------|------|------|------|
| `name` | STRING | X | 이름 |
| `phoneNumber` | STRING | X | 전화번호 |
| `address` | STRING | X | 주소 |
| `bankName` | STRING | X | 은행명 |
| `accountNumber` | STRING | X | 계좌번호 (숫자만) |
| `accountHolder` | STRING | X | 예금주 |

**출력값**

| No | 출력명 | 출력 설명 |
|----|--------|---------|
| 1  | `message` | `"회원 정보가 수정되었습니다."` |

---

### 1-9. 신분증 제출

| 항목 | 내용 |
|------|------|
| 요청주소 | `POST /api/auth/me/id-photo` |
| 인증 | 필요 |
| Content-Type | `multipart/form-data` |

**요청인자**

| 변수명 | 타입 | 필수 | 설명 |
|--------|------|------|------|
| `file` | FILE | O | 신분증 이미지 (jpg/jpeg/png, 최대 10MB) |

**출력값**

| No | 출력명 | 출력 설명 |
|----|--------|---------|
| 1  | `message` | 처리 결과 메시지 |
| 2  | `status` | 변경된 계정 상태 |
| 3  | `hasIdPhoto` | 신분증 제출 여부 (boolean) |

---

### 1-10. 토큰 갱신

| 항목 | 내용 |
|------|------|
| 요청주소 | `POST /api/auth/refresh` |
| 인증 | 불필요 (리프레시 토큰으로 인증) |

리프레시 토큰은 HttpOnly 쿠키(`vce_refresh_token` 또는 `vce_bank_refresh_token`)로 자동 전송되거나 Body로 전달.

**요청인자 (JSON Body, 선택)**

| 변수명 | 타입 | 필수 | 설명 |
|--------|------|------|------|
| `refreshToken` | STRING | X | 쿠키 미사용 시 본문으로 전달 |

**출력값**

| No | 출력명 | 출력 설명 |
|----|--------|---------|
| 1  | `accessToken` | 새 액세스 토큰 |
| 2  | `refreshToken` | 새 리프레시 토큰 (기존 토큰 즉시 무효화) |

---

### 1-11. 로그아웃

| 항목 | 내용 |
|------|------|
| 요청주소 | `POST /api/auth/logout` |
| 인증 | 필요 |

**요청인자 (JSON Body, 선택)**

| 변수명 | 타입 | 필수 | 설명 |
|--------|------|------|------|
| `refreshToken` | STRING | X | 리프레시 토큰 블랙리스트 등록용 |

**출력값**

| No | 출력명 | 출력 설명 |
|----|--------|---------|
| 1  | `message` | `"로그아웃이 완료되었습니다."` |

응답 쿠키: `vce_token`, `vce_bank_token`, `vce_refresh_token`, `vce_bank_refresh_token`, `vce_admin_token` 모두 삭제 (Max-Age=0)

---

### 1-12. 회원 탈퇴

| 항목 | 내용 |
|------|------|
| 요청주소 | `POST /api/auth/withdraw` |
| 인증 | 필요 |

**요청인자 (JSON Body, 선택)**

| 변수명 | 타입 | 필수 | 설명 |
|--------|------|------|------|
| `refreshToken` | STRING | X | 리프레시 토큰 블랙리스트 등록용 |

**출력값**

| No | 출력명 | 출력 설명 |
|----|--------|---------|
| 1  | `message` | `"회원 탈퇴가 완료되었습니다."` |

---

## 2. 자산 (`/api/assets`)

### 2-1. 전체 자산 조회

| 항목 | 내용 |
|------|------|
| 요청주소 | `GET /api/assets` |
| 인증 | 필요 |

**출력값** (Array)

| No | 출력명 | 출력 설명 |
|----|--------|---------|
| 1  | `assetType` | 자산 종류 (`KRW`, `BTC`, `ETH` 등) |
| 2  | `balance` | 보유 수량 |
| 3  | `lockedBalance` | 미체결 주문으로 잠긴 수량 |
| 4  | `availableBalance` | 사용 가능 수량 |
| 5  | `averageBuyPrice` | 평균 매수가 (KRW) |

---

### 2-2. 자산 요약 조회

| 항목 | 내용 |
|------|------|
| 요청주소 | `GET /api/assets/summary` |
| 인증 | 필요 |

**출력값**

| No | 출력명 | 출력 설명 |
|----|--------|---------|
| 1  | `krwBalance` | 보유 KRW |
| 2  | `totalInvestment` | 총 투자 원금 (입금 - 출금) |
| 3  | `totalAssetValue` | 총 자산 평가액 (KRW + 코인 평가액) |
| 4  | `profitLoss` | 총 손익 |
| 5  | `profitRate` | 수익률 (%) |

---

### 2-3. 단일 자산 조회

| 항목 | 내용 |
|------|------|
| 요청주소 | `GET /api/assets/{assetType}` |
| 인증 | 필요 |

**요청인자 (Path)**

| 변수명 | 타입 | 필수 | 설명 |
|--------|------|------|------|
| `assetType` | STRING | O | 자산 종류 (`KRW`, `BTC` 등) |

**출력값**: [2-1 단일 항목](#2-1-전체-자산-조회)과 동일

---

### 2-4. 입금 (KRW)

| 항목 | 내용 |
|------|------|
| 요청주소 | `POST /api/assets/deposit` |
| 인증 | 필요 |

**요청인자 (JSON Body)**

| 변수명 | 타입 | 필수 | 설명 |
|--------|------|------|------|
| `assetType` | STRING | O | `KRW` |
| `amount` | NUMBER | O | 입금액 (0 초과) |
| `bankName` | STRING | X | 은행명 |
| `accountNumber` | STRING | X | 계좌번호 |

**출력값**: 변경된 자산 정보 ([2-1 단일 항목](#2-1-전체-자산-조회)과 동일)

---

### 2-5. 출금 (KRW)

| 항목 | 내용 |
|------|------|
| 요청주소 | `POST /api/assets/withdraw` |
| 인증 | 필요 |

**요청인자**: [2-4 입금](#2-4-입금-krw)과 동일

**출력값**: 변경된 자산 정보

---

### 2-6. 은행 잔액 조회

| 항목 | 내용 |
|------|------|
| 요청주소 | `GET /api/assets/bank-balance` |
| 인증 | 필요 |

**출력값**

| No | 출력명 | 출력 설명 |
|----|--------|---------|
| 1  | `bankBalance` | 연결 은행 계좌 잔액 (KRW) |

---

## 3. 주문 (`/api/orders`)

### 3-1. 주문 생성

| 항목 | 내용 |
|------|------|
| 요청주소 | `POST /api/orders` |
| 인증 | 필요 |

**요청인자 (JSON Body)**

| 변수명 | 타입 | 필수 | 제약 | 설명 |
|--------|------|------|------|------|
| `orderType` | STRING | O | `BUY` 또는 `SELL` | 주문 유형 |
| `priceType` | STRING | O | `LIMIT` 또는 `MARKET` | 주문 방식 |
| `assetType` | STRING | O | `^[A-Z0-9]{2,10}$` | 코인 코드 (`BTC`, `ETH` 등) |
| `price` | NUMBER | O | 0 초과, 최대 999999999999 | 주문 가격 (KRW) |
| `amount` | NUMBER | O | 0 초과, 최대 999999999999 | 주문 수량 |

**출력값**

| No | 출력명 | 출력 설명 |
|----|--------|---------|
| 1  | `orderId` | 주문 ID |
| 2  | `orderType` | 주문 유형 (`BUY`/`SELL`) |
| 3  | `priceType` | 주문 방식 (`LIMIT`/`MARKET`) |
| 4  | `assetType` | 코인 코드 |
| 5  | `price` | 주문 가격 |
| 6  | `amount` | 주문 수량 |
| 7  | `filledAmount` | 체결된 수량 |
| 8  | `status` | 주문 상태 (`OPEN`, `FILLED`, `CANCELLED`) |
| 9  | `createdAt` | 주문 생성일시 |

---

### 3-2. 주문 내역 조회

| 항목 | 내용 |
|------|------|
| 요청주소 | `GET /api/orders` |
| 인증 | 필요 |

**출력값**: [3-1 출력값](#3-1-주문-생성) 목록 (Array)

---

### 3-3. 미체결 주문 조회

| 항목 | 내용 |
|------|------|
| 요청주소 | `GET /api/orders/open` |
| 인증 | 필요 |

**출력값**: 상태가 `OPEN`인 주문 목록 ([3-1 출력값](#3-1-주문-생성)과 동일)

---

### 3-4. 주문 취소

| 항목 | 내용 |
|------|------|
| 요청주소 | `DELETE /api/orders/{orderId}` |
| 인증 | 필요 |

**요청인자 (Path)**

| 변수명 | 타입 | 필수 | 설명 |
|--------|------|------|------|
| `orderId` | INTEGER | O | 취소할 주문 ID |

**출력값**: 취소된 주문 정보 ([3-1 출력값](#3-1-주문-생성)과 동일)

---

## 4. 거래 내역 (`/api/transactions`)

### 4-1. 거래 내역 조회

| 항목 | 내용 |
|------|------|
| 요청주소 | `GET /api/transactions` |
| 인증 | 필요 |

**요청인자 (Query String)**

| 변수명 | 타입 | 필수 | 설명 |
|--------|------|------|------|
| `assetType` | STRING | X | 자산 종류 필터 (`KRW`, `BTC` 등). 미입력 시 전체 조회 |

**출력값** (Array)

| No | 출력명 | 출력 설명 |
|----|--------|---------|
| 1  | `txId` | 거래 ID |
| 2  | `txType` | 거래 유형 (`BUY`, `SELL`, `DEPOSIT`, `WITHDRAW`, `ATTENDANCE_REWARD` 등) |
| 3  | `assetType` | 자산 종류 |
| 4  | `amount` | 거래 수량 |
| 5  | `price` | 거래 가격 |
| 6  | `totalValue` | 거래 총액 |
| 7  | `fee` | 수수료 |
| 8  | `txDate` | 거래일시 |
| 9  | `fromAddress` | 출금 지갑주소 |
| 10 | `toAddress` | 입금 지갑주소 |
| 11 | `txHash` | 트랜잭션 해시 |
| 12 | `bankName` | 은행명 |
| 13 | `accountNumber` | 계좌번호 |
| 14 | `note` | 비고 |
| 15 | `status` | 거래 상태 (`COMPLETED`, `PENDING`, `FAILED`) |

---

## 5. 지갑 (`/api/wallets`)

### 5-1. 입금 주소 조회

| 항목 | 내용 |
|------|------|
| 요청주소 | `GET /api/wallets/{assetType}/address` |
| 인증 | 필요 |

**요청인자 (Path)**

| 변수명 | 타입 | 필수 | 설명 |
|--------|------|------|------|
| `assetType` | STRING | O | 코인 코드 (`BTC`, `ETH` 등) |

**출력값**

| No | 출력명 | 출력 설명 |
|----|--------|---------|
| 1  | `address` | 입금용 지갑주소 (없으면 신규 생성) |

---

### 5-2. 코인 전송 (내부 이체)

| 항목 | 내용 |
|------|------|
| 요청주소 | `POST /api/wallets/transfer` |
| 인증 | 필요 |

**요청인자 (JSON Body)**

| 변수명 | 타입 | 필수 | 설명 |
|--------|------|------|------|
| `assetType` | STRING | O | 코인 코드 |
| `toAddress` | STRING | O | 수신 지갑주소 |
| `amount` | NUMBER | O | 전송 수량 (0 초과) |

**출력값**

| No | 출력명 | 출력 설명 |
|----|--------|---------|
| 1  | `message` | `"이체가 성공적으로 완료되었습니다."` |

**메시지 설명**

| No | 구분 | 코드 | 설명 |
|----|------|------|------|
| 1  | ERROR | 400 | 잔액 부족 또는 유효하지 않은 주소 |

---

## 6. 시장 정보 (`/api/market`)

> 업비트 REST API 프록시 — 별도 인증 불필요

### 6-1. 전체 마켓 목록

| 항목 | 내용 |
|------|------|
| 요청주소 | `GET /api/market/all` |
| 인증 | 불필요 |

업비트 `/v1/market/all` 응답을 그대로 반환.

---

### 6-2. 현재가 (Ticker)

| 항목 | 내용 |
|------|------|
| 요청주소 | `GET /api/market/ticker` |
| 인증 | 불필요 |

**요청인자 (Query String)**

| 변수명 | 타입 | 필수 | 설명 |
|--------|------|------|------|
| `markets` | STRING | O | 마켓 코드 콤마 구분 (예: `KRW-BTC,KRW-ETH`) |

업비트 `/v1/ticker` 응답을 그대로 반환.

---

### 6-3. 분봉 캔들

| 항목 | 내용 |
|------|------|
| 요청주소 | `GET /api/market/candles/minutes/{unit}` |
| 인증 | 불필요 |

**요청인자**

| 변수명 | 위치 | 타입 | 필수 | 설명 |
|--------|------|------|------|------|
| `unit` | Path | INTEGER | O | 분 단위 (`1`, `3`, `5`, `10`, `15`, `30`, `60`, `240`) |
| `market` | Query | STRING | O | 마켓 코드 (예: `KRW-BTC`) |
| `count` | Query | INTEGER | X | 캔들 개수 (기본값: 200) |

---

### 6-4. 일봉 캔들

| 항목 | 내용 |
|------|------|
| 요청주소 | `GET /api/market/candles/days` |
| 인증 | 불필요 |

**요청인자 (Query String)**

| 변수명 | 타입 | 필수 | 설명 |
|--------|------|------|------|
| `market` | STRING | O | 마켓 코드 |
| `count` | INTEGER | X | 캔들 개수 (기본값: 200) |

---

### 6-5. 호가창

| 항목 | 내용 |
|------|------|
| 요청주소 | `GET /api/market/orderbook` |
| 인증 | 불필요 |

**요청인자 (Query String)**

| 변수명 | 타입 | 필수 | 설명 |
|--------|------|------|------|
| `markets` | STRING | O | 마켓 코드 콤마 구분 |

---

### 6-6. 체결 내역

| 항목 | 내용 |
|------|------|
| 요청주소 | `GET /api/market/trades/ticks` |
| 인증 | 불필요 |

**요청인자 (Query String)**

| 변수명 | 타입 | 필수 | 설명 |
|--------|------|------|------|
| `market` | STRING | O | 마켓 코드 |
| `count` | INTEGER | X | 최근 체결 개수 (기본값: 50) |

---

## 7. 커뮤니티 (`/api/community`)

### 7-1. 게시글 목록 조회

| 항목 | 내용 |
|------|------|
| 요청주소 | `GET /api/community/posts` |
| 인증 | 선택 (로그인 시 좋아요·수정·삭제 여부 추가 반환) |

**요청인자 (Query String)**

| 변수명 | 타입 | 필수 | 제약 | 설명 |
|--------|------|------|------|------|
| `keyword` | STRING | X | 최대 100자 | 제목·내용 검색 키워드 |

**출력값** (Array)

| No | 출력명 | 출력 설명 |
|----|--------|---------|
| 1  | `postId` | 게시글 ID |
| 2  | `authorName` | 작성자명 (관리자 작성 시 `"관리자"`) |
| 3  | `title` | 제목 |
| 4  | `content` | 본문 |
| 5  | `attachmentUrl` | 첨부 링크 URL |
| 6  | `notice` | 공지 여부 (boolean) |
| 7  | `hidden` | 숨김 여부 (boolean) |
| 8  | `viewCount` | 조회수 |
| 9  | `likeCount` | 좋아요 수 |
| 10 | `commentCount` | 댓글 수 |
| 11 | `createdAt` | 작성일시 |
| 12 | `updatedAt` | 수정일시 |
| 13 | `canEdit` | 수정 권한 여부 (boolean) |
| 14 | `canDelete` | 삭제 권한 여부 (boolean) |
| 15 | `userLiked` | 현재 사용자 좋아요 여부 (boolean) |

---

### 7-2. 게시글 단건 조회

| 항목 | 내용 |
|------|------|
| 요청주소 | `GET /api/community/posts/{postId}` |
| 인증 | 선택 |

**요청인자 (Path)**

| 변수명 | 타입 | 필수 | 설명 |
|--------|------|------|------|
| `postId` | INTEGER | O | 게시글 ID |

**출력값**: [7-1 단일 항목](#7-1-게시글-목록-조회)과 동일

---

### 7-3. 게시글 작성

| 항목 | 내용 |
|------|------|
| 요청주소 | `POST /api/community/posts` |
| 인증 | 필요 |

**요청인자 (JSON Body)**

| 변수명 | 타입 | 필수 | 제약 | 설명 |
|--------|------|------|------|------|
| `title` | STRING | O | 1~200자 | 제목 |
| `content` | STRING | O | 1~10,000자 | 본문 |
| `attachmentUrl` | STRING | X | 최대 500자, `https?://` 또는 `/uploads/` | 첨부 링크 |
| `notice` | BOOLEAN | X | 관리자만 유효 | 공지 여부 |

**출력값**: 생성된 게시글 ([7-1 단일 항목](#7-1-게시글-목록-조회)과 동일)

---

### 7-4. 게시글 수정

| 항목 | 내용 |
|------|------|
| 요청주소 | `PATCH /api/community/posts/{postId}` |
| 인증 | 필요 (작성자 또는 관리자) |

**요청인자**: [7-3 게시글 작성](#7-3-게시글-작성) 동일

---

### 7-5. 게시글 삭제

| 항목 | 내용 |
|------|------|
| 요청주소 | `POST /api/community/posts/{postId}/delete` |
| 인증 | 필요 (작성자 또는 관리자) |

**출력값**: 없음 (204 No Content)

---

### 7-6. 댓글 목록 조회

| 항목 | 내용 |
|------|------|
| 요청주소 | `GET /api/community/posts/{postId}/comments` |
| 인증 | 선택 |

**출력값** (Array)

| No | 출력명 | 출력 설명 |
|----|--------|---------|
| 1  | `commentId` | 댓글 ID |
| 2  | `authorName` | 작성자명 |
| 3  | `content` | 내용 |
| 4  | `likeCount` | 좋아요 수 |
| 5  | `userLiked` | 현재 사용자 좋아요 여부 |
| 6  | `canEdit` | 수정 권한 여부 |
| 7  | `canDelete` | 삭제 권한 여부 |
| 8  | `createdAt` | 작성일시 |

---

### 7-7. 댓글 작성

| 항목 | 내용 |
|------|------|
| 요청주소 | `POST /api/community/posts/{postId}/comments` |
| 인증 | 필요 |

**요청인자 (JSON Body)**

| 변수명 | 타입 | 필수 | 제약 | 설명 |
|--------|------|------|------|------|
| `content` | STRING | O | 1~1,000자 | 댓글 내용 |

---

### 7-8. 댓글 수정

| 항목 | 내용 |
|------|------|
| 요청주소 | `PATCH /api/community/comments/{commentId}` |
| 인증 | 필요 (작성자만) |

**요청인자**: [7-7 댓글 작성](#7-7-댓글-작성)과 동일

---

### 7-9. 댓글 삭제

| 항목 | 내용 |
|------|------|
| 요청주소 | `POST /api/community/comments/{commentId}/delete` |
| 인증 | 필요 (작성자만) |

**출력값**: 없음 (204 No Content)

---

### 7-10. 게시글 좋아요

| 항목 | 내용 |
|------|------|
| 요청주소 | `POST /api/community/posts/{postId}/like` |
| 인증 | 필요 |

**출력값**

| No | 출력명 | 출력 설명 |
|----|--------|---------|
| 1  | `likeCount` | 변경된 좋아요 수 |

---

### 7-11. 커뮤니티 첨부파일 업로드

| 항목 | 내용 |
|------|------|
| 요청주소 | `POST /api/community/uploads` |
| 인증 | 불필요 |
| Content-Type | `multipart/form-data` |

**요청인자**

| 변수명 | 타입 | 필수 | 설명 |
|--------|------|------|------|
| `file` | FILE | O | 이미지 (jpg/jpeg/png, 최대 10MB) |

**출력값**

| No | 출력명 | 출력 설명 |
|----|--------|---------|
| 1  | `attachmentUrl` | 업로드된 파일 경로 (`/uploads/UUID.ext`) |

---

## 8. 이벤트 (`/api/events`)

### 8-1. 오늘의 이벤트 참여 현황

| 항목 | 내용 |
|------|------|
| 요청주소 | `GET /api/events/status` |
| 인증 | 필요 |

**출력값**

| No | 출력명 | 출력 설명 |
|----|--------|---------|
| 1  | `attendanceDone` | 오늘 출석 체크 완료 여부 (boolean) |
| 2  | `adMissionCount` | 오늘 광고 미션 완료 횟수 (0~3) |

---

### 8-2. 출석 체크

| 항목 | 내용 |
|------|------|
| 요청주소 | `POST /api/events/attendance` |
| 인증 | 필요 |
| 제한 | 하루 1회 |

**출력값**

| No | 출력명 | 출력 설명 |
|----|--------|---------|
| 1  | `success` | 성공 여부 (boolean) |
| 2  | `coin` | 지급된 코인 코드 (랜덤) |
| 3  | `amount` | 지급된 코인 수량 (1,000~100,000, 1,000 단위 랜덤) |
| 4  | `message` | 처리 결과 메시지 |

**메시지 설명**

| No | 구분 | 코드 | 설명 |
|----|------|------|------|
| 1  | ERROR | 409 | 오늘 이미 출석 체크 완료 |

---

### 8-3. 광고 보기 미션

| 항목 | 내용 |
|------|------|
| 요청주소 | `POST /api/events/ad-mission` |
| 인증 | 필요 |
| 제한 | 하루 3회 |
| 보상 | 5,000 KRW |

**출력값**

| No | 출력명 | 출력 설명 |
|----|--------|---------|
| 1  | `success` | 성공 여부 (boolean) |
| 2  | `reward` | 지급된 KRW 수량 (`5000`) |
| 3  | `adMissionCount` | 오늘 누적 완료 횟수 |
| 4  | `message` | 처리 결과 메시지 |

**메시지 설명**

| No | 구분 | 코드 | 설명 |
|----|------|------|------|
| 1  | ERROR | 409 | 오늘 광고 미션 한도(3회) 초과 |

---

## 9. 고객지원 (`/api/support`)

### 9-1. FAQ 목록 조회

| 항목 | 내용 |
|------|------|
| 요청주소 | `GET /api/support/faqs` |
| 인증 | 불필요 |

**출력값** (Array)

| No | 출력명 | 출력 설명 |
|----|--------|---------|
| 1  | `faqId` | FAQ ID |
| 2  | `question` | 질문 |
| 3  | `answer` | 답변 |
| 4  | `category` | 카테고리 |

---

### 9-2. 내 1:1 문의 목록 조회

| 항목 | 내용 |
|------|------|
| 요청주소 | `GET /api/support/inquiries` |
| 인증 | 필요 |

**출력값** (Array)

| No | 출력명 | 출력 설명 |
|----|--------|---------|
| 1  | `inquiryId` | 문의 ID |
| 2  | `title` | 제목 |
| 3  | `content` | 내용 |
| 4  | `status` | 상태 (`PENDING`, `ANSWERED`) |
| 5  | `reply` | 관리자 답변 |
| 6  | `attachmentUrl` | 첨부파일 URL |
| 7  | `createdAt` | 작성일시 |

---

### 9-3. 1:1 문의 작성

| 항목 | 내용 |
|------|------|
| 요청주소 | `POST /api/support/inquiries` |
| 인증 | 필요 |
| Content-Type | `multipart/form-data` |

**요청인자**

| 변수명 | 타입 | 필수 | 제약 | 설명 |
|--------|------|------|------|------|
| `title` | STRING | O | 최대 200자 | 문의 제목 |
| `content` | STRING | O | 최대 5,000자 | 문의 내용 |
| `file` | FILE | X | jpg/jpeg/png, 최대 10MB | 첨부 이미지 |

**출력값**: 생성된 문의 ([9-2 단일 항목](#9-2-내-11-문의-목록-조회)과 동일)

---

### 9-4. 1:1 문의 삭제

| 항목 | 내용 |
|------|------|
| 요청주소 | `DELETE /api/support/inquiries/{inquiryId}` |
| 인증 | 필요 (본인만) |

**출력값**

| No | 출력명 | 출력 설명 |
|----|--------|---------|
| 1  | `message` | `"문의가 삭제되었습니다."` |

---

## 10. 뉴스 (`/api/news`)

### 10-1. 최신 뉴스 조회

| 항목 | 내용 |
|------|------|
| 요청주소 | `GET /api/news` |
| 인증 | 불필요 |

**출력값** (Array)

| No | 출력명 | 출력 설명 |
|----|--------|---------|
| 1  | `title` | 뉴스 제목 |
| 2  | `url` | 뉴스 링크 URL |
| 3  | `publishedAt` | 발행일시 |
| 4  | `source` | 출처 |

---

## 11. 파일 (`/api/files`)

### 11-1. 신분증 이미지 조회

| 항목 | 내용 |
|------|------|
| 요청주소 | `GET /api/files/id-photo/{filename}` |
| 인증 | 필요 (관리자/직원 전용: `VCESYS_CORE`, `VCESYS_MGMT`, `VCESYS_EMP`) |

**요청인자 (Path)**

| 변수명 | 타입 | 필수 | 제약 | 설명 |
|--------|------|------|------|------|
| `filename` | STRING | O | UUID 형식 + 확장자 (`^[0-9a-fA-F\-]{36}\.(jpg\|jpeg\|png)$`) | 파일명 |

**출력값**: 이미지 바이너리 (`Content-Type: image/jpeg` 또는 `image/png`)

응답 헤더: `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff`, `Cache-Control: no-store`

---

## 12. 관리자 (`/api/admin`)

> 모든 엔드포인트에 관리자 JWT 인증 필요. 역할별 접근 권한 별도 명시.

### 역할 체계

| 역할 | 설명 |
|------|------|
| `VCESYS_CORE` | 최고 관리자 (전체 권한) |
| `VCESYS_MGMT` | 매니저 (조회·승인·답변) |
| `VCESYS_EMP` | 직원 (조회·문의 답변) |

---

### 12-1. 회원 목록 조회

| 항목 | 내용 |
|------|------|
| 요청주소 | `GET /api/admin/members` |
| 권한 | `VCESYS_CORE`, `VCESYS_MGMT` |

---

### 12-2. 회원 검색

| 항목 | 내용 |
|------|------|
| 요청주소 | `GET /api/admin/members/search` |
| 권한 | `VCESYS_CORE`, `VCESYS_MGMT` |

**요청인자 (Query String)**

| 변수명 | 타입 | 필수 | 설명 |
|--------|------|------|------|
| `q` | STRING | X | 이름·이메일 키워드 (최대 100자) |
| `role` | STRING | X | 역할 필터 |
| `status` | STRING | X | 상태 필터 (`ACTIVE`, `LOCKED` 등) |
| `page` | INTEGER | X | 페이지 번호 (기본값: 0) |
| `size` | INTEGER | X | 페이지 당 건수 (기본값: 20) |

**출력값**

| No | 출력명 | 출력 설명 |
|----|--------|---------|
| 1  | `content` | 회원 목록 |
| 2  | `totalElements` | 전체 건수 |
| 3  | `totalPages` | 전체 페이지 수 |
| 4  | `page` | 현재 페이지 |

---

### 12-3. 회원 상세 조회

| 항목 | 내용 |
|------|------|
| 요청주소 | `GET /api/admin/members/{memberId}` |
| 권한 | `VCESYS_CORE`, `VCESYS_MGMT`, `VCESYS_EMP` |

---

### 12-4. 회원 상세 조회 (개인정보 마스킹 해제)

| 항목 | 내용 |
|------|------|
| 요청주소 | `GET /api/admin/members/{memberId}/unmask` |
| 권한 | `VCESYS_CORE` 전용 |

---

### 12-5. 회원 상태 변경

| 항목 | 내용 |
|------|------|
| 요청주소 | `PATCH /api/admin/members/{memberId}/status` |
| 권한 | `VCESYS_CORE` 전용 |

**요청인자 (JSON Body)**

| 변수명 | 타입 | 필수 | 설명 |
|--------|------|------|------|
| `status` | STRING | O | 변경할 상태 (`ACTIVE`, `LOCKED`, `WITHDRAWN` 등) |

---

### 12-6. 신분증 승인

| 항목 | 내용 |
|------|------|
| 요청주소 | `PATCH /api/admin/members/{memberId}/approve-id` |
| 권한 | `VCESYS_CORE`, `VCESYS_MGMT` |

---

### 12-7. 자산 회수

| 항목 | 내용 |
|------|------|
| 요청주소 | `PATCH /api/admin/members/{memberId}/assets/reclaim` |
| 권한 | `VCESYS_CORE` 전용 |

**요청인자 (JSON Body)**

| 변수명 | 타입 | 필수 | 설명 |
|--------|------|------|------|
| `assetType` | STRING | O | 회수할 자산 종류 |
| `amount` | NUMBER | O | 회수 수량 |
| `reason` | STRING | O | 회수 사유 |

---

### 12-8. 전체 주문 조회

| 항목 | 내용 |
|------|------|
| 요청주소 | `GET /api/admin/orders` |
| 권한 | `VCESYS_CORE`, `VCESYS_MGMT` |

---

### 12-9. 전체 자산 조회

| 항목 | 내용 |
|------|------|
| 요청주소 | `GET /api/admin/assets` |
| 권한 | `VCESYS_CORE`, `VCESYS_MGMT` |

---

### 12-10. 거래 내역 검색

| 항목 | 내용 |
|------|------|
| 요청주소 | `GET /api/admin/transactions/search` |
| 권한 | `VCESYS_CORE`, `VCESYS_MGMT` |

**요청인자 (Query String)**

| 변수명 | 타입 | 필수 | 설명 |
|--------|------|------|------|
| `memberEmail` | STRING | X | 회원 이메일 (최대 200자) |
| `assetType` | STRING | X | 자산 종류 |
| `txType` | STRING | X | 거래 유형 |
| `from` | STRING | X | 시작일 (`yyyy-MM-dd`) |
| `to` | STRING | X | 종료일 (`yyyy-MM-dd`) |
| `page` | INTEGER | X | 페이지 번호 (기본값: 0) |
| `size` | INTEGER | X | 페이지 당 건수 (기본값: 20) |

---

### 12-11. 통계 조회

| 항목 | 내용 |
|------|------|
| 요청주소 | `GET /api/admin/stats` |
| 권한 | `VCESYS_CORE`, `VCESYS_MGMT` |

---

### 12-12. 문의 목록 조회

| 항목 | 내용 |
|------|------|
| 요청주소 | `GET /api/admin/inquiries` |
| 권한 | `VCESYS_CORE`, `VCESYS_MGMT`, `VCESYS_EMP` |

---

### 12-13. 문의 답변

| 항목 | 내용 |
|------|------|
| 요청주소 | `PATCH /api/admin/inquiries/{inquiryId}/reply` |
| 권한 | `VCESYS_CORE`, `VCESYS_MGMT`, `VCESYS_EMP` |

**요청인자 (JSON Body)**

| 변수명 | 타입 | 필수 | 설명 |
|--------|------|------|------|
| `status` | STRING | X | `ANSWERED` (기본값) |
| `reply` | STRING | O | 답변 내용 |

---

### 12-14. 직원 목록 조회

| 항목 | 내용 |
|------|------|
| 요청주소 | `GET /api/admin/staff` |
| 권한 | `VCESYS_CORE` 전용 |

---

### 12-15. 직원 생성

| 항목 | 내용 |
|------|------|
| 요청주소 | `POST /api/admin/staff` |
| 권한 | `VCESYS_CORE` 전용 |

**요청인자 (JSON Body)**

| 변수명 | 타입 | 필수 | 설명 |
|--------|------|------|------|
| `email` | STRING | O | 직원 이메일 |
| `password` | STRING | O | 초기 비밀번호 |
| `name` | STRING | O | 이름 |
| `role` | STRING | O | `VCESYS_MGMT` 또는 `VCESYS_EMP` |

---

### 12-16. 직원 삭제

| 항목 | 내용 |
|------|------|
| 요청주소 | `POST /api/admin/staff/{memberId}/delete` |
| 권한 | `VCESYS_CORE` 전용 |

---

### 12-17. 관리자 비밀번호 확인

| 항목 | 내용 |
|------|------|
| 요청주소 | `POST /api/admin/verify-password` |
| 권한 | `VCESYS_CORE`, `VCESYS_MGMT`, `VCESYS_EMP` |

**요청인자 (JSON Body)**

| 변수명 | 타입 | 필수 | 설명 |
|--------|------|------|------|
| `password` | STRING | O | 확인할 비밀번호 |

**출력값**

| No | 출력명 | 출력 설명 |
|----|--------|---------|
| 1  | `verified` | 인증 성공 여부 (boolean) |
| 2  | `message` | 결과 메시지 |

---

*작성 기준: `secure-web` 브랜치 코드 기준*
