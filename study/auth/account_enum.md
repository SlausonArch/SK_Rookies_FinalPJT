================================================================================
[VCE-AUTH-04] 오류 메시지 차이로 인한 계정 열거 가능성
도메인: auth
================================================================================

## 1. 진단 항목 개요

- **항목명**: 계정 존재 여부 열거 (Account Enumeration)
- **번호**: AUTH-04
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

로그인 실패 시 "계정이 없습니다"와 "비밀번호가 틀렸습니다"라는 서로 다른 오류 메시지를 반환하면,
공격자는 이메일 주소만으로 해당 계정이 실제로 존재하는지 여부를 알 수 있다.

이를 통해:
1. 유효한 이메일 목록을 수집하고 (Credential Stuffing 공격의 사전 단계)
2. 브루트포스 공격 대상 이메일을 좁힐 수 있으며
3. 피싱 대상 계정을 확인할 수 있다

응답 시간 차이(Timing Attack)도 같은 정보를 제공할 수 있다:
- DB에서 사용자 조회 시간 ≠ 패스워드 해시 비교 시간
- 계정이 없으면 일찍 반환, 있으면 bcrypt 연산 후 반환

## 4. 테스트 절차 (Step-by-step)

### [사전 준비]
1. Burp Suite → Proxy 활성화
2. 알려진 계정 이메일: test@vce.com
3. 존재하지 않는 이메일: notexist_xyzabc@vce.com

---

### Step 1. 존재하는 계정 + 틀린 패스워드

```
POST /api/auth/login HTTP/1.1
Host: localhost:8080
Content-Type: application/json

{
  "email": "test@vce.com",
  "password": "wrongpassword999"
}
```

응답 예시:
```json
{"message": "비밀번호가 올바르지 않습니다"}
```
또는:
```json
{"message": "아이디 또는 비밀번호를 확인해주세요"}
```

응답 시간 기록: ___ms

---

### Step 2. 존재하지 않는 계정

```
POST /api/auth/login HTTP/1.1
Host: localhost:8080
Content-Type: application/json

{
  "email": "notexist_xyzabc@vce.com",
  "password": "wrongpassword999"
}
```

응답 예시 (취약):
```json
{"message": "존재하지 않는 이메일입니다"}
```

응답 시간 기록: ___ms

---

### Step 3. 응답 메시지 비교

| 시나리오 | HTTP 코드 | 메시지 | 시간 |
|---------|---------|-------|------|
| 존재 + 틀린 PW | | | |
| 미존재 이메일 | | | |

---

### Step 4. Burp Intruder로 대량 열거 (이메일 목록)

```
POST /api/auth/login HTTP/1.1
Host: localhost:8080
Content-Type: application/json

{
  "email": "§target@vce.com§",
  "password": "wrongpassword"
}
```

Payload: 이메일 목록 파일
```
test@vce.com
admin@vce.com
user1@vce.com
john@vce.com
...
```

Grep — Match 설정으로 특정 응답 메시지 필터링하여 유효 이메일 식별.

---

### Step 5. 회원가입 중복 체크로 열거

```
POST /api/auth/signup HTTP/1.1
Host: localhost:8080
Content-Type: application/json

{
  "email": "test@vce.com",
  "password": "Test1234!"
}
```

응답: "이미 사용 중인 이메일입니다" → 계정 존재 확인 가능

## 5. 취약 여부 판단 기준

✅ **취약 (Vulnerable)**:
- 응답 메시지가 다름: "이메일이 없습니다" vs "비밀번호 틀림"
- 응답 시간 차이 100ms 이상

✗ **안전 (Not Vulnerable)**:
- 동일 메시지: "이메일 또는 비밀번호를 확인해주세요"
- 응답 시간 차이 없음 (dummy bcrypt 연산 적용)

## 6. 예상 취약 포인트 (코드 위치)

- `AuthController.java` — 로그인 실패 케이스 분기 처리
- `MemberService.java` — findByEmail 결과에 따른 다른 예외 처리

## 7. 권고 조치

- 존재하지 않는 이메일과 틀린 패스워드에 동일 메시지 반환
- Timing Attack 방지: 계정 미존재 시에도 dummy bcrypt 연산 수행
- 회원가입 중복 체크 응답도 동일하게 처리
