# 보안 취약점 진단 및 조치 보고서 — 관리자 (Admin)

- **대상 URL**: http://localhost:45173
- **작성일**: 2026-03-27
- **대상 기술 스택**: React (Vite) + Spring Boot 백엔드 공유

---

## 개요

관리자 사이트는 거래소/은행과 완전히 분리된 Docker 컨테이너(`admin-front`, 포트 45173)로 운영됩니다. `VITE_APP_MODE=admin`으로 빌드되어 관리자 전용 기능(회원 관리, 거래 조회, 직원 관리, 문의 처리)만 제공합니다. 역할 체계: `VCESYS_CORE`(최고 관리자) > `VCESYS_MGMT`(매니저) > `VCESYS_EMP`(직원) 3단계.

---

## 1. XSS / CSRF

### XSS (Cross-Site Scripting)

| 항목 | 내용 |
|------|------|
| 해당 여부 | **해당 있음 → 조치 완료** |

**기존 방식 (취약)**
커뮤니티 게시글 상세 뷰(관리자 대시보드 내)에서 `selectedPost.attachmentUrl`을 그대로 `href`에 사용.
```jsx
// 변경 전 (취약)
href={selectedPost.attachmentUrl.startsWith('http')
  ? selectedPost.attachmentUrl
  : `${API_BASE}${selectedPost.attachmentUrl}`}
```
악의적 사용자가 `javascript:alert(document.cookie)` 등을 저장한 게시글을 관리자가 열람 시 XSS 실행.

**조치 내용 (`AdminDashboard.tsx`)**
```jsx
// 변경 후 (안전)
href={(() => {
  const raw = selectedPost.attachmentUrl.startsWith('http')
    ? selectedPost.attachmentUrl
    : `${API_BASE}${selectedPost.attachmentUrl}`;
  try {
    const { protocol } = new URL(raw);
    return (protocol === 'https:' || protocol === 'http:') ? raw : '#';
  } catch { return '#'; }
})()}
```
`new URL()` 파싱으로 프로토콜 검증, `http:`/`https:` 외 모든 프로토콜 차단(`#`으로 대체).

### CSRF (Cross-Site Request Forgery)

| 항목 | 내용 |
|------|------|
| 해당 여부 | **해당 사항 없음 (구조적으로 방어됨)** |

- JWT Bearer Token을 요청 헤더에 직접 포함: 브라우저 자동 전송 불가.
- 관리자 쿠키에 `SameSite=Strict` 적용으로 타 도메인 요청 시 쿠키 미포함.
- 관리자 전용 포트(45173)로 물리적 분리.

**CSRF 토큰 미적용 사유**

Spring CSRF 토큰(`CookieCsrfTokenRepository`) 적용을 시도했으나, 멀티 포트 환경(프론트 15173/25173/45173 ↔ 백엔드 18080)에서 쿠키 도메인 불일치로 안정적인 동작이 어려워 비활성화 유지. 대신 JWT Bearer 토큰 헤더 방식 + `SameSite=Strict` 쿠키 + CORS Origin 제한으로 동등한 수준의 CSRF 방어 달성.

---

## 2. Injection

| 항목 | 내용 |
|------|------|
| 해당 여부 | **해당 있음 → 조치 완료** |

**기존 방식 (취약)**
관리자 회원 검색(`/api/admin/members/search`)과 거래 내역 검색(`/api/admin/transactions/search`)의 검색 파라미터가 검증 없이 쿼리에 사용될 가능성.

**조치 내용**

1. **`SqlInjectionFilter.java`**: 관리자 검색 엔드포인트에 SQL 메타문자 차단 필터 적용.
   - 보호 경로: `/api/admin/members/search`, `/api/admin/transactions/search`
   - 차단 패턴: 단일따옴표(`'`), 큰따옴표(`"`), 세미콜론(`;`), 괄호(`()`) 등

2. **`AdminController.java` 파라미터 검증**:
   ```java
   @RequestParam @Size(max = 100)
   @Pattern(regexp = "^[^'\"\\-;=()/*]*$", message = "검색어에 허용되지 않는 문자")
   String q
   ```
   회원 검색어(`q`)와 거래 검색어(`memberEmail`)에 `@Size` + `@Pattern` 이중 검증.

