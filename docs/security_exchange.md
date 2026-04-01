# 보안 취약점 진단 및 조치 보고서 — 거래소 (Exchange)

- **대상 URL**: http://localhost:15173
- **작성일**: 2026-03-27
- **대상 기술 스택**: React (Vite) + Spring Boot 백엔드 공유

---

## 1. XSS / CSRF

### XSS (Cross-Site Scripting)

| 항목 | 내용 |
|------|------|
| 해당 여부 | **해당 있음 → 조치 완료** |
| 취약 경로 | 커뮤니티 게시글 상세 페이지 (`/community/{postId}`) |

**기존 방식**
게시글 작성 시 "첨부 링크" 필드에 `javascript:alert(document.cookie)` 등 임의의 문자열을 입력해도 검증 없이 DB에 저장되었으며, 상세 페이지에서 `<a href={attachmentHref}>열기</a>` 형태로 그대로 렌더링되었음. 사용자가 해당 링크를 클릭하면 브라우저가 JavaScript를 실행(Stored XSS).

**조치 내용**

1. **프론트엔드 (`CommunityDetail.tsx`)**: `attachmentHref` 계산 시 `new URL()` 파싱 후 프로토콜이 `http:` 또는 `https:` 인 경우만 허용, 그 외는 `null` 처리하여 링크 자체를 렌더링하지 않음.

   ```typescript
   // 변경 전
   const attachmentHref = post?.attachmentUrl
     ? (post.attachmentUrl.startsWith('http') ? post.attachmentUrl : `${API_BASE}${post.attachmentUrl}`)
     : null;

   // 변경 후
   const attachmentHref = (() => {
     const url = post?.attachmentUrl;
     if (!url) return null;
     const resolved = url.startsWith('http') ? url : `${API_BASE}${url}`;
     try {
       const { protocol } = new URL(resolved);
       return protocol === 'https:' || protocol === 'http:' ? resolved : null;
     } catch { return null; }
   })();
   ```

2. **프론트엔드 (`CommunityWrite.tsx`)**: 저장 전 URL 파싱으로 프로토콜 검증, `javascript:` / `data:` 등 비허용 프로토콜 차단.

3. **백엔드 (`PostRequestDto.java`)**: `@Pattern(regexp = "^(https?://.*|/uploads/.*)$")` 어노테이션 추가. `http://` 또는 `https://` 로 시작하는 외부 URL 또는 `/uploads/` 경로만 DB 저장 허용.

4. **백엔드 (`CommunityService.java`)**: 기존에 제목·본문에 jsoup `Safelist.none()` 기반 HTML 태그 제거(`sanitizeText`) 적용 중.

### CSRF (Cross-Site Request Forgery)

| 항목 | 내용 |
|------|------|
| 해당 여부 | **해당 사항 없음 (구조적으로 방어됨)** |

**기존 방식 및 현황**
Spring Security CSRF 비활성화 상태이나, 아래 구조적 방어로 CSRF 위험이 낮음.

- JWT 토큰(`Authorization: Bearer`)을 요청 헤더에 직접 포함: 브라우저가 자동 전송하지 않으므로 CSRF 성립 불가.
- JWT 쿠키에 `SameSite=Strict` 적용(조치 내용 참조) → 타 도메인 요청 시 쿠키 미포함.

---

## 2. Injection

| 항목 | 내용 |
|------|------|
| 해당 여부 | **해당 있음 → 기존 조치 적용 중** |

**기존 방식**
JPA/Hibernate 파라미터 바인딩으로 SQL Injection 기본 방어. 커뮤니티 검색(`CommunityService`)에서 LIKE 쿼리 시 `%`, `_`, `\` 이스케이프 처리 적용.

**조치 내용**
- JPA Named Parameter(`?1`, `:keyword`) 사용으로 SQL 직접 문자열 조합 없음.
- LIKE 검색 이스케이프: `keyword.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")` + `ESCAPE '\\'` 절 적용.
- 입력값에 CRLF 문자 포함 시 `replaceAll("[\r\n\t]", " ")` 처리(Log Injection 방지).

---

## 3. 파라미터 / 히든 값 조작

| 항목 | 내용 |
|------|------|
| 해당 여부 | **해당 있음 → 조치 적용 중** |

