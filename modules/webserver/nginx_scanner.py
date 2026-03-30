"""
WebServer - Nginx 취약점 진단 모듈
주요 점검 영역: 버전 노출, 디렉토리 리스팅, SSL/TLS, 보안 헤더, 설정 파일 권한
"""
import os
import glob
from core.base_scanner import BaseScanner
from core.result import ScanReport, Severity

NGINX_CONF_PATHS = [
    "/etc/nginx/nginx.conf",
    "/usr/local/nginx/conf/nginx.conf",
    "/opt/nginx/conf/nginx.conf",
]


class NginxScanner(BaseScanner):
    CATEGORY = "WebServer-Nginx"

    def __init__(self, target: str = "localhost", verbose: bool = False,
                 conf_path: str = ""):
        super().__init__(target, verbose)
        self.conf_path = conf_path or self._find_conf()
        self.conf_content = self._load_all_conf()

    def _find_conf(self) -> str:
        for path in NGINX_CONF_PATHS:
            if os.path.exists(path):
                return path
        return ""

    def _load_all_conf(self) -> str:
        """nginx.conf + include된 .conf 파일을 하나의 문자열로 합침."""
        if not self.conf_path:
            return ""
        content = self._read_file(self.conf_path) or ""
        base_dir = os.path.dirname(self.conf_path)
        for line in content.splitlines():
            s = line.strip()
            if s.startswith("include"):
                pattern = s.split(None, 1)[1].rstrip(";").strip()
                if not os.path.isabs(pattern):
                    pattern = os.path.join(base_dir, pattern)
                for inc_file in glob.glob(pattern):
                    extra = self._read_file(inc_file) or ""
                    content += f"\n# === include: {inc_file} ===\n" + extra
        return content

    def run(self) -> ScanReport:
        print(f"\n[*] Nginx 취약점 진단 시작 → {self.target}")
        if not self.conf_path:
            print("  [!] nginx.conf 를 찾을 수 없습니다. conf_path 를 직접 지정하세요.")
        self._check_version_hidden()
        self._check_directory_listing()
        self._check_ssl_protocol()
        self._check_security_headers()
        self._check_conf_permission()
        self._check_access_log()
        self._check_client_body_size()
        self._check_timeout()
        self.report.finish()
        return self.report

    def _conf_has(self, keyword: str) -> bool:
        return keyword in self.conf_content

    def _conf_value(self, directive: str) -> str | None:
        """지시어의 값 반환 (첫 번째 매칭)."""
        for line in self.conf_content.splitlines():
            s = line.strip()
            if s.startswith(directive):
                parts = s.rstrip(";").split(None, 1)
                return parts[1] if len(parts) > 1 else None
        return None

    # ── 점검 항목 ──────────────────────────────────────────────────

    def _check_version_hidden(self):
        cid, name = "WS-N-01", "Nginx 버전 정보 노출 방지"
        desc = "server_tokens 설정으로 HTTP 응답 헤더의 버전 정보 노출 여부를 확인합니다."
        rec = "nginx.conf에 'server_tokens off;' 추가"

        if not self.conf_content:
            self.error(cid, name, Severity.MEDIUM, desc, "설정 파일 읽기 실패", rec)
            return
        val = self._conf_value("server_tokens")
        if val and val.lower() == "off":
            self.safe(cid, name, Severity.MEDIUM, desc, "server_tokens off 설정됨", rec)
        else:
            self.vulnerable(cid, name, Severity.MEDIUM, desc,
                            f"server_tokens = {val or '미설정 (기본값 on)'}", rec)

    def _check_directory_listing(self):
        cid, name = "WS-N-02", "디렉토리 리스팅 비활성화"
        desc = "autoindex on 설정이 있으면 디렉토리 내용이 노출될 수 있습니다."
        rec = "autoindex off; (기본값) 유지 또는 명시적으로 off 설정"

        if not self.conf_content:
            self.error(cid, name, Severity.HIGH, desc, "설정 파일 읽기 실패", rec)
            return
        val = self._conf_value("autoindex")
        if val and val.lower() == "on":
            self.vulnerable(cid, name, Severity.HIGH, desc,
                            "autoindex on 설정됨 (디렉토리 목록 노출)", rec)
        else:
            self.safe(cid, name, Severity.HIGH, desc,
                      f"autoindex = {val or 'off (기본값)'}", rec)

    def _check_ssl_protocol(self):
        cid, name = "WS-N-03", "취약한 SSL/TLS 프로토콜 사용 여부"
        desc = "SSLv2, SSLv3, TLSv1.0, TLSv1.1 등 취약한 버전 사용 여부를 확인합니다."
        rec = "ssl_protocols TLSv1.2 TLSv1.3; 만 허용"

        if not self.conf_content:
            self.error(cid, name, Severity.HIGH, desc, "설정 파일 읽기 실패", rec)
            return
        val = self._conf_value("ssl_protocols")
        if val is None:
            self.manual(cid, name, Severity.HIGH, desc,
                        "ssl_protocols 미설정 — SSL 미사용이거나 수동 확인 필요", rec)
            return
        bad = [p for p in ["SSLv2", "SSLv3", "TLSv1 ", "TLSv1.0", "TLSv1.1"] if p in val]
        if bad:
            self.vulnerable(cid, name, Severity.HIGH, desc,
                            f"취약 프로토콜 허용: {', '.join(bad)}", rec, val)
        else:
            self.safe(cid, name, Severity.HIGH, desc, f"ssl_protocols = {val}", rec)

    def _check_security_headers(self):
        cid, name = "WS-N-04", "보안 HTTP 응답 헤더 설정"
        desc = "X-Frame-Options, X-Content-Type-Options, Content-Security-Policy 등 보안 헤더를 확인합니다."
        rec = "add_header X-Frame-Options SAMEORIGIN; add_header X-Content-Type-Options nosniff; 등 추가"

        if not self.conf_content:
            self.error(cid, name, Severity.MEDIUM, desc, "설정 파일 읽기 실패", rec)
            return
        required = {
            "X-Frame-Options": "add_header X-Frame-Options",
            "X-Content-Type-Options": "add_header X-Content-Type-Options",
            "X-XSS-Protection": "add_header X-XSS-Protection",
        }
        missing = [h for h, directive in required.items() if directive not in self.conf_content]
        if missing:
            self.vulnerable(cid, name, Severity.MEDIUM, desc,
                            f"누락된 보안 헤더: {', '.join(missing)}", rec)
        else:
            self.safe(cid, name, Severity.MEDIUM, desc, "주요 보안 헤더 설정됨", rec)

    def _check_conf_permission(self):
        cid, name = "WS-N-05", "Nginx 설정 파일 권한"
        desc = "nginx.conf 파일의 소유자 및 권한이 적절한지 확인합니다."
        rec = "chown root:root /etc/nginx/nginx.conf && chmod 644 /etc/nginx/nginx.conf"

        if not self.conf_path:
            self.manual(cid, name, Severity.MEDIUM, desc, "설정 파일 경로 확인 불가", rec)
            return
        rc, out, _ = self._run_cmd(f"stat -c '%a %U' {self.conf_path}")
        if rc != 0:
            self.manual(cid, name, Severity.MEDIUM, desc, "stat 실패 — 수동 점검 필요", rec)
            return
        parts = out.split()
        perm, owner = parts[0], parts[1] if len(parts) > 1 else "?"
        issues = []
        try:
            if int(perm, 8) > 0o644:
                issues.append(f"권한 {perm} (644 초과)")
        except ValueError:
            pass
        if owner not in ("root", "nginx"):
            issues.append(f"소유자 {owner}")
        if issues:
            self.vulnerable(cid, name, Severity.MEDIUM, desc, " | ".join(issues), rec, out)
        else:
            self.safe(cid, name, Severity.MEDIUM, desc, f"권한 {perm}, 소유자 {owner}", rec)

    def _check_access_log(self):
        cid, name = "WS-N-06", "접근 로그(access_log) 설정"
        desc = "access_log가 off로 설정되어 있으면 침해 추적이 불가능합니다."
        rec = "access_log /var/log/nginx/access.log; 설정 확인"

        if not self.conf_content:
            self.error(cid, name, Severity.MEDIUM, desc, "설정 파일 읽기 실패", rec)
            return
        val = self._conf_value("access_log")
        if val and val.lower() == "off":
            self.vulnerable(cid, name, Severity.MEDIUM, desc, "access_log off 설정됨", rec)
        else:
            self.safe(cid, name, Severity.MEDIUM, desc,
                      f"access_log = {val or '기본값'}", rec)

    def _check_client_body_size(self):
        cid, name = "WS-N-07", "client_max_body_size 설정"
        desc = "업로드 크기 제한이 없으면 DoS 공격에 취약할 수 있습니다."
        rec = "client_max_body_size 10m; 등 적절한 크기로 제한"

        if not self.conf_content:
            self.error(cid, name, Severity.LOW, desc, "설정 파일 읽기 실패", rec)
            return
        val = self._conf_value("client_max_body_size")
        if val is None:
            self.vulnerable(cid, name, Severity.LOW, desc,
                            "client_max_body_size 미설정 (기본값 1m)", rec)
        else:
            self.safe(cid, name, Severity.LOW, desc, f"client_max_body_size = {val}", rec)

    def _check_timeout(self):
        cid, name = "WS-N-08", "keepalive_timeout 설정"
        desc = "keepalive_timeout이 과도하게 길면 연결 소진 공격에 취약합니다."
        rec = "keepalive_timeout 65; 이하로 설정"

        if not self.conf_content:
            self.error(cid, name, Severity.LOW, desc, "설정 파일 읽기 실패", rec)
            return
        val = self._conf_value("keepalive_timeout")
        if val is None:
            self.manual(cid, name, Severity.LOW, desc, "keepalive_timeout 미설정 — 기본값 75초", rec)
            return
        try:
            num = int(val.split()[0])
            if num > 120:
                self.vulnerable(cid, name, Severity.LOW, desc,
                                f"keepalive_timeout = {val} (120초 초과)", rec)
            else:
                self.safe(cid, name, Severity.LOW, desc, f"keepalive_timeout = {val}", rec)
        except ValueError:
            self.manual(cid, name, Severity.LOW, desc, f"keepalive_timeout 파싱 불가: {val}", rec)