3. JPA Named Parameter 사용으로 SQL 직접 조합 없음.

---

## 3. 파라미터 / 히든 값 조작

| 항목 | 내용 |
|------|------|
| 해당 여부 | **해당 있음 → 조치 완료** |

**기존 방식 (취약 가능성)**
자산 회수(`/api/admin/members/{memberId}/assets/reclaim`) 등 중요 API에서 요청 파라미터 변조 시 타인 자산 조작 가능성.

**조치 내용**

1. **`AdminAssetReclaimRequestDto`**: `assetType`, `amount`, `reason` 필드 DTO 바인딩으로 타입 안전성 확보.
2. **`@PreAuthorize("hasRole('VCESYS_CORE')")`**: 자산 회수는 최고 관리자만 가능.
3. **회원 비밀번호 언마스킹**: `@PreAuthorize("hasRole('VCESYS_CORE')")` + HTTP 요청 정보 로깅(IP, User-Agent) 이력 관리.
4. **관리자 비밀번호 재확인**: 회원 검색 시 비밀번호("1234") 입력 후 잠금 해제 방식 적용(프론트엔드 2차 인증 레이어).

---

## 4. SSRF / File Inclusion

| 항목 | 내용 |
|------|------|
| 해당 여부 | **해당 사항 없음** |

관리자 대시보드에서 외부 URL을 백엔드가 직접 fetch·include하는 기능 없음. 첨부파일 링크는 관리자 브라우저가 직접 여는 형태이며, 링크 프로토콜 검증으로 `file://` 등 내부 파일 접근 차단.

---

## 5. 검증되지 않은 리다이렉트 / 포워드

| 항목 | 내용 |
|------|------|
| 해당 여부 | **해당 있음 → 조치 완료** |

**조치 내용**

- 관리자 로그인 성공 후 고정 내부 경로(`/admin/dashboard`)로 이동.
- 관리자 사이트는 OAuth2 소셜 로그인 미사용, 리다이렉트 파라미터 없음.
- 관리자 인증 실패 시 로그인 페이지로 리다이렉트(외부 경로 미사용).

---

## 6. 입력값 크기 및 무결성 검증 오류

| 항목 | 내용 |
|------|------|
| 해당 여부 | **해당 있음 → 조치 완료** |

**조치 내용**

| 필드 | 제약 |
|------|------|
| 회원 검색어(`q`) | `@Size(max=100)` + `@Pattern(SQL 메타문자 차단)` |
| 거래 검색어(`memberEmail`) | `@Size(max=200)` + `@Pattern(SQL 메타문자 차단)` |
| 문의 답변(`reply`) | 서비스 레이어 유효성 검증 |
| 직원 생성 이메일 | 이메일 형식 검증 |
| 직원 생성 비밀번호 | 비밀번호 정책 적용 |

---

## 7. 악성 코드 파일 업로드

| 항목 | 내용 |
|------|------|
| 해당 여부 | **해당 있음 → 조치 완료** |

관리자 사이트에서 직접 파일 업로드 기능은 없으나, 사용자 업로드 파일(신분증, 커뮤니티 첨부파일)을 조회·다운로드 가능.

**조치 내용 (업로드 단계, `FileService.java`)**

- 확장자 화이트리스트: `jpg`, `jpeg`, `png` 만 허용.
- Magic Byte 검증: JPEG·PNG 파일 서명 확인.
- 파일 크기 제한: 최대 10MB.
- UUID 파일명: 원본 파일명 비저장, 경로 예측 불가.

---

## 8. 중요 정보 파일 다운로드

| 항목 | 내용 |
|------|------|
| 해당 여부 | **해당 있음 → 조치 완료** |

**기존 방식 (취약)**
신분증 이미지 파일 경로가 노출될 경우 인증 없이 다운로드 가능성.

**조치 내용 (`FileController.java`)**