**기존 방식 및 조치 내용**
- 게시글 수정/삭제 시 서버에서 `@AuthenticationPrincipal`로 로그인 사용자 이메일과 작성자 이메일 일치 여부 비교. 파라미터로 타인 postId 전달해도 작성자 불일치 시 예외.
- 공지사항(`isNotice`) 필드는 서버에서 관리자 역할(`VCESYS_CORE`, `VCESYS_MGMT`) 확인 후 반영. 프론트 파라미터 변조로는 공지 등록 불가.
- 댓글 좋아요 중복 방지: 서버에서 동일 사용자·댓글 조합 중복 삽입 차단.

---

## 4. SSRF / File Inclusion

| 항목 | 내용 |
|------|------|
| 해당 여부 | **해당 사항 없음** |

외부 URL을 백엔드가 직접 fetch·include하는 기능 없음. "첨부 링크" 필드는 외부 URL을 클라이언트 브라우저가 여는 형태이며, 서버가 해당 URL로 요청을 보내지 않음. 파일 업로드는 로컬 디렉터리에 저장되며 외부 경로 참조 없음.

---

## 5. 검증되지 않은 리다이렉트 / 포워드

| 항목 | 내용 |
|------|------|
| 해당 여부 | **해당 있음 → 조치 적용 중** |

**기존 방식**
OAuth2 로그인 성공 핸들러(`OAuth2SuccessHandler`)에서 `redirect_uri` 쿠키 값으로 리다이렉트. 허용 Origin 목록을 `startsWith`로 비교.

**현재 조치**
- 허용된 Origin 목록(`CORS_ALLOWED_ORIGINS`)에 속하는 경우만 리다이렉트.
- 프론트 로그인 후 리다이렉트는 `navigate('/exchange')` 등 내부 경로만 사용.

---

## 6. 입력값 크기 및 무결성 검증 오류

| 항목 | 내용 |
|------|------|
| 해당 여부 | **해당 있음 → 조치 적용 중** |

**조치 내용 (백엔드 DTO 검증)**

| 필드 | 제약 |
|------|------|
| 게시글 제목 | `@Size(min=1, max=200)` |
| 게시글 본문 | `@Size(min=1, max=10000)` |
| 첨부 URL | `@Size(max=500)` + `@Pattern(https?:// 또는 /uploads/)` |
| 댓글 | `@Size(min=1, max=1000)` |
| 이메일 | `@Email` |
| 전화번호 | `@Pattern(^01[0-9]-?\\d{3,4}-?\\d{4}$)` |
| 계좌번호 | `@Pattern(^\\d+$)` |
| 추천인 코드 | `@Pattern(^[A-Za-z0-9]{8}$)` |

컨트롤러에 `@Validated` + `@Valid` 조합 적용으로 검증 실패 시 400 Bad Request 자동 반환.

---

## 7. 악성 코드 파일 업로드

| 항목 | 내용 |
|------|------|
| 해당 여부 | **해당 있음 → 조치 적용 중** |

**기존 방식 (취약)**
파일 확장자만 확인하는 방식은 확장자 변조(`.php.jpg`)로 우회 가능.

**조치 내용 (`FileService.java`)**

1. **확장자 화이트리스트**: `jpg`, `jpeg`, `png` 만 허용.
2. **Magic Byte 검증**: 파일 첫 바이트로 실제 포맷 확인.
   - JPEG: `0xFF 0xD8 0xFF`
   - PNG: `0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A`
3. **파일 크기 제한**: 최대 10MB.
4. **UUID 파일명**: 원본 파일명 대신 UUID로 저장, 디렉터리 트래버설 방지.
5. **업로드 디렉터리 분리**: `/app/uploads/` 하위 저장, 웹 루트와 분리.

---

## 8. 중요 정보 파일 다운로드

| 항목 | 내용 |
|------|------|
| 해당 여부 | **해당 있음 → 조치 적용 중** |

**조치 내용 (`FileController.java`)**

- 신분증 이미지(`/api/files/id-photos/**`): `@PreAuthorize("hasAnyRole('VCESYS_CORE','VCESYS_MGMT','VCESYS_EMP')")` — 관리자/직원만 접근 가능.
- 파일명 UUID 패턴 검증: `^[0-9a-fA-F\\-]{36}\\.(jpg|jpeg|png)$` 외 형식 거부.
- 경로 정규화 후 업로드 디렉터리 하위인지 재확인(Path Traversal 방지).

---

## 9. 패스워드 정책 유무 및 반영 여부

| 항목 | 내용 |
|------|------|
| 해당 여부 | **해당 있음 → 조치 적용 중** |

**조치 내용 (`SignupRequestDto.java`)**

