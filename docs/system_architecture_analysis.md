# 시스템 아키텍처 분석

## 1. 개요

본 문서는 현재 프로젝트 저장소 기준으로 시스템 아키텍처와 구성 요소의 종류/세부 버전을 정리한 문서다.

## 2. 논리 아키텍처

1. 사용자(브라우저)가 NAS Reverse Proxy 엔드포인트로 접속한다.
2. NAS Reverse Proxy가 프론트엔드 컨테이너로 요청을 전달한다.
3. 프론트엔드(React/Vite)가 백엔드 API(Spring Boot)로 요청한다.
4. 백엔드가 Oracle DB에 접근한다.
5. 업로드 파일은 백엔드 컨테이너의 `/app/uploads` 볼륨에 저장된다.

## 3. 컨테이너 구성

### 3.1 Oracle DB

- 서비스명: `oracle-db`
- 이미지: `gvenzl/oracle-free:23.4`
- 목적: 애플리케이션 데이터 저장
- 데이터 초기화: `schema.sql`, `init.sql` 마운트 실행
- 볼륨: `oracle-data:/opt/oracle/oradata`

참조: `docker-compose.yml`

### 3.2 Backend

- 서비스명: `backend`
- Build context: 프로젝트 루트
- 빌드 이미지: `gradle:8.5-jdk17`
- 런타임 이미지: `eclipse-temurin:17-jre-jammy`
- 런타임 포트(컨테이너): `8080`
- 주요 역할: 인증/인가, 비즈니스 로직, DB 연동, 파일 업로드 처리

참조: `docker-compose.yml`, `Dockerfile`

### 3.3 Frontend

- 서비스명: `frontend`
- Build context: `./frontend`
- 이미지 베이스: `node:20-alpine`
- 런타임 포트(컨테이너): `3000`
- 실행 명령: `npm run dev -- --host 0.0.0.0 --port 3000`
- 주요 역할: 사용자 UI 및 백엔드 API 호출

참조: `docker-compose.yml`, `frontend/Dockerfile`

## 4. 기술 스택 및 버전

### 4.1 Backend (Java/Spring)

- Java: `17`
- Spring Boot plugin: `3.4.2`
- Spring Dependency Management plugin: `1.1.7`
- Spring Boot Starters:
  - `spring-boot-starter-web`
  - `spring-boot-starter-security`
  - `spring-boot-starter-data-jpa`
  - `spring-boot-starter-oauth2-client`
  - `spring-boot-starter-validation`
  - `spring-boot-starter-actuator`
- JWT: `io.jsonwebtoken:jjwt-* 0.11.5`
- Lombok: `1.18.36`
- Oracle JDBC: `ojdbc11`

참조: `build.gradle`

### 4.2 Frontend (React/Vite)

- Node base image: `20-alpine`
- React: `^19.2.0`
- React DOM: `^19.2.0`
- React Router DOM: `^7.13.0`
- Vite: `^7.3.1`
- TypeScript: `~5.9.3`
- styled-components: `^6.3.9`
- axios: `^1.13.5`

참조: `frontend/Dockerfile`, `frontend/package.json`

### 4.3 Build Tool

- Gradle Wrapper distribution: `9.3.0`
- Docker backend build image의 Gradle: `8.5`

참조: `gradle/wrapper/gradle-wrapper.properties`, `Dockerfile`

## 5. 네트워크 및 포트

- Backend 포트 매핑: `${HOST_BACKEND_PORT:-18080}:8080`
- Frontend 포트 매핑: `${HOST_FRONTEND_PORT:-15173}:3000`
- 바인딩 IP: `${APP_BIND_IP:-0.0.0.0}`
- Oracle DB: 호스트 포트 미공개(내부 네트워크 통신 중심)

참조: `docker-compose.yml`

## 6. 주요 설정 특성

