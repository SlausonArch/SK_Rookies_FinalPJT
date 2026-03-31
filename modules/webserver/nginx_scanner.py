"""
WebServer - Nginx 취약점 진단 모듈
SK Shieldus 보안가이드라인 기반 (2022)

항목 구성
  1. 설정
     N-1.1  데몬 관리                   (중요도: 상)
     N-1.2  관리 서버 디렉터리 권한      (중요도: 중)
     N-1.3  설정 파일 권한              (중요도: 상)
     N-1.4  디렉터리 검색 기능 제거      (중요도: 중)
     N-1.5  로그 디렉터리/파일 권한      (중요도: 중)
     N-1.6  로그 포맷 설정              (중요도: 상)
     N-1.7  로그 저장 주기              (중요도: 상)
     N-1.8  헤더 정보 노출 방지          (중요도: 하)
     N-1.9  HTTP Method 제한           (중요도: 하)
     N-1.10 에러 메시지 관리            (중요도: 중)
  2. 솔루션 취약점
     N-2.1  기본 문서명 사용 제한        (중요도: 하)
     N-2.2  SSL v3.0 POODLE 취약점     (중요도: 상)
  3. 보안 패치
     N-3.1  보안 패치 적용              (중요도: 상)
"""
import os
import re
import glob
from core.base_scanner import BaseScanner
from core.result import ScanReport, Severity

# nginx.conf 자동 탐색 후보
NGINX_CONF_CANDIDATES = [
    "/etc/nginx/nginx.conf",
    "/usr/local/nginx/conf/nginx.conf",
    "/opt/nginx/conf/nginx.conf",
    "/usr/local/etc/nginx/nginx.conf",
    "/usr/share/nginx/conf/nginx.conf",
]

# spec 기준 버전별 권고 최소 버전 표 (2022)
_MIN_VER_TABLE: dict[tuple[int, int], tuple[int, int, int]] = {
    (1, 21): (1, 21, 5),  (1, 20): (1, 20, 2),  (1, 19): (1, 19, 10),
    (1, 18): (1, 18, 0),  (1, 17): (1, 17, 10), (1, 16): (1, 16, 1),
    (1, 15): (1, 15, 12), (1, 14): (1, 14, 2),  (1, 13): (1, 13, 12),
    (1, 12): (1, 12, 2),  (1, 11): (1, 11, 13), (1, 10): (1, 10, 3),
    (1, 9):  (1, 9,  10), (1, 8):  (1, 8,  1),  (1, 6):  (1, 6,  3),
    (1, 4):  (1, 4,  7),  (1, 2):  (1, 2,  9),  (1, 0):  (1, 0,  15),
    (0, 8):  (0, 8,  55), (0, 7):  (0, 7,  69), (0, 6):  (0, 6,  39),
    (0, 5):  (0, 5,  38),
}

# 전용 웹 서버 계정으로 인정되는 계정 목록
_WEB_USERS = frozenset({"nginx", "www-data", "daemon", "apache", "httpd",
                         "nobody", "web", "wwwrun"})


