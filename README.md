# VulnScanner — 취약점 진단 자동화 도구

SK Shieldus 보안 가이드라인 기반의 취약점 진단 자동화 스크립트입니다.
OS · WebServer · DBMS · Cloud(AWS) 진단을 GUI 또는 CLI로 실행할 수 있습니다.

---

## 요구사항

| 항목 | 버전 |
|------|------|
| Python | 3.10 이상 |
| pip 패키지 | 아래 설치 방법 참고 |
| OS | macOS · Linux · Windows |

---

## 설치

```bash
git clone <repo-url>
cd SK_Rookies_FinalPJT

pip install -r requirements.txt
```

`requirements.txt` 가 없다면 직접 설치:

```bash
pip install paramiko boto3 openpyxl
```

> **Oracle 진단** 시 두꺼운 모드(Thick Mode)가 필요합니다.
> macOS: `brew install instantclient-basic`
> Linux: Oracle Instant Client 설치 후 `/opt/oracle/instantclient` 경로에 위치

---

## 실행

### GUI 모드 (권장)

```bash
python3 gui.py
```

### CLI 모드 (터미널)

```bash
python3 main.py
```

---

## 진단 모듈

| 번호 | 모듈 | 점검 항목 |
|------|------|-----------|
| 1 | OS - Linux | 계정/패스워드, 파일 권한, SSH, 서비스, 로그, 커널 |
| 2 | OS - Windows | 계정 정책, 레지스트리, 감사 정책, RDP, SMB |
| 3 | WebServer - Nginx | 버전 노출, 디렉토리 리스팅, SSL/TLS, 보안 헤더 |
| 4 | WebServer - IIS | 디렉토리 브라우징, 버전 노출, HTTP 메서드, 로그 |
| 5 | DBMS (MySQL/PG/MSSQL) | 포트 노출, 기본 계정, 원격 root, 감사 로그 |
| 6 | Oracle 11g~21c | 계정/권한, 보안설정, 환경파일, 감사 (서버/Docker/RDS) |
| 7 | Cloud - AWS | IAM, 보안그룹, S3, RDS, CloudTrail, VPC, 백업 |

---

## 연결 방법

| 방법 | 설명 |
|------|------|
| 로컬 | 현재 시스템을 직접 진단 |
| SSH | PEM 키 또는 패스워드로 원격 서버 접속 |
| AWS SSM | EC2 Session Manager로 접속 (키 불필요) |
| Docker | 로컬 또는 원격 컨테이너 내부 진단 |

---

## AWS Cloud 진단 (모듈 7)

boto3가 로컬 AWS 자격증명을 자동으로 사용합니다.
별도 입력 없이 `~/.aws/credentials` 또는 환경변수가 적용됩니다.

### 필요 IAM 권한

진단 계정에 아래 중 하나를 부여하세요:

```bash
# 방법 1: AWS 관리형 정책 (권장)
aws iam attach-user-policy \
  --user-name <사용자명> \
  --policy-arn arn:aws:iam::aws:policy/SecurityAudit

# 방법 2: 그룹 경유
aws iam add-user-to-group --user-name <사용자명> --group-name <SecurityAudit이 있는 그룹>
```

### 자격증명 확인

```bash
aws sts get-caller-identity      # 현재 연결된 계정 확인
aws iam list-users               # IAM 권한 정상 여부 확인
```

---

## 리포트 출력

진단 완료 시 `reports/` 폴더에 자동 저장됩니다.

| 형식 | 파일 |
|------|------|
| 로그 (.txt) | 항상 자동 저장 |
| Excel (.xlsx) | 선택 시 저장 |
| Markdown (.md) | 선택 시 저장 |

---

## 디렉토리 구조

```
SK_Rookies_FinalPJT/
├── gui.py                  # GUI 진입점
├── main.py                 # CLI 진입점
├── core/
│   ├── base_scanner.py     # 스캐너 기반 클래스
│   ├── remote.py           # SSH / SSM / Docker 실행기
│   ├── result.py           # 결과 데이터 모델
│   └── reporter.py         # 리포트 생성
└── modules/
    ├── os/                 # Linux, Windows 스캐너
    ├── webserver/          # Nginx, IIS 스캐너
    ├── dbms/               # MySQL/PG/MSSQL, Oracle 스캐너
    └── cloud/              # AWS 스캐너
```

---

# 🚀 프로젝트 실행 가이드 (Quick Start)

본 프로젝트는 Docker를 기반으로 Oracle DB, Spring Boot, React 환경을 한 번에 구축합니다.

### 💻 OS별 실행 방법

#### **[Mac / Linux / Windows Git Bash]**
1. 프로젝트 루트에 `.env` 파일을 위치시킵니다.
2. 터미널에서 다음 명령어를 실행합니다:
   ```bash
   chmod +x run.sh
   ./run.sh
   ```

