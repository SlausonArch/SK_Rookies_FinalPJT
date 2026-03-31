#!/opt/homebrew/bin/python3
"""
취약점 진단 자동화 스크립트
사용법: python main.py
"""
import sys
import os
import platform
import getpass

# 프로젝트 루트를 PYTHONPATH에 추가
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from core import reporter
from core.result import ScanReport

# ── ANSI 색상 ────────────────────────────────────────────────────────────────

def _color(text: str, code: str) -> str:
    if sys.stdout.isatty():
        return f"\033[{code}m{text}\033[0m"
    return text

RED    = lambda t: _color(t, "31")
GREEN  = lambda t: _color(t, "32")
YELLOW = lambda t: _color(t, "33")
CYAN   = lambda t: _color(t, "36")
BOLD   = lambda t: _color(t, "1")

# ── 메뉴 정의 ────────────────────────────────────────────────────────────────

MODULES = {
    "1": {
        "name": "OS - Linux",
        "desc": "계정/패스워드, 파일 권한, SSH, 서비스, 로그, 커널",
        "loader": lambda: __import__("modules.os.linux_scanner", fromlist=["LinuxScanner"]).LinuxScanner,
    },
    "2": {
        "name": "OS - Windows",
        "desc": "계정 정책, 레지스트리, 감사 정책, RDP, SMB",
        "loader": lambda: __import__("modules.os.windows_scanner", fromlist=["WindowsScanner"]).WindowsScanner,
    },
    "3": {
        "name": "WebServer - Nginx",
        "desc": "버전 노출, 디렉토리 리스팅, SSL/TLS, 보안 헤더, 설정 권한",
        "loader": lambda: __import__("modules.webserver.nginx_scanner", fromlist=["NginxScanner"]).NginxScanner,
    },
    "4": {
        "name": "WebServer - IIS",
        "desc": "디렉토리 브라우징, 버전 노출, HTTP 메서드, 로그, SSL",
        "loader": lambda: __import__("modules.webserver.iis_scanner", fromlist=["IISScanner"]).IISScanner,
    },
    "5": {
        "name": "DBMS (MySQL / PostgreSQL / MSSQL)",
        "desc": "포트 노출, 기본 계정, 원격 root, 감사 로그, 데이터 디렉토리",
        "loader": lambda: __import__("modules.dbms.dbms_scanner", fromlist=["DBMSScanner"]).DBMSScanner,
    },
    "6": {
        "name": "DBMS - Oracle (11g/12c/18c/19c/21c)",
        "desc": "계정/권한/보안설정/환경파일/감사 — 서버·Docker·AWS RDS 지원",
        "loader": lambda: __import__("modules.dbms.oracle_scanner", fromlist=["OracleScanner"]).OracleScanner,
    },
}

REPORT_FORMATS = {
    "1": ("Excel (.xlsx)", reporter.save_excel),
    "2": ("Markdown (.md)", reporter.save_markdown),
    "3": ("전체 (Excel + Markdown)", None),
}

CONNECTION_MODES = {
    "1": "로컬 (현재 시스템)",
    "2": "SSH (원격 서버 / EC2 Key Pair)",
    "3": "AWS SSM (EC2 Session Manager)",
}

# ── UI 헬퍼 ─────────────────────────────────────────────────────────────────

def _hr(char="─", width=60):
    print(char * width)

def _banner():
    print()
    _hr("═")
    print(BOLD(CYAN("  취약점 진단 자동화 스크립트")))
    print(f"  플랫폼: {platform.system()} {platform.release()}")
    _hr("═")
    print()

def _ask(prompt: str, default: str = "") -> str:
    try:
        val = input(f"  {prompt}" + (f" [{default}]" if default else "") + " : ").strip()
        return val or default
    except (KeyboardInterrupt, EOFError):
        print("\n\n종료합니다.")
        sys.exit(0)

def _ask_secret(prompt: str) -> str:
    """비밀번호·시크릿 키 입력 (화면에 표시 안 함)"""
    try:
        return getpass.getpass(f"  {prompt} : ")
    except (KeyboardInterrupt, EOFError):
        print("\n\n종료합니다.")
        sys.exit(0)

def _select_connection() -> str:
    print(BOLD("연결 방식 선택"))
    _hr()
    for key, label in CONNECTION_MODES.items():
        print(f"  {BOLD(key)}) {label}")
    print()
    while True:
        choice = _ask("번호 선택", "1")
        if choice in CONNECTION_MODES:
            return choice
        print(RED("  잘못된 선택입니다."))