class NginxScanner(BaseScanner):
    CATEGORY = "WebServer-Nginx"

    def __init__(self, target: str = "localhost", verbose: bool = False,
                 conf_path: str = "", executor=None):
        super().__init__(target, verbose, executor)
        self.conf_path   = conf_path or self._find_conf()
        self.nginx_dir   = self._derive_nginx_dir()
        self.conf_content = self._load_all_conf()

    # ── 초기화 헬퍼 ───────────────────────────────────────────────

    def _find_conf(self) -> str:
        """nginx.conf 경로를 자동 탐색 (로컬/원격 모두 지원)"""
        for path in NGINX_CONF_CANDIDATES:
            if self.executor:
                _, out, _ = self._run_shell(f"test -f {path} && echo YES")
                if "YES" in out:
                    return path
            else:
                if os.path.exists(path):
                    return path
        # nginx -t 출력에서 파싱
        _, out, _ = self._run_shell("nginx -t 2>&1")
        m = re.search(r"configuration file\s+(\S+)\s+test", out)
        if m:
            return m.group(1)
        return ""

    def _derive_nginx_dir(self) -> str:
        """conf_path로부터 nginx 설치 디렉터리 추정"""
        if not self.conf_path:
            return ""
        conf_dir = os.path.dirname(self.conf_path)
        # /usr/local/nginx/conf/nginx.conf → /usr/local/nginx
        if conf_dir.endswith("/conf"):
            return os.path.dirname(conf_dir)
        # /etc/nginx/nginx.conf → /etc/nginx
        return conf_dir

    def _load_all_conf(self) -> str:
        """nginx.conf + include 파일을 하나의 문자열로 합산"""
        if not self.conf_path:
            return ""
        content = self._read_file(self.conf_path) or ""
        base_dir = os.path.dirname(self.conf_path)

        for line in content.splitlines():
            s = line.strip()
            if not s.startswith("include") or s.startswith("#"):
                continue
            parts = s.split(None, 1)
            if len(parts) < 2:
                continue
            pattern = parts[1].rstrip(";").strip()
            if not os.path.isabs(pattern):
                pattern = os.path.join(base_dir, pattern)

            if self.executor:
                _, flist, _ = self._run_shell(f"ls {pattern} 2>/dev/null")
                inc_files = [f.strip() for f in flist.splitlines() if f.strip()]
            else:
                inc_files = glob.glob(pattern)

            for inc_file in inc_files:
                extra = self._read_file(inc_file) or ""
                content += f"\n# === include: {inc_file} ===\n" + extra
        return content

    # ── conf 파싱 헬퍼 ─────────────────────────────────────────────

    def _directive_value(self, directive: str) -> str | None:
        """지시어의 첫 번째 값 반환 (비주석 라인 기준, 대소문자 무관)"""
        pattern = re.compile(rf"^{re.escape(directive)}\s+(.+?)\s*;?\s*$",
                             re.IGNORECASE)
        for line in self.conf_content.splitlines():
            s = line.strip()
            if s.startswith("#"):
                continue
            m = pattern.match(s)
            if m:
                return m.group(1).rstrip(";").strip()
        return None

    # ── 심볼릭 권한 변환 ───────────────────────────────────────────

    @staticmethod
    def _sym_to_oct(sym9: str) -> int:
        """'rwxr-x---' (9자리) → 정수 (예: 0o750)"""
        bits = 0
        for i, c in enumerate(sym9[:9]):
            if c != "-":
                bits |= (1 << (8 - i))
        return bits

    @staticmethod
    def _parse_ls_line(line: str) -> tuple[str, str, str] | None:
        """
        ls -al 한 줄 → (perm_str, owner, filename) 또는 None
        예: -rw------- 1 nginx nginx 1234 ... nginx.conf → ('-rw-------', 'nginx', 'nginx.conf')
        """
        parts = line.split()
        if len(parts) < 9:
            return None
        return parts[0], parts[2], parts[-1]

    # ── run ───────────────────────────────────────────────────────

    def run(self) -> ScanReport:
        print(f"\n[*] Nginx 취약점 진단 시작 → {self.target}")
        if not self.conf_path:
            print("  [!] nginx.conf 를 찾을 수 없습니다. conf_path 를 직접 지정하세요.")
        else:
            print(f"  [*] 설정 파일: {self.conf_path}  |  설치 디렉터리: {self.nginx_dir}")
        print()

        print("  ─── 1. 설정 ────────────────────────────────────────────")
        self._n11_daemon()
        self._n12_dir_perm()
        self._n13_conf_perm()
        self._n14_autoindex()
        self._n15_log_perm()
        self._n16_log_format()
        self._n17_log_retention()
        self._n18_server_tokens()
        self._n19_http_methods()
        self._n110_error_page()

        print()
        print("  ─── 2. 솔루션 취약점 ───────────────────────────────────")
        self._n21_default_index()
        self._n22_ssl_poodle()

        print()
        print("  ─── 3. 보안 패치 ───────────────────────────────────────")
        self._n31_patch()

        self.report.finish()
        return self.report

    # ══════════════════════════════════════════════════════════════
    # 1. 설정
    # ══════════════════════════════════════════════════════════════

    def _n11_daemon(self):
        """1.1 데몬 관리"""
        cid, name = "N-1.1", "데몬 관리"
        desc = ("웹 서버 데몬이 root 권한으로 구동될 경우 취약점 이용 시 "
                "공격자가 root 권한을 도용할 수 있음.")
        rec  = ("nginx.conf에 'user [전용계정];' 설정 후 root 이외의 "
                "로그인 가능한 전용 웹 서버 계정으로 구동")

        if not self.conf_path:
            self.error(cid, name, Severity.HIGH, desc, "nginx.conf 탐색 실패", rec)
            return

        cmd1 = f"cat {self.conf_path} | grep -i 'user'"
        _, out1, _ = self._run_shell(cmd1)

        cmd2 = "ps -ef | grep nginx | grep -v grep"
        _, out2, _ = self._run_shell(cmd2)

        cmd_str = f"{cmd1}\n{cmd2}"
        cmd_out  = f"[nginx.conf grep user]\n{out1}\n\n[ps nginx]\n{out2}"

        running = bool(out2.strip())

        # user 지시어 값 파싱
        user_val = self._directive_value("user")

        if user_val is None:
            if not running:
                self.manual(cid, name, Severity.HIGH, desc,
                            "user 지시어 미설정, nginx 데몬 미실행 — 수동 확인 필요",
                            rec, command=cmd_str, cmd_output=cmd_out)
                return
            # 실제 worker process 계정 확인
            _, ps_u, _ = self._run_shell(
                "ps -ef | grep 'nginx: worker' | grep -v grep | awk '{print $1}' | head -1")
            actual = ps_u.strip()
            if not actual or actual == "root":
                self.vulnerable(cid, name, Severity.HIGH, desc,
                                f"user 지시어 미설정, 워커 프로세스 실행 계정: {actual or 'root'}",
                                rec, command=cmd_str, cmd_output=cmd_out,
                                evidence=f"worker account: {actual or 'root(기본)'}")
            else:
                self.safe(cid, name, Severity.HIGH, desc,
                          f"워커 프로세스 실행 계정: {actual}",
                          rec, command=cmd_str, cmd_output=cmd_out)
            return

        account = user_val.split()[0]

        if account == "root":
            self.vulnerable(cid, name, Severity.HIGH, desc,
                            f"user = root — root 권한으로 데몬 구동",
                            rec, command=cmd_str, cmd_output=cmd_out,
                            evidence=f"user {user_val}")
        elif running:
            self.safe(cid, name, Severity.HIGH, desc,
                      f"user = {account} (전용 계정), 데몬 구동 중",
                      rec, command=cmd_str, cmd_output=cmd_out)
        else:
            self.manual(cid, name, Severity.HIGH, desc,
                        f"user = {account} 설정됨, 데몬 미실행",
                        rec, command=cmd_str, cmd_output=cmd_out)

    def _n12_dir_perm(self):
        """1.2 관리 서버 디렉터리 권한 설정"""
        cid, name = "N-1.2", "관리 서버 디렉터리 권한 설정"
        desc = ("일반 사용자가 관리 서버 디렉터리에 접근할 경우 홈페이지 변조, "
                "설정 변경 등으로 인한 장애 발생 가능.")
        rec  = ("chown [전용계정]:[전용계정] /[nginx 설치 디렉터리]/ && "
                "chmod 750 /[nginx 설치 디렉터리]")

        if not self.nginx_dir:
            self.manual(cid, name, Severity.MEDIUM, desc,
                        "nginx 설치 디렉터리 탐색 실패 — 수동 점검 필요", rec)
            return

        cmd = f"ls -ald {self.nginx_dir}/"
        _, out, _ = self._run_shell(cmd)

        if not out.strip():
            self.manual(cid, name, Severity.MEDIUM, desc,
                        f"{self.nginx_dir} 정보 조회 실패 — 수동 점검 필요", rec,
                        command=cmd, cmd_output=out)
            return

        parsed = self._parse_ls_line(out.splitlines()[0])
        if not parsed:
            self.manual(cid, name, Severity.MEDIUM, desc,
                        f"ls 출력 파싱 실패: {out}", rec,
                        command=cmd, cmd_output=out)
            return

        perm_str, owner, _ = parsed
        try:
            perm_oct = self._sym_to_oct(perm_str[1:])
        except Exception:
            self.manual(cid, name, Severity.MEDIUM, desc,
                        f"권한 파싱 실패: {perm_str}", rec,
                        command=cmd, cmd_output=out)
            return

        issues = []
        if owner not in _WEB_USERS:
            issues.append(f"소유자 {owner} (전용 웹 서버 계정 소유 아님)")
        if perm_oct > 0o750:
            issues.append(f"권한 {oct(perm_oct)[2:]} (750 초과)")

        if issues:
            self.vulnerable(cid, name, Severity.MEDIUM, desc,
                            f"{self.nginx_dir}: " + " | ".join(issues),
                            rec, command=cmd, cmd_output=out, evidence=out)
        else:
            self.safe(cid, name, Severity.MEDIUM, desc,
                      f"{self.nginx_dir}: 소유자={owner}, 권한={oct(perm_oct)[2:]}",
                      rec, command=cmd, cmd_output=out)

    def _n13_conf_perm(self):
        """1.3 설정 파일 권한 설정"""
        cid, name = "N-1.3", "설정 파일 권한 설정"
        desc = ("일반 사용자가 웹 서버 설정 파일을 삭제·변경할 수 있으면 "
                "시스템 오작동 및 사용 불능 상태 발생 가능.")
        rec  = ("chown [전용계정] /[nginx 설치 디렉터리]/conf/*.conf && "
                "chmod 600 /[nginx 설치 디렉터리]/conf/*.conf")

        conf_dir = os.path.dirname(self.conf_path) if self.conf_path else ""
        if not conf_dir:
            self.manual(cid, name, Severity.HIGH, desc,
                        "설정 파일 디렉터리 탐색 실패 — 수동 점검 필요", rec)
            return

        cmd = rf'find {conf_dir}/ -name "*.conf" -exec ls -al {{}} \;'
        _, out, _ = self._run_shell(cmd)

        if not out.strip():
            self.manual(cid, name, Severity.HIGH, desc,
                        f"{conf_dir} .conf 파일 없음 또는 조회 실패", rec,
                        command=cmd, cmd_output=out)
            return

        allowed_owners = _WEB_USERS | {"root"}
        issues = []
        for line in out.splitlines():
            parsed = self._parse_ls_line(line)
            if not parsed:
                continue
            perm_str, owner, fname = parsed
            try:
                perm_oct = self._sym_to_oct(perm_str[1:])
            except Exception:
                continue
            if perm_oct > 0o700:
                issues.append(f"{fname}: 권한 {oct(perm_oct)[2:]} (700 초과)")
            if owner not in allowed_owners:
                issues.append(f"{fname}: 소유자 {owner} (전용 계정 소유 아님)")

        if issues:
            self.vulnerable(cid, name, Severity.HIGH, desc,
                            "\n".join(issues), rec,
                            command=cmd, cmd_output=out, evidence=out[:500])
        else:
            self.safe(cid, name, Severity.HIGH, desc,
                      f"{conf_dir} .conf 파일 권한 양호 (소유자·권한 적절)",
                      rec, command=cmd, cmd_output=out)

    def _n14_autoindex(self):
        """1.4 디렉터리 검색 기능 제거"""
        cid, name = "N-1.4", "디렉터리 검색 기능 제거"
        desc = ("디렉터리 검색 기능 활성화 시 해당 디렉터리의 모든 파일이 "
                "리스팅되어 웹 서버 구조 노출 및 주요 파일 내용 유출 가능.")
        rec  = "nginx.conf에서 'autoindex off;' 설정 또는 옵션 삭제 (기본값: off)"

        if not self.conf_path:
            self.error(cid, name, Severity.MEDIUM, desc, "nginx.conf 탐색 실패", rec)
            return

        cmd = f"cat {self.conf_path} | grep 'autoindex'"
        _, out, _ = self._run_shell(cmd)

        val = self._directive_value("autoindex")
        if val and val.lower() == "on":
            self.vulnerable(cid, name, Severity.MEDIUM, desc,
                            "autoindex on 설정됨 — 디렉터리 목록 노출 위험",
                            rec, command=cmd, cmd_output=out, evidence=out)
        else:
            self.safe(cid, name, Severity.MEDIUM, desc,
                      f"autoindex = {val or 'off (기본값)'}",
                      rec, command=cmd, cmd_output=out)

    def _n15_log_perm(self):
        """1.5 로그 디렉터리/파일 권한 설정"""
        cid, name = "N-1.5", "로그 디렉터리/파일 권한 설정"
        desc = ("로그 파일에는 공격자에게 유용한 정보가 포함될 수 있으므로 "
                "일반 사용자의 정보 유출이 불가능하도록 권한 설정 필요.")
        rec  = ("chown -R [전용계정] /[logs 디렉터리]/ && "
                "chmod 750 /[logs 디렉터리] && chmod 640 /[logs 디렉터리]/*.log")

        # conf에서 로그 경로 파악
        cmd_grep = f"cat {self.conf_path} | grep 'error_log\\|access_log'" if self.conf_path else ""
        _, out_grep, _ = self._run_shell(cmd_grep) if cmd_grep else (0, "", "")

        log_dirs: set[str] = set()
        if self.nginx_dir:
            log_dirs.add(os.path.join(self.nginx_dir, "logs"))
        log_dirs.add("/var/log/nginx")

        for line in out_grep.splitlines():
            m = re.search(r"(?:error_log|access_log)\s+(\S+)", line)
            if m:
                lpath = m.group(1).rstrip(";")
                if "/" in lpath:
                    log_dirs.add(os.path.dirname(lpath))

        allowed_owners = _WEB_USERS | {"root"}
        issues = []
        checked = False

        for log_dir in sorted(log_dirs):
            cmd_d = f"ls -ald {log_dir}/ 2>/dev/null"
            _, out_d, _ = self._run_shell(cmd_d)
            if not out_d.strip():
                continue
            checked = True
            parsed = self._parse_ls_line(out_d.splitlines()[0])
            if parsed:
                perm_str, owner, _ = parsed
                try:
                    perm_oct = self._sym_to_oct(perm_str[1:])
                    if perm_oct > 0o750:
                        issues.append(f"{log_dir}: 디렉터리 권한 {oct(perm_oct)[2:]} (750 초과)")
                    if owner not in allowed_owners:
                        issues.append(f"{log_dir}: 디렉터리 소유자 {owner} (전용 계정 아님)")
                except Exception:
                    pass

            cmd_f = f"ls -al {log_dir}/*.log 2>/dev/null | head -20"
            _, out_f, _ = self._run_shell(cmd_f)
            for fline in out_f.splitlines():
                parsed_f = self._parse_ls_line(fline)
                if not parsed_f:
                    continue
                perm_str, owner, fname = parsed_f
                try:
                    perm_oct = self._sym_to_oct(perm_str[1:])
                    if perm_oct > 0o640:
                        issues.append(f"{fname}: 파일 권한 {oct(perm_oct)[2:]} (640 초과)")
                    if owner not in allowed_owners:
                        issues.append(f"{fname}: 파일 소유자 {owner} (전용 계정 아님)")
                except Exception:
                    pass

        # 진단 명령 문자열 (spec 표시용)
        cmd_show = (
            f"ls -ald {self.nginx_dir}/logs/ 2>/dev/null\n"
            f"ls -al {self.nginx_dir}/logs/*.log 2>/dev/null"
        ) if self.nginx_dir else "ls -ald /var/log/nginx/"

        if not checked:
            self.manual(cid, name, Severity.MEDIUM, desc,
                        "로그 디렉터리를 찾을 수 없음 — 수동 점검 필요", rec,
                        command=cmd_show)
            return

        if issues:
            self.vulnerable(cid, name, Severity.MEDIUM, desc,
                            "\n".join(issues), rec,
                            command=cmd_show, evidence="\n".join(issues))
        else:
            self.safe(cid, name, Severity.MEDIUM, desc,
                      "로그 디렉터리·파일 소유자 및 권한 양호",
                      rec, command=cmd_show)

    def _n16_log_format(self):
        """1.6 로그 포맷 설정"""
        cid, name = "N-1.6", "로그 포맷 설정"
        desc = ("로그 포맷이 Combined가 아니면 공격 여부·공격자 사용 툴·위치 파악 불가. "
                "Combined 또는 그에 준하는 포맷 스트링 설정 필요.")
        rec  = ("nginx.conf에 log_format combined '$remote_addr ... $http_user_agent'; "
                "access_log ... combined; 설정")

        if not self.conf_path:
            self.error(cid, name, Severity.HIGH, desc, "nginx.conf 탐색 실패", rec)
            return

        cmd = f"cat {self.conf_path} | grep 'access_log'"
        _, out, _ = self._run_shell(cmd)

        val = self._directive_value("access_log")

        # access_log off 이면 바로 취약
        if val and val.lower() == "off":
            self.vulnerable(cid, name, Severity.HIGH, desc,
                            "access_log off — 로그 완전 비활성화",
                            rec, command=cmd, cmd_output=out)
            return

        # access_log 라인에 combined 포함 여부
        access_lines = [l.strip() for l in self.conf_content.splitlines()
                        if re.search(r"\baccess_log\b", l, re.IGNORECASE)
                        and not l.strip().startswith("#")]
        has_combined = any("combined" in l for l in access_lines)

        # log_format combined 정의 여부
        has_format_def = bool(
            re.search(r"\blog_format\s+combined\b", self.conf_content, re.IGNORECASE))

        if has_combined or has_format_def:
            self.safe(cid, name, Severity.HIGH, desc,
                      "access_log combined 포맷 설정됨",
                      rec, command=cmd, cmd_output=out)
        elif val:
            self.manual(cid, name, Severity.HIGH, desc,
                        f"access_log 설정됨 ({val}) — 포맷명 미지정, combined 여부 수동 확인",
                        rec, command=cmd, cmd_output=out)
        else:
            self.vulnerable(cid, name, Severity.HIGH, desc,
                            "access_log combined 포맷 미설정",
                            rec, command=cmd, cmd_output=out)

    def _n17_log_retention(self):
        """1.7 로그 저장 주기"""
        cid, name = "N-1.7", "로그 저장 주기"
        desc = ("법률·회사사규에 따라 접속 기록을 최소 보유 기간 동안 보관하고 "
                "월 1회 이상 정기적으로 백업·확인·감독해야 함.")
        rec  = ("사용자 접속기록 6개월↑, 개인정보취급자 접속기록 2년↑, "
                "권한변경기록 5년↑ 보관. 물리적 별도 장치 백업.")

        self.manual(cid, name, Severity.HIGH, desc,
                    "서버 운영 또는 담당자에게 문의 — "
                    "로그 보존 기간·정기 백업·위·변조 방지 조치 수행 여부 확인 필요", rec)

    def _n18_server_tokens(self):
        """1.8 헤더 정보 노출 방지"""
        cid, name = "N-1.8", "헤더 정보 노출 방지"
        desc = ("공격자가 웹 서버 헤더 정보를 유출하여 서버 종류·버전 등 "
                "시스템 정보를 획득할 수 있음.")
        rec  = "nginx.conf(http/server/location 절)에 'server_tokens off;' 설정"

        if not self.conf_path:
            self.error(cid, name, Severity.LOW, desc, "nginx.conf 탐색 실패", rec)
            return

        cmd = f"cat {self.conf_path} | grep 'server_tokens'"
        _, out, _ = self._run_shell(cmd)

        val = self._directive_value("server_tokens")
        if val and val.lower() == "off":
            self.safe(cid, name, Severity.LOW, desc,
                      "server_tokens off 설정됨",
                      rec, command=cmd, cmd_output=out)
        else:
            self.vulnerable(cid, name, Severity.LOW, desc,
                            f"server_tokens = {val or '미설정 (기본값 on)'} — 버전 정보 노출 위험",
                            rec, command=cmd, cmd_output=out,
                            evidence=out or "server_tokens 설정 없음 (기본값 on)")

    def _n19_http_methods(self):
        """1.9 HTTP Method 제한"""
        cid, name = "N-1.9", "HTTP Method 제한"
        desc = ("GET, POST, HEAD, OPTIONS 이외의 Method 지원 시 "
                "공격자가 임의 파일을 삭제·업로드하여 서버 정상 운영에 지장 가능.")
        rec  = ("nginx.conf에서 dav_methods 지시어 제거 또는 "
                "'dav_methods off;' 설정 (기본값: off)")

        if not self.conf_path:
            self.error(cid, name, Severity.LOW, desc, "nginx.conf 탐색 실패", rec)
            return

        cmd = f"cat {self.conf_path} | grep 'dav_methods'"
        _, out, _ = self._run_shell(cmd)

        # dav_methods 미설정 = 기본값 off = 양호
        val = self._directive_value("dav_methods")
        if val is None:
            self.safe(cid, name, Severity.LOW, desc,
                      "dav_methods 미설정 (기본값 off) — 불필요한 Method 비활성화됨",
                      rec, command=cmd, cmd_output=out)
            return

        dangerous = [m for m in ["PUT", "DELETE", "MKCOL", "COPY", "MOVE"]
                     if m in val.upper()]
        if dangerous:
            self.vulnerable(cid, name, Severity.LOW, desc,
                            f"dav_methods에 위험 Method 포함: {', '.join(dangerous)}",
                            rec, command=cmd, cmd_output=out,
                            evidence=f"dav_methods {val}")
        else:
            self.safe(cid, name, Severity.LOW, desc,
                      f"dav_methods = {val} (안전한 Method만 허용)",
                      rec, command=cmd, cmd_output=out)

    def _n110_error_page(self):
        """1.10 에러 메시지 관리"""
        cid, name = "N-1.10", "에러 메시지 관리"
        desc = ("에러 메시지를 통해 공격자가 웹 프로그램 구조·환경 설정을 추정 가능. "
                "필수 에러 코드에 대한 커스텀 페이지 설정 필요.")
        rec  = ("nginx.conf에 'error_page 400 401 403 404 500 /error.html;' 설정 및 "
                "에러 페이지 파일 작성")

        if not self.conf_path:
            self.error(cid, name, Severity.MEDIUM, desc, "nginx.conf 탐색 실패", rec)
            return

        cmd = f"cat {self.conf_path} | grep 'error_page'"
        _, out, _ = self._run_shell(cmd)

        required_codes = {"400", "401", "403", "404", "500"}
        covered: set[str] = set()
        error_page_files: list[str] = []

        for line in self.conf_content.splitlines():
            s = line.strip()
            if s.startswith("#"):
                continue
            if re.match(r"^error_page\b", s, re.IGNORECASE):
                tokens = s.rstrip(";").split()
                if len(tokens) < 3:
                    continue
                page_file = tokens[-1]
                codes = [t for t in tokens[1:-1] if t.isdigit()]
                covered.update(codes)
                error_page_files.append(page_file)

        issues = []
        missing = required_codes - covered
        if missing:
            issues.append(f"필수 에러 코드 미처리: {', '.join(sorted(missing))}")

        for ep in set(error_page_files):
            # 절대 경로 구성
            if os.path.isabs(ep):
                ep_path = ep
            elif self.nginx_dir:
                ep_path = os.path.join(self.nginx_dir, ep.lstrip("/"))
            else:
                ep_path = ep

            if self.executor:
                _, chk, _ = self._run_shell(f"test -f {ep_path} && echo YES")
                exists = "YES" in chk
            else:
                exists = os.path.exists(ep_path)

            if not exists:
                issues.append(f"에러 페이지 파일 없음: {ep_path}")

        if issues:
            self.vulnerable(cid, name, Severity.MEDIUM, desc,
                            "\n".join(issues), rec,
                            command=cmd, cmd_output=out, evidence=out)
        else:
            self.safe(cid, name, Severity.MEDIUM, desc,
                      f"필수 에러 코드({', '.join(sorted(required_codes))}) 처리 및 에러 페이지 설정됨",
                      rec, command=cmd, cmd_output=out)

    # ══════════════════════════════════════════════════════════════
    # 2. 솔루션 취약점
    # ══════════════════════════════════════════════════════════════

    def _n21_default_index(self):
        """2.1 기본 문서명 사용 제한"""
        cid, name = "N-2.1", "기본 문서명 사용 제한"
        desc = ("기본 문서명을 디폴트(index.html/htm)로 사용하면 "
                "공격자가 서버 종류·버전을 유추하여 취약점 공격 가능성 높아짐.")
        rec  = "nginx.conf의 index 지시어를 'example_main.html' 등 기본값 외 이름으로 변경"

        if not self.conf_path:
            self.error(cid, name, Severity.LOW, desc, "nginx.conf 탐색 실패", rec)
            return

        cmd = f"cat {self.conf_path} | grep 'index'"
        _, out, _ = self._run_shell(cmd)

        index_vals: list[str] = []
        for line in self.conf_content.splitlines():
            s = line.strip()
            if s.startswith("#"):
                continue
            if re.match(r"^index\s", s, re.IGNORECASE):
                vals = s.rstrip(";").split()[1:]
                index_vals.extend(vals)

        if not index_vals:
            self.manual(cid, name, Severity.LOW, desc,
                        "index 지시어 미설정 — 수동 확인 필요",
                        rec, command=cmd, cmd_output=out)
            return

        default_names = {"index.html", "index.htm"}
        using_defaults = [v for v in index_vals if v.lower() in default_names]

        if using_defaults:
            self.vulnerable(cid, name, Severity.LOW, desc,
                            f"기본 문서명 사용 중: {', '.join(using_defaults)}",
                            rec, command=cmd, cmd_output=out,
                            evidence=out)
        else:
            self.safe(cid, name, Severity.LOW, desc,
                      f"기본 문서명 미사용: index = {', '.join(index_vals)}",
                      rec, command=cmd, cmd_output=out)

    def _n22_ssl_poodle(self):
        """2.2 SSL v3.0 POODLE 취약점"""
        cid, name = "N-2.2", "SSL v3.0 POODLE 취약점"
        desc = ("SSLv2/v3, TLSv1.0/1.1 등 취약 프로토콜 사용 시 "
                "POODLE(CVE-2014-3566)·BEAST 등 다운그레이드 공격 노출 가능.")
        rec  = ("nginx.conf에 'ssl_protocols TLSv1.2 TLSv1.3;' 설정. "
                "SSLv2·SSLv3·TLSv1.0·TLSv1.1 반드시 제거")

        if not self.conf_path:
            self.error(cid, name, Severity.HIGH, desc, "nginx.conf 탐색 실패", rec)
            return

        cmd = f"cat {self.conf_path} | grep 'ssl_protocols'"
        _, out, _ = self._run_shell(cmd)

        val = self._directive_value("ssl_protocols")
        if val is None:
            self.manual(cid, name, Severity.HIGH, desc,
                        "ssl_protocols 미설정 — SSL 미사용이거나 수동 확인 필요",
                        rec, command=cmd, cmd_output=out)
            return

        # 취약 프로토콜 패턴 매칭
        bad_patterns = [
            ("SSLv2",   r"\bSSLv2\b"),
            ("SSLv3",   r"\bSSLv3\b"),
            ("TLSv1.0", r"\bTLSv1(?:\.0)?\b(?![.\d])"),
            ("TLSv1.1", r"\bTLSv1\.1\b"),
        ]
        found_bad = [label for label, pat in bad_patterns if re.search(pat, val)]

        if found_bad:
            self.vulnerable(cid, name, Severity.HIGH, desc,
                            f"취약 프로토콜 허용: {', '.join(found_bad)}",
                            rec, command=cmd, cmd_output=out,
                            evidence=f"ssl_protocols {val}")
        else:
            self.safe(cid, name, Severity.HIGH, desc,
                      f"ssl_protocols = {val} (안전한 프로토콜만 설정됨)",
                      rec, command=cmd, cmd_output=out)

    # ══════════════════════════════════════════════════════════════
    # 3. 보안 패치
    # ══════════════════════════════════════════════════════════════

    def _n31_patch(self):
        """3.1 보안 패치 적용"""
        cid, name = "N-3.1", "보안 패치 적용"
        desc = ("주기적으로 보안 패치를 적용하지 않으면 "
                "exploit·제로데이 공격 등으로 서버 침해 발생 가능.")
        rec  = ("nginx 권고 기준 이상 버전으로 업그레이드. "
                "참고: http://nginx.org/en/download.html")

        cmd = "nginx -v 2>&1"
        _, out, err = self._run_shell(cmd)
        version_str = (out or err).strip()

        if not version_str:
            self.error(cid, name, Severity.HIGH, desc,
                       "nginx 버전 확인 불가 — nginx 명령어 없음 또는 미설치",
                       rec, command=cmd, cmd_output=version_str)
            return

        # "nginx/1.24.0" 또는 "nginx version: nginx/1.24.0"
        m = re.search(r"nginx[/ ](\d+)\.(\d+)\.(\d+)", version_str, re.IGNORECASE)
        if not m:
            self.manual(cid, name, Severity.HIGH, desc,
                        f"버전 파싱 실패: {version_str}",
                        rec, command=cmd, cmd_output=version_str)
            return

        major, minor, patch_ver = int(m.group(1)), int(m.group(2)), int(m.group(3))
        current = (major, minor, patch_ver)
        key = (major, minor)
        ver_str = ".".join(map(str, current))

        min_ver = _MIN_VER_TABLE.get(key)

        if min_ver is None:
            # 표 미등재 버전 — 1.22+ 이면 최신 계열로 간주
            if major > 1 or (major == 1 and minor >= 22):
                self.safe(cid, name, Severity.HIGH, desc,
                          f"Nginx {ver_str} — 권고 표 이상의 최신 계열",
                          rec, command=cmd, cmd_output=version_str)
            else:
                self.manual(cid, name, Severity.HIGH, desc,
                            f"Nginx {ver_str} — 버전 표 미등재, 수동 확인 필요",
                            rec, command=cmd, cmd_output=version_str)
            return

        min_str = ".".join(map(str, min_ver))
        if current >= min_ver:
            self.safe(cid, name, Severity.HIGH, desc,
                      f"Nginx {ver_str} ≥ 권고 최소 {min_str}",
                      rec, command=cmd, cmd_output=version_str)
        else:
            self.vulnerable(cid, name, Severity.HIGH, desc,
                            f"Nginx {ver_str} < 권고 최소 {min_str} — 업그레이드 필요",
                            rec, command=cmd, cmd_output=version_str,
                            evidence=f"현재: {ver_str}, 권고 최소: {min_str}")