- DB 드라이버: `oracle.jdbc.OracleDriver`
- JPA DDL 정책: `ddl-auto: update`
- Hibernate Dialect: `org.hibernate.dialect.OracleDialect`
- OAuth2 연동: Kakao, Naver
- JWT secret: 환경변수 `JWT_SECRET`
- CORS: `CORS_ALLOWED_ORIGINS` 기반
- Forwarded header 처리: `server.forward-headers-strategy=framework`

참조: `src/main/resources/application.yml`

## 7. 운영 관점 메모

1. 현재 프론트는 Vite dev 서버 방식으로 컨테이너에서 구동된다.
2. 운영 시 NAS Reverse Proxy를 통해 외부 노출을 일원화하고, 원본 포트 접근은 방화벽으로 제한하는 구성이 권장된다.
3. Gradle 버전(Wrapper 9.3.0 vs Docker build 8.5) 불일치는 빌드 재현성 측면에서 정렬이 필요할 수 있다.

## 8. 기능별/흐름별 설명

### 8.1 인증/회원

- 로그인(일반 테스트 로그인):
  - `POST /api/auth/test/login`
  - 이메일/비밀번호 검증 후 JWT(access/refresh) 발급
- 관리자 로그인:
  - `POST /api/auth/admin/login`
  - ADMIN 권한 검증 후 토큰 발급
- 내 정보 조회/수정:
  - `GET /api/auth/me`, `PUT /api/auth/me`
  - 회원 기본 정보 + 거래량 기반 티어 정보 조회
- 회원가입 완료(추가정보 + 신분증):
  - `POST /api/auth/signup/complete` (multipart)
  - 파일 저장 후 멤버 상태/역할 전환
- 회원 탈퇴:
  - `POST /api/auth/withdraw`

### 8.2 자산(입출금/요약)

- 자산 목록/단건/요약:
  - `GET /api/assets`
  - `GET /api/assets/{assetType}`
  - `GET /api/assets/summary`
- 자산 입금/출금:
  - `POST /api/assets/deposit`
  - `POST /api/assets/withdraw`
  - 입출금 시 `Transaction` 이력 저장

### 8.3 주문/체결

- 주문 생성:
  - `POST /api/orders`
  - 시장가/지정가 분기 처리
  - 잔고 및 잠금 잔고 검증/갱신
- 주문 조회:
  - `GET /api/orders`, `GET /api/orders/open`
- 주문 취소:
  - `DELETE /api/orders/{orderId}`
  - 미체결 수량 기준 잠금 자산 반환
- 체결 보조:
  - `OrderService` 내부 로직 + 스케줄러에서 외부 시세 기준 체결 시도

### 8.4 지갑/내부이체

- 입금 주소 조회/생성:
  - `GET /api/wallets/{assetType}/address`
  - 없으면 가상 주소 생성
- 내부 지갑 이체:
  - `POST /api/wallets/transfer`
  - 송금자 잔고 차감, 수신자 잔고 및 평단가 반영, 거래내역 기록

### 8.5 거래내역

- 거래내역 조회:
  - `GET /api/transactions`
  - `assetType` 필터링 지원

### 8.6 시세/마켓

- 업비트 시세 중계 API:
  - `GET /api/market/all`
  - `GET /api/market/ticker`
  - `GET /api/market/candles/minutes/{unit}`
  - `GET /api/market/candles/days`
  - `GET /api/market/orderbook`
  - `GET /api/market/trades/ticks`
- 백엔드가 외부 시세 API를 받아 프론트에 전달

### 8.7 뉴스

- 최신 뉴스 조회:
  - `GET /api/news`
  - `NewsService`를 통해 목록 제공

### 8.8 커뮤니티

- 게시글:
  - `GET /api/community/posts`
  - `GET /api/community/posts/{postId}`
  - `POST /api/community/posts`
  - `PUT /api/community/posts/{postId}`
  - `DELETE /api/community/posts/{postId}`
- 댓글:
  - `GET /api/community/posts/{postId}/comments`
  - `POST /api/community/posts/{postId}/comments`
  - `DELETE /api/community/comments/{commentId}`
- 좋아요:
  - `POST /api/community/posts/{postId}/like`