- 비밀번호 형식: `@Pattern(regexp = "^(?=.*[A-Za-z])(?=.*\\d)(?=.*[!@#$%^&*]).{8,20}$")` — 영문·숫자·특수문자 포함 8~20자 강제.
- 저장 시 **BCrypt 해싱**(`PasswordEncoder`).

---

## 10. 인증 실패 횟수 제한

| 항목 | 내용 |
|------|------|
| 해당 여부 | **해당 있음 → 조치 적용 중** |

**조치 내용 (`AuthController.java`)**

- 사용자 로그인: **5회** 실패 시 계정 잠금(`LOCKED` 상태 전환), 이후 로그인 불가.
- 실패 횟수 DB 컬럼(`loginFailCount`) 관리, 로그인 성공 시 초기화.
- 잠금 메시지: "인증 실패 횟수(5회)를 초과하여 계정이 잠겼습니다."

---

## 11. 계정 정보 파악 가능성

| 항목 | 내용 |
|------|------|
| 해당 여부 | **해당 있음 → 조치 적용 중** |

**기존 방식 (취약)**
로그인 실패 시 이메일 존재 여부를 구분하는 다른 메시지 반환 가능성 존재.

**조치 내용**
- 로그인 실패 메시지를 "이메일 또는 비밀번호가 올바르지 않습니다."로 통일.
- 회원가입 시 중복 이메일 확인은 별도 `/api/auth/check-email` 엔드포인트로 처리(가입 과정 UX 필요에 따른 설계).
- 커뮤니티 게시글에서 관리자가 작성한 경우 작성자명을 "관리자"로 익명 표시(`CommunityService` 내 `resolveDisplayName`).

---

## 12. 관리자 페이지 분리 여부

| 항목 | 내용 |
|------|------|
| 해당 여부 | **해당 사항 없음 (거래소 자체 관리 기능 없음)** |

거래소 프론트는 일반 사용자 전용. 관리자 기능은 완전히 분리된 별도 컨테이너(`admin-front`, 포트 45173)에서 운영. 거래소 URL 내 `/admin/**` 경로 없음.

---

## 13. 검색 엔진 정보 노출 가능성

| 항목 | 내용 |
|------|------|
| 해당 여부 | **해당 있음 → 조치 적용 중** |

**기존 방식**
Vite 개발 서버 모드(`npm run dev`)로 운영 — `robots.txt`가 동적으로만 처리됨.

**조치 내용**

1. **`vite.config.ts` robots.txt 플러그인** (`VITE_APP_MODE=exchange`):
   ```
   User-agent: *
   Disallow: /mypage
   Disallow: /exchange
   Disallow: /balances
   Disallow: /investments
   Disallow: /signup
   Disallow: /oauth
   ```
   개인 자산·거래 페이지를 검색 엔진 크롤링에서 제외.

2. **프로덕션 빌드 전환**: 기존 `npm run dev`(소스 노출) → `npm run build` + nginx 정적 서빙으로 변경. `http://localhost:15173/src/App.tsx` 등 소스 파일 직접 접근 차단.

---

## 14. 백업 파일 및 테스트 파일 존재 여부

| 항목 | 내용 |
|------|------|
| 해당 여부 | **해당 사항 없음** |

`.dockerignore`로 `build/`, `node_modules/`, `*.log`, `.env*` 등 불필요 파일 이미지 제외. nginx에서 `/usr/share/nginx/html` 빌드 산출물만 서빙.

---

## 15. 쿠키 및 웹 스토리지 조작 가능성

| 항목 | 내용 |
|------|------|
| 해당 여부 | **해당 있음 → 조치 완료** |

**기존 방식 (취약)**
Access Token을 `localStorage`에 저장 → JavaScript로 탈취 가능, XSS 발생 시 토큰 노출. Refresh Token도 localStorage에 저장.

**조치 내용**

1. **Access Token → `sessionStorage` 이전**: 탭 종료 시 자동 삭제, JavaScript 접근은 여전히 가능하나 탭 간 공유 불가.

2. **Refresh Token → HttpOnly 쿠키 전용**: 서버가 `Set-Cookie` 헤더로 설정, JavaScript 접근 불가.
   ```
   Set-Cookie: vce_refresh_token=...; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=604800
   ```

3. **JWT Access Token 쿠키에 HttpOnly + Secure 적용**:
   ```
   Set-Cookie: vce_token=...; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=1800
   ```

4. **레거시 마이그레이션**: 기존 localStorage 토큰을 sessionStorage로 이전 후 localStorage 삭제(`migrateLegacyStorage()`).

