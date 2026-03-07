================================================================================
[VCE-AUTH-07] /uploads/** 인증 없이 접근 → 타 사용자 신분증 사진 노출
도메인: auth
================================================================================

## 1. 진단 항목 개요

- **항목명**: 업로드 파일 접근 제어 없음 (신분증 사진 무단 접근)
- **번호**: AUTH-07
- **위험도**: High
- **OWASP**: A01:2021 – Broken Access Control

## 2. 대상 기능 & 엔드포인트

| 항목 | 내용 |
|------|------|
| 로컬 | http://localhost:8080/uploads/{filename} |
| 운영 | https://vceapp.com/uploads/{filename} |
| HTTP 메서드 | GET |
| 인증 요건 | 없음 (permitAll — 취약) |

## 3. 취약점 원리 (Why this works)

`SecurityConfig.java:72`:
```java
.requestMatchers("/uploads/**").permitAll()
```

모든 업로드 파일이 인증 없이 누구나 접근할 수 있다.
신분증 사진 파일명은 `UUID_원본파일명` 형식이므로 완전히 랜덤하지 않다.

원본 파일명이 `id.jpg`, `identity.jpg` 등 예측 가능하다면,
UUID 부분은 충분히 랜덤하지만 파일명 패턴이 노출되면 접근 가능하다.

관리자가 신분증 심사 중 파일 URL을 외부에 공유하거나,
오류 메시지/로그에 파일 경로가 포함되면 공격자가 URL을 획득할 수 있다.

## 4. 테스트 절차 (Step-by-step)

### [사전 준비]
1. test@vce.com으로 로그인
2. 신분증 사진 업로드 후 반환 URL 확인

---

### Step 1. 자신의 신분증 URL 확인

신분증 업로드 후 응답:
```json
{"idPhotoUrl": "/uploads/550e8400-e29b-41d4-a716-446655440000_myid.jpg"}
```

---

### Step 2. 비인증 상태로 접근 시도

토큰 없이 직접 접근:
```
GET /uploads/550e8400-e29b-41d4-a716-446655440000_myid.jpg HTTP/1.1
Host: localhost:8080
```
(Authorization 헤더 없음)

→ 인증 없이 이미지 다운로드 가능 여부 확인

---

### Step 3. 타 사용자 파일명 추측

파일명 패턴: `{UUID}_{원본파일명}`
원본파일명 예측 리스트:
```
id.jpg
id.jpeg
identity.jpg
신분증.jpg
주민등록증.jpg
passport.jpg
license.jpg
```

Burp Intruder로 UUID 무작위 + 파일명 조합 시도:
```
GET /uploads/§uuid§_id.jpg HTTP/1.1
Host: localhost:8080
```

---

### Step 4. 디렉토리 리스팅 시도

```
GET /uploads/ HTTP/1.1
Host: localhost:8080
```

디렉토리 인덱싱이 활성화된 경우 전체 업로드 파일 목록 노출.

---

### Step 5. Path Traversal 시도

```
GET /uploads/../application.properties HTTP/1.1
Host: localhost:8080

GET /uploads/..%2F..%2Fetc%2Fpasswd HTTP/1.1
Host: localhost:8080
```

## 5. 취약 여부 판단 기준

✅ **취약 (Vulnerable)**:
- 비인증 GET 요청으로 이미지 파일 HTTP 200 반환
- 디렉토리 리스팅으로 업로드 파일 목록 노출
- 타 사용자 신분증 사진 다운로드 성공

✗ **안전 (Not Vulnerable)**:
- HTTP 401 또는 403 반환 (인증 필요)
- 디렉토리 리스팅 비활성화 (403 반환)

## 6. 예상 취약 포인트 (코드 위치)

- `SecurityConfig.java:72` — `.requestMatchers("/uploads/**").permitAll()`
- 파일 서빙 설정 — Nginx/Tomcat에서 /uploads 디렉토리 직접 노출

## 7. 권고 조치

- `/uploads/**`를 permitAll에서 제거하고 인증 필요로 변경
- 파일 다운로드 API 생성: GET /api/files/{id} → 소유자 확인 후 반환
- 파일 저장 위치를 웹 루트 외부로 이동
- Nginx에서 디렉토리 인덱싱 비활성화: `autoindex off`