def _build_executor(mode: str):
    """연결 방식에 따라 SSH/SSM executor 또는 None(로컬) 반환"""
    if mode == "1":
        return None, "localhost"

    if mode == "2":
        # ── SSH ──────────────────────────────────────
        print()
        print(BOLD("SSH 연결 정보 입력"))
        _hr()
        host     = _ask("호스트 / IP")
        port     = int(_ask("포트", "22"))
        username = _ask("사용자명", "ec2-user")
        print()
        print("  인증 방식: 1) PEM 키 파일  2) 패스워드")
        auth = _ask("번호 선택", "1")
        key_path = password = None
        if auth == "1":
            key_path = _ask("PEM 키 파일 경로 (예: ~/.ssh/my-key.pem)")
            key_path = os.path.expanduser(key_path)
        else:
            password = _ask_secret("패스워드")

        print()
        print(f"  {CYAN('→')} {username}@{host}:{port} 연결 중...")
        try:
            from core.remote import SSHExecutor
            executor = SSHExecutor(host, port, username, key_path, password)
            print(f"  {GREEN('✓')} SSH 연결 성공")
            return executor, host
        except Exception as e:
            print(RED(f"  ✗ SSH 연결 실패: {e}"))
            sys.exit(1)

    if mode == "3":
        # ── AWS SSM ───────────────────────────────────
        print()
        print(BOLD("AWS SSM 연결 정보 입력"))
        _hr()
        instance_id = _ask("EC2 인스턴스 ID (예: i-0123456789abcdef0)")
        region      = _ask("AWS 리전", "ap-northeast-2")
        print()
        print("  자격증명: 1) IAM 액세스 키  2) IAM 역할 / 환경변수 / ~/.aws 자동 사용")
        cred_mode = _ask("번호 선택", "2")

        access_key = secret_key = session_token = None
        if cred_mode == "1":
            access_key    = _ask("Access Key ID")
            secret_key    = _ask_secret("Secret Access Key")
            use_token     = _ask("Session Token 사용? (y/n)", "n").lower()
            if use_token == "y":
                session_token = _ask_secret("Session Token")

        print()
        print("  대상 OS: 1) Linux  2) Windows")
        os_choice = _ask("번호 선택", "1")
        platform = "windows" if os_choice == "2" else "linux"
        ping_cmd = "echo OK" if platform == "linux" else "Write-Output OK"

        print()
        print(f"  {CYAN('→')} SSM 연결 확인 중 ({instance_id} / {region} / {platform})...")
        try:
            from core.remote import SSMExecutor
            executor = SSMExecutor(instance_id, region, access_key, secret_key,
                                   session_token, platform=platform)
            # 간단한 ping 명령으로 연결 확인
            rc, out, err = executor.run_shell(ping_cmd, timeout=30)
            if rc != 0 or "OK" not in out:
                raise RuntimeError(err or "응답 없음")
            print(f"  {GREEN('✓')} SSM 연결 성공")
            return executor, instance_id
        except Exception as e:
            print(RED(f"  ✗ SSM 연결 실패: {e}"))
            sys.exit(1)


def _select_module() -> dict:
    print(BOLD("진단 모듈 선택"))
    _hr()
    for key, mod in MODULES.items():
        print(f"  {BOLD(key)}) {mod['name']}")
        print(f"     └ {mod['desc']}")
    print()
    while True:
        choice = _ask("번호 선택")
        if choice in MODULES:
            return MODULES[choice]
        print(RED("  잘못된 선택입니다."))

def _select_report_format() -> list[tuple[str, callable]]:
    print()
    print(BOLD("리포트 형식 선택"))
    _hr()
    for key, (label, _) in REPORT_FORMATS.items():
        print(f"  {BOLD(key)}) {label}")
    print()
    while True:
        choice = _ask("번호 선택", "1")
        if choice == "3":
            return [(label, fn) for label, fn in REPORT_FORMATS.values() if fn]
        if choice in REPORT_FORMATS:
            label, fn = REPORT_FORMATS[choice]
            return [(label, fn)]
        print(RED("  잘못된 선택입니다."))

def _print_summary(report: ScanReport):
    s = report.summary
    print()
    _hr()
    print(BOLD("  진단 결과 요약"))
    _hr()
    print(f"  대상   : {report.target}")
    print(f"  유형   : {report.scan_type}")
    print(f"  시작   : {report.started_at}")
    print(f"  종료   : {report.finished_at}")
    print()
    review = s['manual'] + s['error']
    print(f"  전체   : {BOLD(str(s['total']))}개")
    print(f"  [취약] : {RED(str(s['vulnerable']))}개")
    print(f"  [양호] : {GREEN(str(s['safe']))}개")
    print(f"  [검토] : {YELLOW(str(review))}개   (수동확인 필요)")
    print(f"  [ N/A] : {str(s['skipped'])}개   (해당 없음)")
    print()
    sev = s['by_severity']
    print(f"  위험   : {RED(str(sev['위험']))}개")
    print(f"  높음   : {RED(str(sev['높음']))}개")
    print(f"  보통   : {YELLOW(str(sev['보통']))}개")
    print(f"  낮음   : {str(sev['낮음'])}개")
    _hr()

