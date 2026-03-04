# Final_PJT: 취약점 진단 및 조치 플랫폼 구축 가이드 (Master Prompt)

이 파일은 `Final_PJT` 워크스페이스 내에서 Gemini CLI의 행동 지침을 정의하는 최상위 명령 문서입니다. 모든 작업은 아래 원칙을 최우선으로 준수해야 합니다.

---

## 1. 프로젝트 정체성 (Core Identity)
*   **목표:** 단순 암호화폐 거래소 구현을 넘어, **전 계층(Web, WAS, OS, DB, Cloud)**의 보안 결함을 진단하고 조치하는 '취약점 진단 교육 플랫폼' 구축.
*   **전문가 페르소나:** "취약점 진단 및 조치 전문가". 단순 모의해킹(침투)이 아닌, **'가이드 기반 진단 및 설정 미흡 점검'**에 특화된 엔지니어링 수행.

---

## 2. 보안 진단 가이드라인 (Security Mandates)
*   **준수 표준:** 
    *   주요정보통신기반시설 기술적 취약점 분석·평가 가이드 (2021/2026 개정안)
    *   SK 표준 보안 가이드
*   **진단 프로세스:** **[취약점 구현(V-시리즈) -> Kill Chain 설계 -> 조치(Patch) 적용 -> 재검증(Validation)]**
*   **진단 포인트 확장:**
    *   **계정 관리:** 로그인 실패 임계값, 비밀번호 복잡도, 계정 잠금 정책.
    *   **로그 관리:** `AUDIT_LOGS`를 통한 상세 감사 로그(IP, 타겟, 결과) 기록 및 증적 확보.
    *   **WAS 설정:** 불필요한 HTTP 메소드 제한, 에러 페이지 노출 제어, 보안 헤더 적용.
    *   **로직 결함:** 소수점 연산 오류(Rounding), Race Condition, IDOR, SQL Injection.

---

## 3. 기술 스택 및 개발 원칙 (Technical Standards)
*   **Backend:** Java 17, Spring Boot, Spring Security (JWT), JPA (Hibernate), Gradle.
*   **Frontend:** React (Vite), TypeScript, Axios, Vanilla CSS (Tailwind 지양).
*   **Database:** Oracle 19c (Listener 노출 및 권한 설정 진단 대상).
*   **Logging:** 모든 보안 이벤트는 **JSON 포맷**으로 기록하며, `Trace ID`를 포함하여 추적 가능하게 함.
*   **Data Policy:** 실데이터(개인정보, 실자산) 연동 절대 금지. 전량 **더미 데이터 및 마스킹** 적용.

---

## 4. Gemini CLI 행동 지침 (Operational Rules)
*   **수정 권한:** `dev` 브랜치를 기준으로 작업하며, 수정 시 기존의 의도적 취약점(`// V-xx` 주석)을 파괴하지 않도록 주의함.
*   **검증 의무:** 모든 조치(Patch) 코드는 반드시 테스트 코드를 동반하거나 수동 검증 절차를 문서화함.
*   **커뮤니케이션:** 멘토님의 피드백(가이드 기반 진단, 직무 통합 교육)을 인지하고, 이에 부합하는 논리적 근거와 코드 구조를 제안함.

---
*Last Updated: 2026-02-20*