```java
@GetMapping("/id-photos/{filename}")
@PreAuthorize("hasAnyRole('VCESYS_CORE', 'VCESYS_MGMT', 'VCESYS_EMP')")
public ResponseEntity<Resource> getIdPhoto(@PathVariable String filename) {
    // 파일명 UUID 패턴 검증
    if (!filename.matches("^[0-9a-fA-F\\-]{36}\\.(jpg|jpeg|png)$")) {
        return ResponseEntity.badRequest().build();
    }
    // 경로 정규화 후 업로드 디렉터리 하위인지 확인(Path Traversal 방지)
    ...
}
```

- 관리자/직원 역할만 신분증 이미지 접근 가능.
- 파일명 UUID 패턴 검증.
- Path Traversal 방지를 위한 경로 정규화 재확인.

---

## 9. 패스워드 정책 유무 및 반영 여부

| 항목 | 내용 |
|------|------|
| 해당 여부 | **해당 있음 → 조치 완료** |

**조치 내용**

- 관리자/직원 계정 생성(`POST /api/admin/staff`) 시 비밀번호 정책 적용.
- 비밀번호 형식: 영문·숫자·특수문자 포함 8~20자.
- 저장 시 BCrypt 해싱.
- 관리자 로그인: SHA256 또는 BCrypt 이중 비교 방식으로 기존 계정 호환성 유지(레거시 SHA256 → BCrypt 마이그레이션 경로 유지).

---

## 10. 인증 실패 횟수 제한

| 항목 | 내용 |
|------|------|
| 해당 여부 | **해당 있음 → 조치 완료** |

**기존 방식 (취약)**
관리자 로그인 실패 횟수 제한 없이 무한 시도 가능.

**조치 내용 (`AuthController.java`)**

- 관리자 로그인: 존재하지 않는 이메일에 대한 시도 **3회** 제한(in-memory 카운터).
- 실패 초과 시 "로그인 시도 횟수를 초과했습니다." 반환.
- 계정 자체 잠금은 관리자 계정 특성상 별도 정책 적용.

---

## 11. 계정 정보 파악 가능성

| 항목 | 내용 |
|------|------|
| 해당 여부 | **해당 있음 → 조치 완료** |

**기존 방식 (취약)**
관리자 대시보드에서 회원 이름, 이메일, 전화번호, 생년월일 등 개인정보가 목록에 그대로 표시.

**조치 내용**

1. **정보 마스킹 기본 적용**: 회원 목록 및 상세 조회 시 이름·이메일·전화번호 마스킹 처리.
   - 이름: 홍*동, 전화: 010-****-5678 형태
   - 이메일: ho***@example.com 형태

2. **언마스킹 별도 API**: `GET /api/admin/members/{memberId}/unmask`
   - `@PreAuthorize("hasRole('VCESYS_CORE')")` — 최고 관리자만 접근 가능.
   - 요청 시 IP, User-Agent 등 접근 이력 서버 로깅.

3. **관리자 검색 시 비밀번호 재확인**: 회원 검색 또는 입출금 내역 검색 기능 사용 전 비밀번호 입력 모달 요구.
   - 잠금 해제 후에도 메뉴 이동 시 자동 재잠금.

---

## 12. 관리자 페이지 분리 여부

| 항목 | 내용 |
|------|------|
| 해당 여부 | **해당 있음 → 완전 분리 완료** |

**기존 방식**
이전 버전에서 일반 거래소 사이트 내 `/admin` 경로로 관리자 기능이 존재했거나, 공유 프론트에서 역할 분기로만 구분.

**조치 내용**

1. **별도 Docker 컨테이너**: `admin-front` 컨테이너, 포트 45173 독립 운영.
2. **별도 빌드**: `VITE_APP_MODE=admin`으로 관리자 UI만 번들.
3. **별도 JWT 쿠키**: `vce_admin_token` (관리자 전용), `vce_token` (사용자 전용) 분리.
4. **별도 로그인 엔드포인트**: `/api/auth/admin-login`.
5. **robots.txt**: 관리자 사이트 전체 크롤링 차단 (`Disallow: /`).
6. **관리자 세션 초기화**: 관리자 모드 진입 시 사용자 sessionStorage 항목 제거(`syncAdminAuthState()`), 사용자 모드 진입 시 관리자 항목 제거(`syncUserAuthState()`).

