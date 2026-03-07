================================================================================
[VCE-AUTH-03] 로그인 인증 실패 횟수 제한 없음 → 브루트포스 공격
도메인: auth
================================================================================

## 1. 진단 항목 개요

- **항목명**: Rate Limiting 부재로 인한 브루트포스 가능
- **번호**: AUTH-03
- **위험도**: Medium
- **OWASP**: A07:2021 – Identification and Authentication Failures

## 2. 대상 기능 & 엔드포인트

| 항목 | 내용 |
|------|------|
| 로컬 | http://localhost:8080/api/auth/login |
| 운영 | https://vceapp.com/api/auth/login |
| HTTP 메서드 | POST |
| 인증 요건 | 없음 |

## 3. 취약점 원리 (Why this works)

Rate Limiting이 없는 로그인 엔드포인트는 공격자가 자동화 도구를 이용해
동일 계정에 대해 수천~수백만 회 비밀번호를 시도할 수 있다.

패스워드 정책이 약하거나(예: 8자 이하 숫자+영문), 사용자가 예측 가능한 패스워드를
사용하는 경우 결합 시 계정 탈취 가능성이 매우 높다.

IP 기반 제한이 없으면 단일 IP에서 무제한 시도가 가능하다.
계정 잠금 정책이 없으면 특정 계정에 대한 집중 공격이 가능하다.

## 4. 테스트 절차 (Step-by-step)

### [사전 준비]
1. Burp Suite → Proxy → Intercept 켜기
2. 테스트할 대상 계정 이메일 확보: test@vce.com

---

### Step 1. 로그인 요청 캡처

```
POST /api/auth/login HTTP/1.1
Host: localhost:8080
Content-Type: application/json

{
  "email": "test@vce.com",
  "password": "wrongpassword"
}
```

예상 응답 (실패):
```json
{"message": "비밀번호가 올바르지 않습니다"}
```

---

### Step 2. Burp Suite Intruder 설정

1. 해당 요청 우클릭 → Send to Intruder
2. Positions 탭 → `"password"` 값에 `§` 마커 설정:
   ```
   {"email": "test@vce.com", "password": "§wrongpassword§"}
   ```
3. Attack Type: Sniper
4. Payloads → Payload type: Simple list
5. 패스워드 목록 추가:
   ```
   test1234
   password123
   vce1234
   test123!
   Test1234!
   admin1234
   1234qwer
   qwer1234
   ```

---

### Step 3. 50회 연속 로그인 실패 테스트

curl로 빠른 테스트:
```bash
for i in $(seq 1 50); do
  curl -s -X POST http://localhost:8080/api/auth/login \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"test@vce.com\",\"password\":\"wrong$i\"}" \
    -o /dev/null -w "[$i] HTTP: %{http_code}\n"
done
```

**관찰 포인트**:
- 응답 코드가 계속 400/401인가, 아니면 429 Too Many Requests가 발생하는가?
- 50회 이후 계정이 잠기는가? (응답 메시지 변화)
- 응답 시간이 증가하는가? (타임아웃 방어)

---

### Step 4. 관리자 계정 브루트포스 시도

하드코딩된 admin 계정(DataInitializer.java:41) 테스트:
```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@vce.com","password":"admin1234"}'
```

기본 패스워드 목록:
```
admin1234
admin123
Admin1234!
vce_admin
admin@123
password
```

## 5. 취약 여부 판단 기준

✅ **취약 (Vulnerable)**:
- 50회 이상 연속 실패 후에도 HTTP 400/401 동일 응답 (잠금 없음)
- 응답에 `Retry-After` 헤더 없음
- curl 반복 실행 중 429 응답 없음

✗ **안전 (Not Vulnerable)**:
- 5회 실패 후 HTTP 429 Too Many Requests
- `Retry-After: 60` 헤더 포함
- 계정 잠금 메시지 반환

## 6. 예상 취약 포인트 (코드 위치)

- `AuthController.java` — POST /api/auth/login 핸들러에 Rate Limit 없음
- `SecurityConfig.java` — Spring Security의 인증 실패 횟수 제한 미설정
- `DataInitializer.java:41` — admin@vce.com / admin1234 하드코딩

## 7. 권고 조치

- Spring Security + Bucket4j 또는 Resilience4j로 Rate Limiting 구현:
  IP당 분당 5회 실패 시 15분 잠금
- 계정별 연속 실패 5회 시 임시 잠금 + 이메일 알림
- CAPTCHA 적용 (3회 실패 이후)
- 관리자 계정 기본 패스워드 변경 강제화