- 첨부 업로드:
  - `POST /api/community/uploads` (multipart)

### 8.9 고객지원(FAQ/문의)

- FAQ 조회:
  - `GET /api/support/faqs`
- 내 문의 조회:
  - `GET /api/support/inquiries`
- 문의 등록:
  - `POST /api/support/inquiries` (multipart)

### 8.10 관리자 백오피스

- 회원 관리:
  - 목록/검색/상태 변경/신분증 승인
- 자산 관리:
  - 회원 자산 회수
- 모니터링:
  - 주문/자산/거래/통계 조회
- 문의 처리:
  - 문의 목록 조회, 답변 상태/내용 반영

## 9. 기능별 추천 참조 파일

### 9.1 인증/회원

- `src/main/java/com/rookies/sk/controller/AuthController.java`
- `src/main/java/com/rookies/sk/service/MemberService.java`
- `src/main/java/com/rookies/sk/security/JwtTokenProvider.java`
- `src/main/java/com/rookies/sk/security/JwtAuthenticationFilter.java`
- `src/main/java/com/rookies/sk/config/SecurityConfig.java`
- `src/main/resources/application.yml`

### 9.2 자산/거래

- `src/main/java/com/rookies/sk/controller/AssetController.java`
- `src/main/java/com/rookies/sk/controller/TransactionController.java`
- `src/main/java/com/rookies/sk/service/AssetService.java`
- `src/main/java/com/rookies/sk/service/TransactionService.java`
- `src/main/java/com/rookies/sk/repository/AssetRepository.java`
- `src/main/java/com/rookies/sk/repository/TransactionRepository.java`

### 9.3 주문/체결

- `src/main/java/com/rookies/sk/controller/OrderController.java`
- `src/main/java/com/rookies/sk/service/OrderService.java`
- `src/main/java/com/rookies/sk/scheduler/ExternalLimitOrderMatchScheduler.java`
- `src/main/java/com/rookies/sk/repository/OrderRepository.java`
- `src/main/java/com/rookies/sk/entity/Order.java`

### 9.4 지갑/내부이체

- `src/main/java/com/rookies/sk/controller/WalletController.java`
- `src/main/java/com/rookies/sk/service/WalletService.java`
- `src/main/java/com/rookies/sk/repository/WalletRepository.java`
- `src/main/java/com/rookies/sk/entity/Wallet.java`

### 9.5 시세/뉴스

- `src/main/java/com/rookies/sk/controller/MarketController.java`
- `src/main/java/com/rookies/sk/service/UpbitQuotationService.java`
- `src/main/java/com/rookies/sk/service/UpbitPriceService.java`
- `src/main/java/com/rookies/sk/controller/NewsController.java`
- `src/main/java/com/rookies/sk/service/NewsService.java`

### 9.6 커뮤니티/고객지원

- `src/main/java/com/rookies/sk/controller/CommunityController.java`
- `src/main/java/com/rookies/sk/service/CommunityService.java`
- `src/main/java/com/rookies/sk/controller/SupportController.java`
- `src/main/java/com/rookies/sk/service/SupportService.java`
- `src/main/java/com/rookies/sk/service/FileService.java`
- `src/main/java/com/rookies/sk/config/WebConfig.java`

### 9.7 관리자 기능

- `src/main/java/com/rookies/sk/controller/AdminController.java`
- `src/main/java/com/rookies/sk/service/AdminService.java`
- `src/main/java/com/rookies/sk/repository/MemberRepository.java`
- `src/main/java/com/rookies/sk/repository/InquiryRepository.java`

### 9.8 인프라/배포 설정

- `docker-compose.yml`
- `Dockerfile`
- `frontend/Dockerfile`
- `.env.example`
- `src/main/resources/application.yml`
- `build.gradle`

## 10. 프로젝트 설명 포인트 추천(기술/아키텍처 중심)

아래 항목은 기능 소개보다 기술 스택, 아키텍처, 네트워크, 운영 관점 중심으로 프로젝트를 설명할 때 사용할 수 있다.