#### **[Windows PowerShell / CMD]**
1. 프로젝트 루트에 `.env` 파일을 위치시킵니다.
2. Docker Desktop이 실행 중인지 확인합니다.
3. 다음 명령어를 순서대로 실행합니다:
   ```powershell
   # 1. DB 컨테이너 실행
   docker-compose up -d
   
   # 2. 백엔드 서버 실행 (새 터미널)
   ./gradlew bootRun
   
   # 3. 프론트엔드 서버 실행 (새 터미널)
   cd frontend
   npm install  # (최초 1회)
   npm run dev
   ```

### 🔑 주요 접속 정보
- **Frontend**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:8080](http://localhost:8080)
- **Admin 계정**: `admin@vce.com` / `admin123`

---

# 클라우드 구축을 통한 취약점진단 및 모의해킹 프로젝트

클라우드 내 주요 정보시스템에 대한 보안 아키텍처 수립 및 취약점 진단, 모의해킹 컨설팅을 수행하는 프로젝트입니다.

## 1. 프로젝트 개요

- 프로젝트명: 클라우드 구축을 통한 취약점진단 (SK표준, 기반시설, 금취분평) 및 모의해킹
- 핵심 키워드: #취약점진단 #모의해킹 #클라우드보안
- 목표: 클라우드 내 주요 정보시스템(OS, WEB/WAS, DBMS 등) 환경 분석을 통한 취약점 진단 및 조치 방안 제시, 외부 위협 사전 대응을 위한 모의해킹 컨설팅 수행

## 2. 프로젝트 주요 과제

### 2.1. 취약점진단 항목의 이해

- Infra: OS, WEB, WAS, DBMS 점검 항목
- WEB/API: 웹 및 API 보안 점검 항목
- Cloud: 클라우드 서비스 점검 항목
- 기준 비교: SK표준가이드, 기반시설, 금취분평 항목 비교 분석

### 2.2. 취약점진단 수행 및 조치

- 진단 수행: 시스템별 점검 항목 기준 취약점 점검 및 가이드 항목 매핑
- 결과보고서 작성: 검증 완료된 취약 항목별 개별 보고서 작성
- 취약점 조치: 환경설정, 시큐어코딩, 인터뷰 등을 통한 조치 이행
- 이행점검: 조치 결과에 대한 최종 확인 및 이행점검 수행

## 3. 차수별 세부 계획 (멘토링 일정)

| 차수 | 주요 목표 | 상세 과제 내용 | 주요 산출물 |
| :--- | :--- | :--- | :--- |
| 1차 | 프로젝트 목표 수립 및 항목 이해 | 멘토 OT, 수행 계획서 작성 방법, Infra/WEB/API/Cloud 진단 항목 교육 | 수행 계획서, 전체 WBS |
| 2차 | 수행 계획서 작성 및 기준 비교 | 시스템별 계획서 및 결과보고서 작성 교육, WBS 수정, 진단 가이드별 차이점 설명, 포트폴리오 작성법 | 수행 계획서, WBS 수정본 |
| 3차 | 조치 방법 이해 및 이행점검 준비 | 결과 보고서 1차 검토/수정, 취약점 조치 수행, 이행점검 보고서 작성법, 최종 발표 가이드 | 진단 결과 보고서, WBS 수정본 |
| 4차 | 보고서 고도화 및 이행점검 수행 | 결과 보고서 2차 검토/수정, 취약점 조치, 이행점검 보고서 및 최종 발표자료 1차 검토 | 진단 결과 보고서, 이행점검 보고서, 최종 발표 PPT |
| 5차 | 최종 결과보고 및 마무리 | 최종 이행점검 결과보고서 작성 및 2차 검토, 최종 발표자료 검토, 포트폴리오/면접 요령 | 이행점검 보고서, 최종 발표 PPT |

## 4. 프로젝트 산출물

- 수행 계획서: 취약점진단 수행 계획서 (Infra, WEB/API, Cloud)
- 진단 결과 보고서: 각 시스템별 결과 보고서
- 이행점검 보고서: 각 시스템별 이행점검 결과 보고서
- 최종 결과물: 전체 WBS, 최종 결과보고서 (Review PPT)

## 5. 핵심 활용 기술 및 요구사항

### 핵심 기술
- 진단 프로세스 및 방법론 이해
- 취약점별 상세 조치 방법
- IT/보안 기본 지식 및 문서 작성 기술

### 선도기업 요구사항
- 보안, 클라우드 기술, 컨설팅 능력을 갖춘 기본기 있는 인력
- 시스템 구조 이해 및 프로그램 소스코드 분석 가능 인력

## 팀원
- 김동현
- 김하늘
- 김한수
- 김현진
- 박지빈 (팀장)
- 박찬웅
- 신동원
- 우혜미
- 전소원