5. **Support.tsx 버그 수정**: 기존 `localStorage.getItem('accessToken')` → `sessionStorage.getItem('accessToken')` 변경(로그인 상태에서 "로그인 후 확인" 오류 발생 버그 수정).

---

## 16. 인증 값 안정성 설정 여부

| 항목 | 내용 |
|------|------|
| 해당 여부 | **해당 있음 → 조치 적용 중** |

**조치 내용**

- JWT 서명 알고리즘: **HS256** (HMAC-SHA256).
- Access Token 만료: **30분**, Refresh Token 만료: **7일**.
- **토큰 블랙리스트**: 로그아웃·회원탈퇴 시 `TokenBlacklistService`가 JTI를 DB에 기록, 이후 동일 토큰 재사용 차단.
- **단일 로그인 강제**: `ActiveSessionService`가 최근 발급 JTI를 추적, 새 로그인 시 기존 JTI 무효화.
- 쿠키: `HttpOnly`, `Secure`, `SameSite=Strict` 모두 적용.

---

## 17. 접근제어 우회 가능성 확인

| 항목 | 내용 |
|------|------|
| 해당 여부 | **해당 있음 → 조치 적용 중** |

**조치 내용**

- `SecurityConfig`에서 경로별 권한 명시:
  - `/api/admin/**` → `VCESYS_CORE`, `VCESYS_MGMT`, `VCESYS_EMP` 역할만 허용.
  - `/api/auth/**` 중 인증 불필요 경로 외 모두 인증 필수.
- PUT, DELETE 메서드는 커뮤니티 API에서 차단, PATCH·POST만 허용(변조된 HTTP 메서드 방어).
- 관리자 전용 엔드포인트에 `@PreAuthorize` 어노테이션으로 메서드 레벨 이중 검증.

---

## 18. 비인증 상태로 중요 페이지 접근 가능성

| 항목 | 내용 |
|------|------|
| 해당 여부 | **해당 있음 → 조치 적용 중** |

**기존 방식**
일부 페이지에서 토큰 없이도 API 호출이 가능한 경우 있음.

**조치 내용**

- 프론트엔드: `App.tsx`에서 마운트 시 `/api/auth/refresh`를 통해 세션 복원, 실패 시 토큰 제거.
- 마이페이지(`/mypage`), 거래(`/exchange`), 자산조회(`/balances`) 등 인증 필요 경로는 토큰 없으면 로그인 페이지로 리다이렉트.
- 백엔드: `JwtAuthenticationFilter`가 모든 요청에서 토큰 검증, 없거나 만료 시 401 반환.

---

## 19. 일반 계정 권한 상승 가능성

| 항목 | 내용 |
|------|------|
| 해당 여부 | **해당 있음 → 조치 적용 중** |

**조치 내용**

- JWT 내 `role` 클레임 서버 발급, 클라이언트 변경 불가(서명 검증).
- 게시글 공지 설정(`isNotice`) 시 서비스 레이어에서 `VCESYS_CORE`/`VCESYS_MGMT` 역할 재확인.
- 신분증 승인, 계정 잠금 해제, 자산 회수 등 관리자 기능은 `@PreAuthorize`로 일반 사용자 토큰으로 호출 불가.

---

## 20. 소스코드 내 주요 정보 노출 여부

| 항목 | 내용 |
|------|------|
| 해당 여부 | **해당 있음 → 조치 완료** |

**기존 방식 (취약)**
Vite 개발 서버로 운영 시 `http://localhost:15173/src/App.tsx` 등 소스 파일 직접 열람 가능.

**조치 내용**

- **프로덕션 빌드 (`npm run build`) + nginx 서빙**으로 전환: 빌드 산출물(`dist/`)만 서빙, 소스 파일 접근 불가.
- `VITE_*` 환경변수(API URL 등)는 빌드 시 번들에 인라인됨에 유의(민감 정보 포함 금지 정책 유지).
- `.env` 파일은 `.dockerignore`에 포함, Docker 이미지에 미포함.

---

## 21. 요청 및 응답 값 내 주요 정보 포함 여부 확인

| 항목 | 내용 |
|------|------|
| 해당 여부 | **해당 있음 → 조치 적용 중** |

**조치 내용**

- 비밀번호: 응답에 절대 미포함(`@JsonIgnore` 또는 DTO 미포함).
- 계좌번호: `/api/auth/me` 응답에 포함되나, 인증된 본인만 접근 가능.
- 신분증 이미지 경로: 관리자 역할만 접근 가능한 별도 엔드포인트로 분리.
- 커뮤니티 응답에서 관리자 작성자명 익명화("관리자"로 표시).

---