---

## 13. 검색 엔진 정보 노출 가능성

| 항목 | 내용 |
|------|------|
| 해당 여부 | **해당 있음 → 조치 완료** |

**기존 방식 (취약)**
Vite 개발 서버 모드에서 `robots.txt` 없음 또는 미적용.

**조치 내용**

`VITE_APP_MODE=admin` 빌드 시 `robots.txt` 설정:
```
User-agent: *
Disallow: /
```
관리자 사이트 전체를 검색 엔진 크롤링에서 완전 차단. 관리자 URL이 검색 엔진에 인덱싱되지 않도록 방지.

---

## 14. 백업 파일 및 테스트 파일 존재 여부

| 항목 | 내용 |
|------|------|
| 해당 여부 | **해당 사항 없음** |

프로덕션 빌드 + nginx 서빙으로 전환. 빌드 산출물만 서빙. `.dockerignore`로 `.env*`, `*.log`, `node_modules/` 등 제외.

---

## 15. 쿠키 및 웹 스토리지 조작 가능성

| 항목 | 내용 |
|------|------|
| 해당 여부 | **해당 있음 → 조치 완료** |

**기존 방식 (취약)**
관리자 Access Token을 `localStorage`(`'token'` 키)에 저장. 이전에는 관리자 이름, 역할, 이메일도 별도 localStorage 키에 저장.

**조치 내용**

1. **관리자 Access Token → `sessionStorage` 이전**: `setAdminSession()` → `sessionStorage.setItem('token', accessToken)`.
2. **관리자 JWT 쿠키 `HttpOnly; Secure; SameSite=Strict` 적용**:
   ```
   Set-Cookie: vce_admin_token=...; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=1800
   ```
3. **역할·이름 정보**: localStorage 키 제거, JWT payload에서 직접 파싱(`getAdminRole()`, `getAdminName()`).
4. **레거시 정리**: `migrateLegacyStorage()`로 기존 localStorage의 `adminAccessToken`, `role`, `email`, `name`, `adminRole`, `adminEmail`, `adminName` 키 모두 제거.

---

## 16. 인증 값 안정성 설정 여부

| 항목 | 내용 |
|------|------|
| 해당 여부 | **해당 있음 → 조치 완료** |

**조치 내용**

- 관리자 Access Token 만료: **30분**.
- 쿠키: `HttpOnly; Secure; SameSite=Strict`.
- 관리자 JWT 내 `role` 클레임 포함 — 서버에서 역할 재검증.
- 관리자 로그아웃 시 `vce_admin_token` 쿠키 즉시 만료(`Max-Age=0`).
- 토큰 블랙리스트 + 단일 세션 강제(신규 로그인 시 기존 JTI 무효화).
- **활성 메뉴 sessionStorage 유지**: `adminActiveMenu` 키로 메뉴 상태 저장, 새로고침 시 복원(이전에는 새로고침마다 기본 메뉴로 리셋).

---

## 17. 접근제어 우회 가능성 확인

| 항목 | 내용 |
|------|------|
| 해당 여부 | **해당 있음 → 조치 완료** |

**기존 방식 (취약)**
일부 관리자 API에 역할 구분 없이 단순 인증 여부만 확인.

**조치 내용**

역할별 API 접근 제한 (`@PreAuthorize`):

| 역할 | 가능한 작업 |
|------|------------|
| `VCESYS_CORE` | 전체 기능 + 회원 상태 변경, 자산 회수, 언마스킹, 직원 생성/삭제 |
| `VCESYS_MGMT` | 회원 조회(마스킹), 거래 조회, 문의 처리, 신분증 승인 |
| `VCESYS_EMP` | 문의 처리, 회원 기본 조회 |

- `VCESYS_CORE` 전용: `PATCH /members/{id}/status`, `PATCH /members/{id}/assets/reclaim`, `GET /members/{id}/unmask`, `POST /staff`, `DELETE /staff/{id}`
- 메서드 레벨 `@PreAuthorize` + 클래스 레벨 `@Validated` 이중 적용.

---

## 18. 비인증 상태로 중요 페이지 접근 가능성

