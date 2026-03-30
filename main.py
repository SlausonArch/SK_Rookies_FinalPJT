#!/usr/bin/env python3
"""
취약점 진단 자동화 스크립트
사용법: python main.py
"""
import sys
import os
import platform

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
    # "6": Web/API — 추후 추가 예정
}

REPORT_FORMATS = {
    "1": ("JSON", reporter.save_json),
    "2": ("HTML", reporter.save_html),
    "3": ("CSV",  reporter.save_csv),
    "4": ("전체", None),
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
        choice = _ask("번호 선택", "2")
        if choice == "4":
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
    print(f"  전체   : {BOLD(str(s['total']))}개")
    print(f"  취약   : {RED(str(s['vulnerable']))}개")
    print(f"  양호   : {GREEN(str(s['safe']))}개")
    print(f"  수동   : {YELLOW(str(s['manual']))}개")
    print(f"  오류   : {str(s['error'])}개")
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
    ScannerClass = mod["loader"]()
    scanner = ScannerClass(**{k: v for k, v in opts.items()
                              if k in ScannerClass.__init__.__code__.co_varnames})
    return scanner.run()

# ── 메인 ─────────────────────────────────────────────────────────────────────

def main():
    _banner()

    # 1. 진단 대상
    target = _ask("진단 대상 호스트/IP", "localhost")

    # 2. 모듈 선택
    print()
    mod = _select_module()
    print(f"\n  선택: {BOLD(mod['name'])}")

    # 3. 추가 옵션
    print()
    opts = _collect_options(mod["name"], target)

    # 4. 리포트 형식
    formats = _select_report_format()

    # 5. 진단 실행
    print()
    _hr()
    print(BOLD(f"  [{mod['name']}] 진단 시작..."))
    _hr()
    report = _run_scan(mod, opts)

    # 6. 요약 출력
    _print_summary(report)

    # 7. 상세 출력
    _print_details(report)

    # 8. 리포트 저장
    print()
    saved = []
    for label, save_fn in formats:
        path = save_fn(report)
        saved.append((label, path))
        print(f"  {GREEN('✓')} {label} 리포트 저장: {path}")

    print()
    again = _ask("다른 항목을 진단하시겠습니까? (y/n)", "n").lower()
    if again == "y":
        main()
    else:
        print("\n  진단을 종료합니다.\n")


if __name__ == "__main__":
    main()