def _print_details(report: ScanReport):
    show = _ask("취약 항목 상세 출력? (y/n)", "y").lower()
    if show != "y":
        return
    vuln_items = [r for r in report.results if r.status.value == "취약"]

    if not vuln_items:
        print(GREEN("  취약 항목 없음"))
        return
    for r in vuln_items:
        print()
        print(f"  {RED('●')} [{r.check_id}] {BOLD(r.name)}")
        print(f"    위험도   : {r.severity.value}")
        print(f"    상세     : {r.details}")
        print(f"    조치방안 : {r.recommendation}")
        if r.evidence:
            evidence_lines = r.evidence.splitlines()[:5]
            print(f"    근거     : {evidence_lines[0]}")
            for line in evidence_lines[1:]:
                print(f"             {line}")

# ── 모듈별 추가 옵션 수집 ─────────────────────────────────────────────────

def _collect_options(mod_name: str, target: str) -> dict:
    opts = {"target": target, "verbose": True}

    if "Nginx" in mod_name:
        conf = _ask("nginx.conf 경로 (빈칸=자동 탐색)", "")
        if conf:
            opts["conf_path"] = conf

    elif "IIS" in mod_name:
        pass  # 추가 옵션 없음 (target 만 사용)

    elif "Oracle" in mod_name:
        print()
        print("  배포 유형: 1) 서버(Linux/Windows)  2) Docker  3) AWS RDS")
        dt = _ask("번호 선택", "1")
        opts["deploy_type"] = {"1": "server", "2": "docker", "3": "rds"}.get(dt, "server")
        opts["db_host"] = _ask("DB 호스트/IP", target)
        opts["db_port"] = int(_ask("포트", "1521"))
        opts["service_name"] = _ask("서비스명 또는 SID", "ORCL")
        opts["db_user"] = _ask("접속 계정", "system")
        opts["db_password"] = _ask_secret("DB 패스워드")

    elif "DBMS" in mod_name:
        print()
        print("  DB 종류: 1) MySQL  2) PostgreSQL  3) MSSQL")
        db_choice = _ask("번호 선택", "1")
        opts["db_type"] = {"1": "mysql", "2": "postgresql", "3": "mssql"}.get(db_choice, "mysql")
        default_port = {"mysql": "3306", "postgresql": "5432", "mssql": "1433"}[opts["db_type"]]
        opts["port"] = int(_ask("포트", default_port))
        opts["user"] = _ask("접속 계정 (빈칸=수동점검만)", "")
        if opts["user"]:
            opts["password"] = _ask("패스워드", "")

    return opts

# ── 스캐너 실행 ───────────────────────────────────────────────────────────

def _run_scan(mod: dict, opts: dict) -> ScanReport:
    import inspect
    ScannerClass = mod["loader"]()
    valid_params = set(inspect.signature(ScannerClass.__init__).parameters) - {"self"}
    scanner = ScannerClass(**{k: v for k, v in opts.items() if k in valid_params})
    return scanner.run()

# ── 메인 ─────────────────────────────────────────────────────────────────────

def main():
    _banner()

    # 1. 연결 방식 선택
    conn_mode = _select_connection()
    print()
    executor, target = _build_executor(conn_mode)
    if conn_mode == "1":
        target = _ask("진단 대상 호스트/IP (리포트 표시용)", "localhost")

    # 2. 모듈 선택
    print()
    mod = _select_module()
    print(f"\n  선택: {BOLD(mod['name'])}")

    # 3. 추가 옵션
    print()
    opts = _collect_options(mod["name"], target)
    if executor is not None:
        opts["executor"] = executor

    # 4. 리포트 형식
    formats = _select_report_format()

    # 5. 진단 실행
    print()
    _hr()
    conn_label = {
        "1": "로컬",
        "2": f"SSH → {target}",
        "3": f"SSM → {target}",
    }.get(conn_mode, target)
    print(BOLD(f"  [{mod['name']}] 진단 시작... ({conn_label})"))
    _hr()
    report = _run_scan(mod, opts)

    # 6. 요약 출력
    _print_summary(report)

    # 7. 상세 출력
    _print_details(report)

    # 8. 로그 자동 저장 (항상)
    log_path = reporter.save_log(report)
    print()
    print(f"  {GREEN('✓')} 로그 저장 (자동): {log_path}")

    # 9. 리포트 저장
    for label, save_fn in formats:
        path = save_fn(report)
        print(f"  {GREEN('✓')} {label} 리포트 저장: {path}")

    # 10. 원격 연결 종료
    if executor is not None:
        try:
            executor.close()
        except Exception:
            pass

    print()
    again = _ask("다른 항목을 진단하시겠습니까? (y/n)", "n").lower()
    if again == "y":
        main()
    else:
        print("\n  진단을 종료합니다.\n")


if __name__ == "__main__":
    main()