1. 백엔드 언어/런타임은 Java 17 기반으로 통일되어 있다.
2. 백엔드는 Spring Boot 3.4.2 기반의 REST API 아키텍처다.
3. 프론트는 React 19 + TypeScript + Vite 7 조합이다.
4. 데이터베이스는 Oracle Free 23.4 컨테이너를 사용한다.
5. 전체 구조는 Frontend-Backend-DB의 3계층 분리 구조다.
6. 데이터 접근 계층은 Spring Data JPA 기반 Repository 패턴이다.
7. 컨테이너 오케스트레이션은 Docker Compose 단일 스택으로 구성된다.
8. DB/Backend/Frontend 컨테이너를 역할별로 분리해 장애 격리성이 있다.
9. 백엔드 이미지는 멀티스테이지 빌드(Gradle build + JRE runtime) 구조다.
10. 프론트 이미지는 Node 20-alpine 기반 경량 컨테이너다.
11. 애플리케이션 설정은 `.env` 기반 외부화 전략을 따른다.
12. 백엔드 포트/프론트 포트를 환경변수로 치환해 충돌 대응이 쉽다.
13. DB 포트를 외부에 직접 노출하지 않는 내부 네트워크 지향 구성이다.
14. Reverse Proxy(NAS) 앞단 배치를 고려한 헤더 처리 설정이 있다.
15. `server.forward-headers-strategy=framework` 설정으로 프록시 환경을 지원한다.
16. CORS 허용 도메인을 환경변수로 관리하도록 설계되어 있다.
17. 인증은 JWT 기반 무상태(Stateless) 세션 모델을 사용한다.
18. OAuth2 클라이언트 연동(Kakao/Naver)이 설정 기반으로 분리돼 있다.
19. 보안 필터 체인은 Spring Security + 커스텀 JWT 필터 조합이다.
20. 파일 업로드 경로는 `UPLOAD_DIR` 환경변수로 컨테이너/로컬 겸용 처리된다.
21. 업로드 및 DB 데이터는 Docker volume으로 영속화한다.
22. 빌드/실행 이미지 분리로 런타임 이미지 크기 및 공격면을 줄이는 구조다.
23. 백엔드는 JPA + Oracle Dialect를 명시해 DB 종속 동작을 제어한다.
24. 의존성 관리는 Gradle 기반이며 Spring BOM으로 버전 정합성을 맞춘다.
25. API 서버, 정적 프론트, DB를 서로 독립 배포 가능한 형태로 설계했다.
26. NAS Reverse Proxy로 외부 공개 지점을 단일화하기 쉬운 구조다.
27. 내부 원본 포트는 방화벽/NAS allowlist로 제한하기 좋은 구조다.
28. 운영/개발 환경을 `.env`만으로 분기할 수 있는 배포 유연성이 있다.
29. 컨테이너 기반이라 Windows/Linux 환경 간 실행 일관성이 높다.
30. 애플리케이션 로그와 인프라 로그를 계층별로 분리하기 쉬운 구조다.
31. 서비스 경계가 명확해 추후 마이크로서비스 분해도 가능한 형태다.
32. 프론트 빌드 산출물 기반(Nginx) 배포로 전환하기 쉬운 구성이다.
33. CI/CD를 붙일 때 Compose 기반 스테이징 자동화가 용이하다.
34. 네트워크 토폴로지를 단순화해 운영 복잡도를 낮춘 구조다.
35. 단일 호스트 배포에서도 책임 분리가 유지되는 현실적인 아키텍처다.
36. 버전 고정 이미지 태그 사용으로 재현 가능한 배포를 지향한다.
37. 운영 관점에서 포트, 도메인, CORS를 단계적으로 분리하기 쉽다.
38. 보안 관점에서 취약 서비스와 운영 서비스를 네트워크 레벨로 분리하기 좋다.
39. 소스 구조가 Controller-Service-Repository 계층으로 탐색성이 높다.
40. 학습용이면서도 실제 배포 아키텍처 토론이 가능한 구조적 완성도가 있다.