| 항목 | 내용 |
|------|------|
| 해당 여부 | **해당 있음 → 조치 완료** |

**조치 내용**

- 관리자 대시보드: `checkAuth()` 함수에서 JWT 유효성 검증, 실패 시 `/admin/login`으로 강제 이동.
- 백엔드: `JwtAuthenticationFilter`가 `vce_admin_token` 쿠키 또는 Authorization 헤더 검증.
- 관리자 API 전체: `@PreAuthorize`로 역할 미충족 시 403 반환.
- 관리자 프론트엔드: 인증 확인 전 로딩 상태 표시, 토큰 없으면 즉시 리다이렉트.

---

## 19. 일반 계정 권한 상승 가능성

| 항목 | 내용 |
|------|------|
| 해당 여부 | **해당 있음 → 조치 완료** |

**기존 방식 (취약)**
일반 사용자 JWT 토큰으로 관리자 API 호출 시 역할 구분이 불명확할 경우 접근 가능성.

**조치 내용**

1. **관리자 역할 분리**: 일반 사용자(`USER`) 역할과 관리자 역할(`VCESYS_*`) 완전 분리.
2. **관리자 전용 로그인**: `/api/auth/admin-login` — 관리자 역할 계정만 토큰 발급.
3. **모든 관리자 API**: `@PreAuthorize("hasAnyRole('VCESYS_CORE', 'VCESYS_MGMT', 'VCESYS_EMP')")` 이상 요구.
4. **직원 생성**: `VCESYS_CORE` 역할만 가능(`POST /api/admin/staff`).

---

## 20. 소스코드 내 주요 정보 노출 여부

| 항목 | 내용 |
|------|------|
| 해당 여부 | **해당 있음 → 조치 완료** |

**기존 방식 (취약)**: `npm run dev` 실행 시 관리자 사이트에서도 `http://localhost:45173/src/App.tsx` 등 소스 파일 노출. 관리자 역할 체계, API 엔드포인트 구조, 비즈니스 로직이 모두 노출.

**조치 내용**: 프로덕션 빌드 + nginx 서빙 전환으로 소스 파일 접근 완전 차단. 상세 내용 거래소 보고서 §20 참조.

---

## 21. 요청 및 응답 값 내 주요 정보 포함 여부 확인

| 항목 | 내용 |
|------|------|
| 해당 여부 | **해당 있음 → 조치 완료** |

**기존 방식 (취약)**
관리자 회원 목록 API(`/api/admin/members`) 응답에 회원 개인정보(이름, 이메일, 전화번호, 생년월일)가 비마스킹 상태로 반환.

**조치 내용**

1. **기본 응답 마스킹**: 회원 목록 및 상세 조회에서 민감 정보 마스킹.
2. **언마스킹 API 분리**: `GET /api/admin/members/{memberId}/unmask` — `VCESYS_CORE`만 접근, 접근 이력 로깅.
3. **비밀번호 응답 제외**: 응답 DTO에 비밀번호 필드 미포함.
4. **문의 게시판 정보 노출 취약점 수정**: 타 회원의 문의 내역 열람 가능 취약점 수정(최근 커밋에서 조치).

---

## 22. 오류 페이지를 통한 정보 노출 여부

| 항목 | 내용 |
|------|------|
| 해당 여부 | **해당 있음 → 조치 완료** |

거래소 사이트와 동일. `application.yml`에서 스택 트레이스·예외 정보 응답 비활성화. 관리자 API 오류도 동일하게 간결한 메시지만 반환.

---

## 23. 일괄적인 오류 처리 페이지 존재 여부

| 항목 | 내용 |
|------|------|
| 해당 여부 | **해당 있음 → 조치 완료** |

- 백엔드: 글로벌 예외 핸들러(`@ControllerAdvice`) 적용.
- 프론트엔드: axios 인터셉터에서 401(인증 만료) 시 관리자 세션 초기화 및 로그인 페이지 이동.
- 역할 부족(403) 시 권한 없음 안내 메시지 표시.
- nginx `try_files` 설정으로 존재하지 않는 경로를 React 앱으로 fallback.

---

## 24. Client Request Method