## 22. 오류 페이지를 통한 정보 노출 여부

| 항목 | 내용 |
|------|------|
| 해당 여부 | **해당 있음 → 조치 적용 중** |

**조치 내용 (`application.yml`)**

```yaml
server:
  error:
    include-message: never
    include-stacktrace: never
    include-exception: false
    include-binding-errors: never
```

스택 트레이스, 예외 클래스명, 바인딩 오류 상세 응답 비활성화. API 오류는 HTTP 상태코드 + 간결한 메시지만 반환.

---

## 23. 일괄적인 오류 처리 페이지 존재 여부

| 항목 | 내용 |
|------|------|
| 해당 여부 | **해당 있음 → 조치 적용 중** |

**조치 내용**

- 백엔드: `@ControllerAdvice` 글로벌 예외 핸들러로 일관된 JSON 오류 형식 반환.
- 프론트엔드: axios 인터셉터에서 401 응답 시 자동 세션 정리 및 로그인 페이지 이동.
- SPA 라우팅: nginx `try_files $uri $uri/ /index.html` 설정으로 404 발생 시 React 앱으로 fallback, 사용자에게 서버 오류 정보 미노출.

---

## 24. Client Request Method

| 항목 | 내용 |
|------|------|
| 해당 여부 | **해당 있음 → 조치 적용 중** |

**조치 내용 (`SecurityConfig.java`)**

```java
.requestMatchers(HttpMethod.PUT, "/api/community/**").denyAll()
.requestMatchers(HttpMethod.DELETE, "/api/community/**").denyAll()
```

불필요한 HTTP 메서드(PUT, DELETE) 차단. 허용 메서드: GET, POST, PATCH, OPTIONS. CORS 설정에서도 동일하게 제한.

---

## 25. 파일 목록화 가능성

| 항목 | 내용 |
|------|------|
| 해당 여부 | **해당 사항 없음** |

nginx에서 `autoindex off`(기본값) 적용. `/uploads/` 디렉터리 직접 접근 없음. 파일은 UUID 명칭으로 저장되어 예측 불가.

---

## 26. 서버 헤더 정보 노출

| 항목 | 내용 |
|------|------|
| 해당 여부 | **해당 있음 → 조치 적용 중** |

**조치 내용 (`SecurityConfig.java`)**

```java
http.headers(headers -> headers
    .frameOptions(frame -> frame.deny())                     // X-Frame-Options: DENY
    .contentTypeOptions(Customizer.withDefaults())           // X-Content-Type-Options: nosniff
    .httpStrictTransportSecurity(hsts -> ...)                // HSTS: max-age=31536000; includeSubDomains
    .referrerPolicy(rp -> rp.policy(STRICT_ORIGIN_WHEN_CROSS_ORIGIN))
    .permissionsPolicy(pp -> pp.policy("geolocation=(), microphone=(), camera=()"))
);
```

Spring Boot 기본 `Server: ` 헤더 노출 억제. nginx에서 `server_tokens off` 설정(기본 동작).

---

## 27. 취약한 보안 설정

| 항목 | 내용 |
|------|------|
| 해당 여부 | **해당 있음 → 조치 적용 중** |

**조치 내용**

- HSTS 적용으로 HTTP → HTTPS 강제.
- `SameSite=Strict` 쿠키 설정으로 CSRF 이중 방어.
- `X-Frame-Options: DENY`로 클릭재킹 방지.
- 세션 정책: `STATELESS` (서버 측 세션 미생성).
- 비밀번호 BCrypt 해싱.
- CORS 허용 Origin 외부 환경변수로 관리, 하드코딩 없음.

---

## 28. 취약점 진단 항목에 정의되지 않은 취약점

### 소스코드 직접 접근 취약점 (Vite Dev Server 소스 노출)

| 항목 | 내용 |
|------|------|
| 해당 여부 | **해당 있음 → 조치 완료** |

**기존 방식**: Docker 컨테이너에서 `npm run dev` 실행 → Vite 개발 서버가 `/@fs/`, `/src/` 경로를 통해 소스 파일 직접 노출.
`http://localhost:15173/src/App.tsx` 접근 시 React 소스 코드 전체 열람 가능.

**조치 내용**: `Dockerfile`을 멀티스테이지 빌드로 전환.
- Build stage: `npm run build`로 번들 생성.
- Serve stage: nginx로 `dist/` 정적 파일만 서빙.
- 소스 파일 접근 경로 완전 차단.

---

*보고서 작성 기준: 현재 `secure-web` 브랜치 코드 기준*