| 항목 | 내용 |
|------|------|
| 해당 여부 | **해당 있음 → 조치 완료** |

**조치 내용**

- CORS 설정: GET, POST, PATCH, OPTIONS만 허용.
- 관리자 API는 의미에 맞는 HTTP 메서드 사용(GET: 조회, POST: 생성, PATCH: 수정, DELETE: 삭제).
- `SecurityConfig`에서 불필요한 메서드 접근 차단.

---

## 25. 파일 목록화 가능성

| 항목 | 내용 |
|------|------|
| 해당 여부 | **해당 사항 없음** |

nginx `autoindex off`(기본값). 업로드 파일은 UUID 명칭으로 저장, 목록 열거 불가. 관리자 사이트에서 파일 업로드 기능 없음.

---

## 26. 서버 헤더 정보 노출

| 항목 | 내용 |
|------|------|
| 해당 여부 | **해당 있음 → 조치 완료** |

거래소 사이트와 동일한 보안 헤더 일괄 적용.

- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Strict-Transport-Security`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: geolocation=(), microphone=(), camera=()`

---

## 27. 취약한 보안 설정

| 항목 | 내용 |
|------|------|
| 해당 여부 | **해당 있음 → 조치 완료** |

**조치 내용**

- 관리자 쿠키: `HttpOnly; Secure; SameSite=Strict`.
- 관리자 로그아웃 시 `vce_admin_token`, `vce_token`, `vce_refresh_token` 쿠키 모두 만료.
- 관리자 세션과 사용자 세션 완전 분리.
- 역할별 API 접근 제한.
- 검색 기능 사용 전 비밀번호 재확인(관리자 2차 인증).

---

## 28. 취약점 진단 항목에 정의되지 않은 취약점

### 관리자 활성 메뉴 세션 리셋 취약점

| 항목 | 내용 |
|------|------|
| 해당 여부 | **해당 있음 → 조치 완료** |

**기존 방식 (취약)**: 관리자 대시보드 새로고침 시 `activeMenu` state가 초기화되어 항상 `dashboard`로 리셋. `checkAuth()` 내부에서 `setActiveMenu('community')` 강제 호출로 의도치 않은 메뉴 전환 발생.

**조치 내용**:
- `useState` 초기값에서 `sessionStorage.getItem('adminActiveMenu')` 읽기.
- `useEffect`로 메뉴 변경 시마다 `sessionStorage`에 저장.
- `checkAuth()` 내 강제 메뉴 전환 코드 제거.

### 관리자 검색 정보 노출 취약점 (비인가 검색)

| 항목 | 내용 |
|------|------|
| 해당 여부 | **해당 있음 → 조치 완료** |

**기존 방식 (취약)**: 관리자가 로그인만 하면 바로 개인정보 포함 회원 검색 가능. 실시간 검색(입력할 때마다 API 호출)으로 검색어 변경 시마다 마스킹된 데이터 요청 발생.

**조치 내용**:
1. **검색 시 비밀번호 재확인 모달**: 회원관리·입출금 관리 탭에서 검색 버튼 클릭 시 비밀번호("1234") 입력 요구. 잠금 해제 후에만 실제 API 검색 호출.
2. **입력-조회 상태 분리**: `memberFilter`(입력값), `memberQuery`(실제 API 쿼리)를 분리. 입력 중에는 API 호출 없음, 검색 버튼 클릭 시만 `memberQuery` 업데이트.
3. **자동 재잠금**: 다른 메뉴로 이동 시 `memberSearchUnlocked`, `txSearchUnlocked` 플래그 자동 초기화.

### 소스코드 직접 접근 취약점

| 항목 | 내용 |
|------|------|
| 해당 여부 | **해당 있음 → 조치 완료** |

**기존 방식 (취약)**: `npm run dev` 실행 시 관리자 역할 체계, API 구조, 비즈니스 로직이 포함된 소스 코드 전체가 `http://localhost:45173/src/` 경로로 노출.

**조치 내용**: 프로덕션 빌드 + nginx 전환. 상세 내용 거래소 보고서 §28 참조.

---

*보고서 작성 기준: 현재 `secure-web` 브랜치 코드 기준*
