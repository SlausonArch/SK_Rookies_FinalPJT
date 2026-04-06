"""
OS - Linux 취약점 진단 모듈
점검 기준: 주요통신기반시설 보안가이드 (2026년 개정 반영)
  1. 계정 관리        (1.1  ~ 1.13)  13개
  2. 파일 시스템      (2.1  ~ 2.24)  24개
  3. 네트워크 서비스  (3.1  ~ 3.15)  15개
  4. 로그 관리        (4.1  ~ 4.5)    5개
  5. 주요 응용 설정   (5.1  ~ 5.6)    6개
  6. 시스템 보안 설정 (6.1  ~ 6.3)    3개
  7. 보안 패치        (7.1)           1개

개정 사항 (2026):
  - U-02: 개별 패스워드 설정 → 정책 기반 점검으로 변경 (pwquality.conf 포함)
  - U-13: 비밀번호 암호화 알고리즘 점검 신규 추가 (SHA-512 여부)
  - U-17: 시스템 시작 스크립트 권한 설정 신규 추가
  - U-35: 익명 FTP → 공유 서비스 전체 익명 접근 제한으로 확장
  - U-51: DNS 취약한 동적 업데이트 설정 금지 신규 추가
  - U-52: Telnet 서비스 비활성화 신규 추가
  - U-53/54/55: FTP 보안 강화 (정보노출·암호화·접근제어)
  - U-59/61: SNMP v3 및 ACL 점검 신규 추가
  - U-63: sudo 명령어 접근 관리 신규 추가
  - U-65: NTP 시각 동기화 신규 추가
  - U-67: 로그 디렉터리 소유자 및 권한 설정 신규 추가
"""
import os
import re
import glob
from core.base_scanner import BaseScanner
from core.result import ScanReport, Severity

# ─────────────────────────────────────────────────────────────
# 카테고리 레이블 (reporter가 그룹핑에 사용)
# ─────────────────────────────────────────────────────────────
SECTION_MAP = {
    "1": "계정 관리",
    "2": "파일 시스템",
    "3": "네트워크 서비스",
    "4": "로그 관리",
    "5": "주요 응용 설정",
    "6": "시스템 보안 설정",
    "7": "보안 패치",
}

# 로그인이 불필요한 시스템 서비스 계정 목록
_SYSTEM_ACCOUNTS = {
    "daemon", "bin", "sys", "adm", "lp", "mail", "news", "uucp",
    "man", "proxy", "www-data", "backup", "list", "irc", "gnats",
    "nobody", "systemd-network", "systemd-resolve", "systemd-timesync",
    "messagebus", "syslog", "_apt", "tss", "uuidd", "tcpdump",
    "ntp", "sshd", "postfix", "mysql", "nginx", "apache",
    "games", "gopher", "ftp", "halt", "shutdown", "sync",
}

# 불필요한 기본 계정
_DEFAULT_ACCOUNTS = {
    "games", "news", "uucp", "lp", "gopher", "ftp",
    "halt", "sync", "shutdown", "operator",
}


class LinuxScanner(BaseScanner):
    CATEGORY = "OS-Linux [주통기]"

    # ── 헬퍼 ───────────────────────────────────────────────────

    def _stat(self, path: str):
        """(perm_octal_str, owner) 또는 None."""
        rc, out, _ = self._run_cmd(f"stat -c '%a %U' {path}")
        if rc != 0 or not out:
            return None
        parts = out.split()
        return parts[0], (parts[1] if len(parts) > 1 else "?")

    def _chk_perm(self, cid, name, path, max_oct, severity, rec, owner="root"):
        desc = f"{path} 파일의 소유자·권한을 점검합니다."
        if not os.path.exists(path):
            self.skipped(cid, name, severity, desc,
                         f"{path} 없음 — N/A (해당 서비스 미설치)", rec)
            return
        r = self._stat(path)
        if r is None:
            self.manual(cid, name, severity, desc,
                        f"{path} stat 실패 — root 권한으로 재시도 필요", rec)
            return
        perm, act_owner = r
        issues = []
        try:
            if int(perm, 8) > max_oct:
                issues.append(f"권한 {perm} (권고: {oct(max_oct)[2:]} 이하)")
        except ValueError:
            pass
        if owner and act_owner != owner:
            issues.append(f"소유자 {act_owner} (권고: {owner})")
        if issues:
            self.vulnerable(cid, name, severity, desc, " / ".join(issues), rec,
                            f"stat: {perm} {act_owner}")
        else:
            self.safe(cid, name, severity, desc,
                      f"권한 {perm}, 소유자 {act_owner}", rec)

    def _sysctl(self, key: str) -> str | None:
        rc, out, _ = self._run_cmd(f"sysctl -n {key}")
        if rc == 0 and out.strip():
            return out.strip()
        path = "/proc/sys/" + key.replace(".", "/")
        c = self._read_file(path)
        return c.strip() if c else None

    def _pam_content(self) -> str:
        content = ""
        for p in ["/etc/pam.d/system-auth", "/etc/pam.d/common-auth",
                  "/etc/pam.d/common-password", "/etc/pam.d/password-auth"]:
            c = self._read_file(p)
            if c:
                content += c + "\n"
        return content

    def _login_defs(self, key: str):
        content = self._read_file("/etc/login.defs") or ""
        for line in content.splitlines():
            s = line.strip()
            if s.startswith(key) and not s.startswith("#"):
                parts = s.split()
                if len(parts) >= 2:
                    try:
                        return int(parts[1])
                    except ValueError:
                        return parts[1]
        return None

    def _service_up(self, *names) -> tuple[bool, str]:
        for n in names:
            rc, out, _ = self._run_cmd(f"systemctl is-active {n} 2>/dev/null")
            if out.strip() == "active":
                return True, n
            rc2, out2, _ = self._run_cmd(f"pgrep -x {n} 2>/dev/null")
            if rc2 == 0 and out2.strip():
                return True, n
        return False, ""

    def _ss(self) -> str:
        rc, out, _ = self._run_cmd("ss -tlnup")
        if rc != 0:
            _, out, _ = self._run_cmd("netstat -tlnup 2>/dev/null")
        return out

    def _apache_conf(self) -> str:
        content = ""
        for pat in ["/etc/httpd/conf/httpd.conf", "/etc/apache2/apache2.conf",
                    "/etc/httpd/conf.d/*.conf", "/etc/apache2/sites-enabled/*.conf"]:
            for p in glob.glob(pat):
                c = self._read_file(p)
                if c:
                    content += c + "\n"
        return content

    # ── run ────────────────────────────────────────────────────

    def run(self) -> ScanReport:
        print(f"\n[*] Linux 취약점 진단 시작 → {self.target}")

        print("\n  ─── 1. 계정 관리 ───────────────────────────────────")
        self._a01(); self._a02(); self._a03(); self._a04(); self._a05()
        self._a06(); self._a07(); self._a08(); self._a09(); self._a10()
        self._a11(); self._a12(); self._a13()

        print("\n  ─── 2. 파일 시스템 ─────────────────────────────────")
        self._b01(); self._b02(); self._b03(); self._b04(); self._b05()
        self._b06(); self._b07(); self._b08(); self._b09(); self._b10()
        self._b11(); self._b12(); self._b13(); self._b14(); self._b15()
        self._b16(); self._b17(); self._b18(); self._b19(); self._b20()
        self._b21(); self._b22(); self._b23(); self._b24()

        print("\n  ─── 3. 네트워크 서비스 ─────────────────────────────")
        self._c01(); self._c02(); self._c03(); self._c04(); self._c05()
        self._c06(); self._c07(); self._c08(); self._c09(); self._c10()
        self._c11(); self._c12(); self._c13(); self._c14(); self._c15()

        print("\n  ─── 4. 로그 관리 ───────────────────────────────────")
        self._d01(); self._d02(); self._d03(); self._d04(); self._d05()

        print("\n  ─── 5. 주요 응용 설정 ──────────────────────────────")
        self._e01(); self._e02(); self._e03(); self._e04(); self._e05(); self._e06()

        print("\n  ─── 6. 시스템 보안 설정 ────────────────────────────")
        self._f01(); self._f02(); self._f03()

        print("\n  ─── 7. 보안 패치 ───────────────────────────────────")
        self._g01()

        self.report.finish()
        return self.report

    # ══════════════════════════════════════════════════════════
    # 1. 계정 관리
    # ══════════════════════════════════════════════════════════

    # ══════════════════════════════════════════════════════════
    # 1. 계정 관리
    # ══════════════════════════════════════════════════════════

    def _a01(self):
        """1.1 로그인 설정 — N/A"""
        self.skipped(
            "1.1", "로그인 설정", Severity.MEDIUM,
            "로그인 관련 정책(최대 로그인 시도 횟수, 세션 잠금 등)을 점검합니다.",
            "N/A — 해당 항목은 운영 정책 인터뷰 기반으로 자동 진단 불가합니다.",
            "운영 담당자 인터뷰 및 관련 정책 문서 확인",
        )

    def _a02(self):
        """1.2 Default 계정 삭제"""
        cid, name = "1.2", "Default 계정 삭제"
        desc = ("lp, uucp, nuucp 등 OS 기본 생성 계정이 shell 제한 없이 "
                "존재하는지 점검합니다.")
        rec  = "userdel <계정명> 으로 불필요한 기본 계정 삭제 또는 shell을 /sbin/nologin으로 변경"

        cmd = 'egrep "^(lp|uucp|nuucp):" /etc/passwd | egrep -v "false|nologin"'
        rc, out, err = self._run_shell(cmd)
        found = [l for l in out.splitlines() if l.strip()]
        if found:
            self.vulnerable(cid, name, Severity.MEDIUM, desc,
                            f"shell 미제한 기본 계정 {len(found)}개 발견:\n" +
                            "\n".join(found),
                            rec, command=cmd, cmd_output=out or "(출력 없음)")
        else:
            self.safe(cid, name, Severity.MEDIUM, desc,
                      "lp/uucp/nuucp 계정이 없거나 shell이 false/nologin으로 제한됨",
                      rec, command=cmd, cmd_output=out or "(출력 없음)")

    def _a03(self):
        """1.3 일반계정 root 권한 관리"""
        cid, name = "1.3", "일반계정 root 권한 관리"
        desc = "UID=0인 계정이 root 하나만 존재하는지 점검합니다."
        rec  = "root 외 UID=0 계정의 UID를 고유값으로 변경"

        cmd = "awk -F: '$3 == 0 { print $0 }' /etc/passwd"
        rc, out, err = self._run_shell(cmd)
        uid0_lines = [l for l in out.splitlines() if l.strip()]
        # root만 있으면 양호
        uid0_users = [l.split(":")[0] for l in uid0_lines if l.strip()]
        extra = [u for u in uid0_users if u != "root"]
        if extra:
            self.vulnerable(cid, name, Severity.HIGH, desc,
                            f"UID=0 계정이 {len(uid0_users)}개 (root 외 {len(extra)}개): "
                            f"{', '.join(extra)}",
                            rec, command=cmd, cmd_output=out)
        elif not uid0_lines:
            self.manual(cid, name, Severity.HIGH, desc,
                        "UID=0 계정 조회 결과 없음 — 수동 확인 필요",
                        rec, command=cmd, cmd_output=out or err)
        else:
            self.safe(cid, name, Severity.HIGH, desc,
                      "UID=0 계정이 root 하나만 존재",
                      rec, command=cmd, cmd_output=out)

    def _a04(self):
        """1.4 /etc/passwd 파일 권한 설정 (passwd + shadow 동시 점검)"""
        cid, name = "1.4", "/etc/passwd 파일 권한 설정"
        desc = ("/etc/passwd 소유자 root·권한 644, "
                "/etc/shadow 소유자 root·권한 400(또는 r--------) 여부를 점검합니다.")
        rec  = ("chmod 644 /etc/passwd && chown root /etc/passwd\n"
                "chmod 400 /etc/shadow && chown root /etc/shadow")

        cmd_passwd = (
            "ls -l /etc/passwd | "
            "awk '$3 == \"root\" && $1 ~ /^-rw-r--r--/ {print \"PASS\"} "
            "!($3 == \"root\" && $1 ~ /^-rw-r--r--/) {print \"FAIL: \" $0}'"
        )
        cmd_shadow = (
            "ls -l /etc/shadow | "
            "awk '$3 == \"root\" && $1 ~ /^-r--------/ {print \"PASS\"} "
            "!($3 == \"root\" && $1 ~ /^-r--------/) {print \"FAIL: \" $0}'"
        )

        _, out_p, _ = self._run_shell(cmd_passwd)
        _, out_s, _ = self._run_shell(cmd_shadow)

        combined_cmd    = f"# /etc/passwd\n{cmd_passwd}\n\n# /etc/shadow\n{cmd_shadow}"
        combined_output = f"[/etc/passwd]\n{out_p or '(출력 없음)'}\n\n[/etc/shadow]\n{out_s or '(출력 없음)'}"

        issues = []
        if out_p and "PASS" not in out_p:
            issues.append(f"/etc/passwd: {out_p}")
        if out_s and "PASS" not in out_s:
            issues.append(f"/etc/shadow: {out_s}")
        # shadow 파일이 아예 없는 경우
        if not out_s:
            issues.append("/etc/shadow 확인 불가 (root 권한 필요 또는 파일 없음)")

        if issues:
            self.vulnerable(cid, name, Severity.HIGH, desc,
                            "\n".join(issues), rec,
                            command=combined_cmd, cmd_output=combined_output)
        else:
            self.safe(cid, name, Severity.HIGH, desc,
                      "/etc/passwd (644/root), /etc/shadow (400/root) — 양호",
                      rec, command=combined_cmd, cmd_output=combined_output)

    def _a05(self):
        """1.5 /etc/group 파일 권한 설정"""
        cid, name = "1.5", "/etc/group 파일 권한 설정"
        desc = "/etc/group 파일의 소유자가 root이고 권한이 644 이하인지 점검합니다."
        rec  = "chown root /etc/group && chmod 644 /etc/group"

        cmd = "ls -al /etc/group"
        rc, out, err = self._run_shell(cmd)

        issues = []
        if rc == 0 and out:
            # 출력 예: -rw-r--r--  1 root root 1234 ...
            parts = out.splitlines()[0].split() if out.splitlines() else []
            if len(parts) >= 3:
                perm_str, owner = parts[0], parts[2]
                if owner != "root":
                    issues.append(f"소유자: {owner} (root 권고)")
                # perm_str 예: -rw-r--r-- → 644
                allowed = {"-rw-r--r--", "-rw-------", "-r--r--r--", "-r--------"}
                if perm_str not in allowed and len(perm_str) >= 10:
                    issues.append(f"권한: {perm_str} (644 이하 권고)")
        else:
            issues.append(f"ls 실패: {err}")

        if issues:
            self.vulnerable(cid, name, Severity.HIGH, desc,
                            "\n".join(issues), rec,
                            command=cmd, cmd_output=out or err)
        else:
            self.safe(cid, name, Severity.HIGH, desc,
                      f"소유자·권한 양호 ({out.split()[0] if out else '-'})",
                      rec, command=cmd, cmd_output=out)

    def _a06(self):
        """1.6 /etc/shadow 파일 권한 설정"""
        cid, name = "1.6", "/etc/shadow 파일 권한 설정"
        desc = "/etc/shadow 파일 권한이 400 이하인지 점검합니다."
        rec  = "chown root /etc/shadow && chmod 400 /etc/shadow"

        # AIX 계열은 /etc/security/passwd 사용
        for shadow_path in ("/etc/shadow", "/etc/security/passwd"):
            cmd = f"ls -al {shadow_path}"
            rc, out, err = self._run_shell(cmd)
            if rc != 0 or not out:
                continue

            parts = out.splitlines()[0].split()
            perm_str = parts[0] if parts else ""
            owner    = parts[2] if len(parts) >= 3 else "?"
            # 400 이하 허용 문자열
            allowed_400 = {"-r--------", "----------"}
            issues = []
            if owner != "root":
                issues.append(f"소유자: {owner}")
            if perm_str not in allowed_400:
                issues.append(f"권한: {perm_str} (r-------- 권고)")

            if issues:
                self.vulnerable(cid, name, Severity.CRITICAL, desc,
                                "\n".join(issues), rec,
                                command=cmd, cmd_output=out)
            else:
                self.safe(cid, name, Severity.CRITICAL, desc,
                          f"{shadow_path}: {perm_str} {owner} — 양호",
                          rec, command=cmd, cmd_output=out)
            return

        self.skipped(cid, name, Severity.CRITICAL, desc,
                     "/etc/shadow · /etc/security/passwd 없음 — N/A",
                     rec, command="ls -al /etc/shadow", cmd_output="(파일 없음)")

    def _a07(self):
        """1.7 패스워드 사용 규칙 적용 (U-02 — 2026: 정책 기반 점검으로 변경)"""
        cid, name = "1.7", "패스워드 사용 규칙 적용"
        desc = ("비밀번호 관리정책(복잡성·길이·변경주기) 설정 여부를 점검합니다.\n"
                "2026년 주통기 개정: 개별 설정 항목 → 정책 기반 통합 점검\n"
                "점검 대상: /etc/security/pwquality.conf, /etc/login.defs, PAM")
        rec  = ("pwquality.conf: minlen=8, minclass=3 (또는 dcredit/ucredit/ocredit 설정)\n"
                "login.defs: PASS_MAX_DAYS 60, PASS_MIN_DAYS 7\n"
                "PAM system-auth: pam_faillock deny=5 / pam_pwquality 적용\n"
                "pam_unix.so remember=5 (재사용 금지)")

        cmd = r"""echo "=== [패스워드 정책 점검 결과] ==="; \
echo "1. pwquality.conf (복잡성 정책)"; \
cat /etc/security/pwquality.conf 2>/dev/null | grep -v "^#" | grep -v "^$"; \
echo ""; echo "2. 기본 설정 (/etc/login.defs)"; \
grep -E "PASS_MIN_LEN|PASS_MAX_DAYS|PASS_MIN_DAYS" /etc/login.defs 2>/dev/null; \
echo ""; echo "3. 계정 잠금 정책 (PAM)"; \
grep -E "pam_tally|pam_faillock" /etc/pam.d/system-auth 2>/dev/null; \
echo ""; echo "4. 패스워드 복잡성 규칙 (PAM)"; \
grep "password" /etc/pam.d/system-auth 2>/dev/null | grep "requisite"; \
echo ""; echo "5. 패스워드 재사용 금지 (History)"; \
grep "pam_unix.so" /etc/pam.d/system-auth 2>/dev/null | grep "remember" """

        _, out, _ = self._run_shell(cmd)

        # 판정 로직
        issues = []

        min_len  = self._login_defs("PASS_MIN_LEN")
        max_days = self._login_defs("PASS_MAX_DAYS")
        min_days = self._login_defs("PASS_MIN_DAYS")

        # pwquality.conf 복잡성 정책 확인 (2026 개정: 정책 파일 기반 점검)
        pwq = self._read_file("/etc/security/pwquality.conf") or ""
        pwq_minlen = None
        pwq_minclass = None
        for line in pwq.splitlines():
            s = line.strip()
            if s.startswith("#") or "=" not in s:
                continue
            k, _, v = s.partition("=")
            k, v = k.strip(), v.strip()
            if k == "minlen":
                try: pwq_minlen = int(v)
                except ValueError: pass
            elif k == "minclass":
                try: pwq_minclass = int(v)
                except ValueError: pass

        # pwquality.conf 기준 우선 적용
        eff_minlen = pwq_minlen or min_len
        if eff_minlen is None or (isinstance(eff_minlen, int) and eff_minlen < 8):
            issues.append(f"비밀번호 최소 길이 = {eff_minlen} → 8자 이상 권고 "
                          f"(pwquality.conf minlen={pwq_minlen}, login.defs PASS_MIN_LEN={min_len})")
        if pwq_minclass is not None and pwq_minclass < 3:
            issues.append(f"pwquality.conf minclass={pwq_minclass} → 3 이상(영문·숫자·특수문자) 권고")

        # 기준: 최대 사용기간 60일↓, 최소 사용기간 7일↑
        if max_days is None or (isinstance(max_days, int) and max_days > 60):
            issues.append(f"PASS_MAX_DAYS={max_days} → 60일 이하 권고")
        if min_days is None or (isinstance(min_days, int) and min_days < 7):
            issues.append(f"PASS_MIN_DAYS={min_days} → 7일 이상 권고")

        # 계정 잠금: deny 값 확인
        pam = self._pam_content()
        has_lock = "pam_faillock" in pam or "pam_tally2" in pam
        if not has_lock:
            issues.append("계정 잠금 정책(pam_faillock/pam_tally2) 미설정")
        else:
            deny_vals = re.findall(r"deny=(\d+)", pam)
            if deny_vals and max(int(v) for v in deny_vals) > 5:
                issues.append(f"계정 잠금 임계값 deny={max(int(v) for v in deny_vals)} → 5 이하 권고")

        # 복잡도 모듈
        if "pam_pwquality" not in pam and "pam_cracklib" not in pam:
            issues.append("패스워드 복잡도 모듈(pam_pwquality/pam_cracklib) 미적용")

        if issues:
            self.vulnerable(cid, name, Severity.HIGH, desc,
                            "\n".join(issues), rec,
                            command=cmd, cmd_output=out or "(출력 없음)")
        else:
            self.safe(cid, name, Severity.HIGH, desc,
                      f"패스워드 정책 모두 충족 "
                      f"(MIN_LEN={min_len}, MAX_DAYS={max_days}, MIN_DAYS={min_days})",
                      rec, command=cmd, cmd_output=out or "(출력 없음)")

    def _a08(self):
        """1.8 취약한 패스워드 점검 — 인터뷰"""
        cid, name = "1.8", "취약한 패스워드 점검"
        desc = ("계정과 유사하지 않은 8자 이상 영문/숫자/특수문자 조합 패스워드 설정 여부를 점검합니다.\n"
                "진단 방법: 인터뷰 (자동화로 실제 패스워드 강도 검증 불가)")
        rec  = ("8자 이상, 영문 대소문자+숫자+특수문자 조합으로 패스워드 변경\n"
                "계정명·생년월일 등 추측 가능한 문자열 사용 금지\n"
                "john / hashcat 등 별도 도구로 패스워드 크래킹 점검 수행 권고")

        self.manual(cid, name, Severity.CRITICAL, desc,
                    "인터뷰 기반 항목 — 자동 점검 불가\n"
                    "담당자 인터뷰 또는 john/hashcat으로 수동 진단 필요",
                    rec, command="(인터뷰 항목)", cmd_output="")

    def _a09(self):
        """1.9 로그인이 불필요한 계정 shell 제한"""
        cid, name = "1.9", "로그인이 불필요한 계정 shell 제한"
        desc = ("lp, uucp, nuucp 등 로그인이 필요 없는 계정의 shell이 "
                "/bin/false 또는 /sbin/nologin으로 제한되어 있는지 점검합니다.")
        rec  = "usermod -s /sbin/nologin <계정명>"

        cmd = (r'echo "=== [시스템 계정 쉘 제한 점검] ==="; '
               r'egrep "^(lp|uucp|nuucp):" /etc/passwd | '
               r"awk -F: '$NF !~ /false|nologin/ {print \" [취약] \" $0} "
               r'$NF ~ /false|nologin/ {print " [양호] " $0}\'')
        _, out, _ = self._run_shell(cmd)

        vuln_lines = [l for l in out.splitlines() if "[취약]" in l]
        if vuln_lines:
            self.vulnerable(cid, name, Severity.MEDIUM, desc,
                            f"shell 미제한 계정 {len(vuln_lines)}개:\n" +
                            "\n".join(vuln_lines),
                            rec, command=cmd, cmd_output=out or "(출력 없음)")
        else:
            self.safe(cid, name, Severity.MEDIUM, desc,
                      "lp/uucp/nuucp 계정이 없거나 shell이 false/nologin으로 제한됨",
                      rec, command=cmd, cmd_output=out or "(출력 없음)")

    def _a10(self):
        """1.10 SU 사용 제한"""
        cid, name = "1.10", "SU 사용 제한"
        desc = ("su 명령어를 특정 그룹(wheel)에 속한 사용자만 사용하도록 "
                "제한되어 있는지 점검합니다.")
        rec  = ("/etc/pam.d/su: auth required pam_wheel.so use_uid 추가\n"
                "/etc/default/security: SU_ROOT_GROUP=wheel 설정")

        cmd = (r'echo "=== [su 명령어 사용 제한 점검] ==="; '
               r'echo "1. 보안 설정 확인 (SU_ROOT_GROUP)"; '
               r'[ -f /etc/default/security ] && grep "SU_ROOT_GROUP" /etc/default/security || echo "파일 없음"; '
               r'echo ""; echo "2. wheel 그룹 생성 여부"; '
               r'grep "wheel" /etc/group 2>/dev/null; '
               r'echo ""; echo "3. su 명령어 권한 확인"; '
               r'ls -l /bin/su /usr/bin/su 2>/dev/null; '
               r'echo ""; echo "4. PAM su 설정"; '
               r'grep -E "pam_wheel|pam_rootok" /etc/pam.d/su 2>/dev/null')
        _, out, _ = self._run_shell(cmd)

        # PAM wheel 설정 확인
        pam_su = self._read_file("/etc/pam.d/su") or ""
        has_pam_wheel = any(
            "pam_wheel" in l and "use_uid" in l and not l.strip().startswith("#")
            for l in pam_su.splitlines()
        )
        # /etc/default/security 확인
        security = self._read_file("/etc/default/security") or ""
        has_su_root_group = "SU_ROOT_GROUP" in security

        if has_pam_wheel or has_su_root_group:
            self.safe(cid, name, Severity.HIGH, desc,
                      "su 사용 제한 설정됨 "
                      f"(PAM wheel={'적용' if has_pam_wheel else '미적용'}, "
                      f"SU_ROOT_GROUP={'적용' if has_su_root_group else '미적용'})",
                      rec, command=cmd, cmd_output=out or "(출력 없음)")
        else:
            self.vulnerable(cid, name, Severity.HIGH, desc,
                            "su 사용 제한 미설정 — 모든 사용자가 su root 가능",
                            rec, command=cmd, cmd_output=out or "(출력 없음)")

    def _a11(self):
        """1.11 계정이 존재하지 않는 GID 금지"""
        cid, name = "1.11", "계정이 존재하지 않는 GID 금지"
        desc = ("시스템 관리·운용에 불필요한 그룹이 /etc/group에 존재하는지 점검합니다.\n"
                "진단 방법: /etc/group 내용 확인 및 불필요 그룹 검토")
        rec  = "groupdel <그룹명> 으로 불필요한 그룹 삭제"

        cmd = "cat /etc/group"
        rc, out, _ = self._run_shell(cmd)

        if rc != 0 or not out:
            self.manual(cid, name, Severity.MEDIUM, desc,
                        "/etc/group 읽기 실패 — 수동 확인 필요",
                        rec, command=cmd, cmd_output=out or "")
            return

        # /etc/passwd에 존재하지 않는 GID를 가진 그룹(역방향) 검사
        passwd = self._read_file("/etc/passwd") or ""
        passwd_gids = {l.split(":")[3] for l in passwd.splitlines() if len(l.split(":")) >= 4}
        group_lines = out.splitlines()
        defined_gids = {l.split(":")[2] for l in group_lines if len(l.split(":")) >= 3}

        # passwd에 있는 GID 중 group에 없는 것
        orphan_gids = passwd_gids - defined_gids
        if orphan_gids:
            self.vulnerable(cid, name, Severity.MEDIUM, desc,
                            f"/etc/passwd에서 /etc/group에 없는 GID {len(orphan_gids)}개: "
                            f"{', '.join(sorted(orphan_gids))}",
                            rec, command=cmd, cmd_output=out[:500])
        else:
            self.safe(cid, name, Severity.MEDIUM, desc,
                      "불필요한 그룹 미발견 — 수동으로 불필요 그룹 확인 권고",
                      rec, command=cmd, cmd_output=out[:500])

    def _a12(self):
        """1.12 동일한 UID 금지"""
        cid, name = "1.12", "동일한 UID 금지"
        desc = "동일한 UID로 설정된 사용자 계정이 존재하는지 점검합니다."
        rec  = "중복 UID 계정에 고유한 UID 재할당 (usermod -u <UID> <계정명>)"

        cmd = "cat /etc/passwd"
        rc, out, _ = self._run_shell(cmd)

        if rc != 0 or not out:
            self.manual(cid, name, Severity.MEDIUM, desc,
                        "/etc/passwd 읽기 실패 — 수동 확인 필요",
                        rec, command=cmd, cmd_output=out or "")
            return

        uid_map: dict[str, list] = {}
        for line in out.splitlines():
            parts = line.split(":")
            if len(parts) >= 3:
                uid_map.setdefault(parts[2], []).append(parts[0])

        dups = {uid: accs for uid, accs in uid_map.items() if len(accs) > 1}
        if dups:
            detail = "\n".join(f"  UID {uid}: {', '.join(accs)}"
                               for uid, accs in dups.items())
            self.vulnerable(cid, name, Severity.MEDIUM, desc,
                            f"중복 UID {len(dups)}개:\n{detail}",
                            rec, command=cmd,
                            cmd_output="\n".join(
                                l for l in out.splitlines()
                                if l.split(":")[2] in dups
                            ) if dups else out[:300])
        else:
            self.safe(cid, name, Severity.MEDIUM, desc,
                      "UID 중복 없음",
                      rec, command=cmd, cmd_output="(중복 없음)")

    def _a13(self):
        """1.13 안전한 비밀번호 암호화 알고리즘 사용 (U-13 신규 — 2026)"""
        cid, name = "1.13", "안전한 비밀번호 암호화 알고리즘 사용"
        desc = ("/etc/shadow의 해시 접두사로 암호화 알고리즘을 점검합니다.\n"
                "$6$ → SHA-512 (양호) / $5$ → SHA-256 (보통) / $1$ → MD5 (취약)")
        rec  = ("SHA-512 전환:\n"
                "  authconfig --passalgo=sha512 --update  (CentOS/RHEL)\n"
                "  또는 /etc/pam.d/common-password에서 sha512 옵션 추가\n"
                "  기존 계정은 패스워드 재설정 필요")

        cmd = ("awk -F: 'NR>1 && $2 !~ /^[!*x]/ && length($2) > 3 "
               "{print $1, $2}' /etc/shadow 2>/dev/null | head -30")
        rc, out, _ = self._run_shell(cmd)

        if not out.strip():
            self.skipped(cid, name, Severity.HIGH, desc,
                         "/etc/shadow 읽기 실패 또는 활성 계정 없음 — root 권한 필요",
                         rec, command=cmd, cmd_output="")
            return

        vuln_list, warn_list = [], []
        for line in out.splitlines():
            parts = line.split()
            if len(parts) < 2:
                continue
            user, h = parts[0], parts[1]
            if h.startswith("$1$"):
                vuln_list.append(f"{user}: MD5($1$) — 취약")
            elif h.startswith("$2"):
                vuln_list.append(f"{user}: bcrypt($2$) — 취약(비표준)")
            elif h.startswith("$5$"):
                warn_list.append(f"{user}: SHA-256($5$) — SHA-512 권고")

        if vuln_list:
            self.vulnerable(cid, name, Severity.HIGH, desc,
                            f"취약 알고리즘 사용 계정 {len(vuln_list)}개:\n" +
                            "\n".join(vuln_list) +
                            (f"\nSHA-256 계정 {len(warn_list)}개:\n" + "\n".join(warn_list) if warn_list else ""),
                            rec, command=cmd, cmd_output=out)
        elif warn_list:
            self.manual(cid, name, Severity.HIGH, desc,
                        f"SHA-256 사용 계정 {len(warn_list)}개 — SHA-512 전환 권고:\n" +
                        "\n".join(warn_list),
                        rec, command=cmd, cmd_output=out)
        else:
            self.safe(cid, name, Severity.HIGH, desc,
                      "모든 활성 계정이 SHA-512($6$) 사용 (양호)",
                      rec, command=cmd, cmd_output=out)

    # ══════════════════════════════════════════════════════════
    # 2. 파일 시스템
    # ══════════════════════════════════════════════════════════

    def _b01(self):
        """2.1 사용자 UMASK 설정"""
        cid, name = "2.1", "사용자 UMASK 설정"
        desc = ("시스템 내에서 사용자가 파일 또는 디렉터리 생성 시 적용받는 umask 값을 점검합니다.\n"
                "umask 022(027) 권고")
        rec  = ("/etc/profile 및 /etc/bashrc에 'umask 022' (또는 027) 추가\n"
                "bash shell 미사용 시 /etc/profile에 설정 (Ubuntu는 /etc/profile 우선)")

        cmd1 = "cat /etc/profile | grep -i 'umask' | grep -v '#'"
        cmd2 = "cat /etc/security/user 2>/dev/null | grep -i 'umask' | grep -v '#'"
        _, out1, _ = self._run_shell(cmd1)
        _, out2, _ = self._run_shell(cmd2)
        combined_cmd = f"# 방법1\n{cmd1}\n\n# 방법2\n{cmd2}"
        combined_out = (f"[/etc/profile]\n{out1 or '(출력 없음)'}\n\n"
                        f"[/etc/security/user]\n{out2 or '(파일 없음)'}")

        # umask 값 추출 (awk '$2 >= 22' 기준: 022→22, 027→27 으로 10진수 비교)
        umask_val = None
        for line in (out1 + "\n" + out2).splitlines():
            parts = line.strip().split()
            if len(parts) >= 2:
                umask_val = parts[-1].lstrip("0") or "0"
                break
        if not umask_val:
            for p in ("/etc/bashrc", "/etc/bash.bashrc"):
                c = self._read_file(p) or ""
                for line in c.splitlines():
                    s = line.strip()
                    if s.lower().startswith("umask") and not s.startswith("#"):
                        pts = s.split()
                        if len(pts) >= 2:
                            umask_val = pts[1].lstrip("0") or "0"
                            break
                if umask_val:
                    break

        try:
            uval = int(umask_val) if umask_val else None
        except ValueError:
            uval = None

        if uval is not None and uval >= 22:
            self.safe(cid, name, Severity.LOW, desc,
                      f"UMASK = 0{umask_val} (양호)",
                      rec, command=combined_cmd, cmd_output=combined_out)
        elif uval is not None:
            self.vulnerable(cid, name, Severity.LOW, desc,
                            f"UMASK = 0{umask_val} (022 미만 — 취약)",
                            rec, command=combined_cmd, cmd_output=combined_out)
        else:
            self.vulnerable(cid, name, Severity.LOW, desc,
                            "UMASK 미설정",
                            rec, command=combined_cmd, cmd_output=combined_out)

    def _b02(self):
        """2.2 SUID·SGID 설정"""
        cid, name = "2.2", "SUID·SGID 설정"
        desc = ("불필요한 SUID/SGID 비트가 설정된 파일을 점검합니다.\n"
                "사양서 제거 대상 목록 파일의 SUID/SGID 존재 여부 확인")
        rec  = ("# chmod -s [파일명] 으로 불필요한 SUID/SGID 제거\n"
                "제거 전 OS 및 서비스 영향 확인 필요")

        # 사양서 지정 명령어
        cmd = r"find / -user root -type f \( -perm -4000 -o -perm -2000 \) -exec ls -al {} \; 2>/dev/null"
        # 실제 탐색 범위 제한 (전체 / 탐색 시 시스템 부하)
        cmd_exec = r"find /usr /bin /sbin /opt -user root -type f \( -perm -4000 -o -perm -2000 \) -exec ls -al {} \; 2>/dev/null"
        _, out, _ = self._run_shell(cmd_exec, timeout=30)

        # 사양서 명시 제거 대상 목록
        remove_targets = {
            "/sbin/dump", "/usr/bin/lpq-lpd", "/usr/bin/newgrp",
            "/sbin/restore", "/usr/bin/lpr", "/usr/sbin/lpc",
            "/sbin/unix_chkpwd", "/usr/bin/lpr-lpd", "/usr/sbin/lpc-lpd",
            "/usr/bin/at", "/usr/bin/lprm", "/usr/sbin/traceroute",
            "/usr/bin/lpq", "/usr/bin/lprm-lpd",
        }
        files = []
        for line in out.splitlines():
            if line.strip():
                parts = line.split()
                if parts:
                    files.append(parts[-1])

        found_remove = [f for f in files if f in remove_targets]
        if found_remove:
            self.vulnerable(cid, name, Severity.LOW, desc,
                            f"제거 권고 목록 해당 파일 {len(found_remove)}개:\n" +
                            "\n".join(found_remove),
                            rec, command=cmd, cmd_output=out[:1000] or "(출력 없음)")
        elif files:
            self.manual(cid, name, Severity.LOW, desc,
                        f"SUID/SGID 파일 {len(files)}개 — 허용 여부 수동 확인 필요:\n" +
                        "\n".join(files[:20]),
                        rec, command=cmd, cmd_output=out[:1000] or "(출력 없음)")
        else:
            self.safe(cid, name, Severity.LOW, desc,
                      "SUID/SGID 파일 미발견 (양호)",
                      rec, command=cmd, cmd_output=out or "(출력 없음)")

    def _b03(self):
        """2.3 /etc/(x)inetd.conf 파일 권한 설정"""
        cid, name = "2.3", "/etc/(x)inetd.conf 파일 권한 설정"
        desc = ("/etc/(x)inetd.conf 파일 및 디렉터리의 권한 중 Other에 쓰기 권한이 "
                "부여되어 있는지 점검합니다.")
        rec  = ("chown root /etc/(x)inetd.conf && chmod o-w /etc/(x)inetd.conf\n"
                "chmod o-w /etc/(x)inetd.d/*")

        found_path = None
        for p in ("/etc/inetd.conf", "/etc/xinetd.conf"):
            if os.path.exists(p):
                found_path = p
                break

        cmd1 = f"ls -al {found_path or '/etc/inetd.conf'} 2>/dev/null"
        cmd2 = "ls -ald /etc/inetd.d 2>/dev/null; ls -ald /etc/xinetd.d 2>/dev/null"
        combined_cmd = f"{cmd1}\n{cmd2}"
        _, out1, _ = self._run_shell(cmd1)
        _, out2, _ = self._run_shell(cmd2)
        combined_out = f"{out1 or '(파일 없음)'}\n{out2 or ''}"

        if not found_path:
            self.skipped(cid, name, Severity.HIGH, desc,
                         "inetd/xinetd 미설치 — N/A", rec,
                         command=combined_cmd, cmd_output=combined_out)
            return

        r = self._stat(found_path)
        if r:
            perm, owner = r
            issues = []
            if int(perm, 8) & 0o002:
                issues.append(f"{found_path}: Other 쓰기 권한 있음 ({perm})")
            if owner != "root":
                issues.append(f"{found_path}: 소유자 {owner} (root 권고)")
            if issues:
                self.vulnerable(cid, name, Severity.HIGH, desc, "\n".join(issues), rec,
                                command=combined_cmd, cmd_output=combined_out)
            else:
                self.safe(cid, name, Severity.HIGH, desc,
                          f"{found_path}: Other 쓰기 권한 없음, 소유자 root (양호)",
                          rec, command=combined_cmd, cmd_output=combined_out)
        else:
            self.manual(cid, name, Severity.HIGH, desc,
                        f"{found_path} stat 실패 — root 권한으로 재확인 필요",
                        rec, command=combined_cmd, cmd_output=combined_out)

    def _b04(self):
        """2.4 .history 파일 권한 설정"""
        cid, name = "2.4", ".history 파일 권한 설정"
        desc = ("로그인 계정의 .bash_history, .history, .sh_history 파일의 권한이 "
                "600(소유자 본인)으로 설정되어 있는지 점검합니다.")
        rec  = ("chmod 600 [홈 디렉터리]/.bash_history\n"
                "chown <사용자ID> [홈 디렉터리]/.bash_history")

        # 전체 계정 홈 디렉터리 확인
        cmd_list = ("cat /etc/passwd | awk -F':' 'length($6) > 0 {print $6}' "
                    "| sort -u | grep -v '/bin/false' | grep -v 'nologin' | grep -v '#'")
        _, home_out, _ = self._run_shell(cmd_list)
        home_dirs = [d.strip() for d in home_out.splitlines() if d.strip() and d.strip() != "/"]

        issues = []
        checked = []
        for home in home_dirs:
            if not os.path.isdir(home):
                continue
            for hf in (".bash_history", ".history", ".sh_history"):
                p = os.path.join(home, hf)
                if not os.path.exists(p):
                    continue
                checked.append(p)
                r = self._stat(p)
                if r:
                    perm, owner = r
                    try:
                        if int(perm, 8) > 0o600:
                            issues.append(f"{p}: 권한 {perm} (600 초과)")
                    except ValueError:
                        pass

        combined_cmd = (f"# 전체 계정 홈 디렉터리 확인\n{cmd_list}\n\n"
                        "# 각 계정에 대한 권한 확인\n"
                        "ls -al [계정 디렉터리 경로]/.bash_history")
        combined_out = (f"[홈 디렉터리 목록]\n{home_out or '(출력 없음)'}\n\n"
                        f"[점검 파일 {len(checked)}개]\n" + "\n".join(checked[:20]))

        if issues:
            self.vulnerable(cid, name, Severity.MEDIUM, desc,
                            f"권한 과다 history 파일 {len(issues)}개:\n" + "\n".join(issues),
                            rec, command=combined_cmd, cmd_output=combined_out)
        elif not checked:
            self.safe(cid, name, Severity.MEDIUM, desc,
                      "점검할 history 파일 없음 (양호)",
                      rec, command=combined_cmd, cmd_output=combined_out)
        else:
            self.safe(cid, name, Severity.MEDIUM, desc,
                      f"history 파일 {len(checked)}개 — 모두 권한 600 이하 (양호)",
                      rec, command=combined_cmd, cmd_output=combined_out)

    def _b05(self):
        """2.5 Crontab 파일 권한 설정 및 관리"""
        cid, name = "2.5", "Crontab 파일 권한 설정 및 관리"
        desc = ("Crontab 관련 파일의 소유자가 root이며, 타사용자의 권한이 제거되어 "
                "있는지 점검합니다.")
        rec  = ("chmod o-rwx /etc/crontab /etc/cron.daily/* /etc/cron.hourly/* "
                "/etc/cron.monthly/* /etc/cron.weekly/* /var/spool/cron/*\n"
                "chown root /etc/crontab")

        cmd = ("ls -al /etc/crontab 2>/dev/null; "
               "ls -al /etc/cron.daily/* 2>/dev/null; "
               "ls -al /etc/cron.hourly/* 2>/dev/null; "
               "ls -al /etc/cron.monthly/* 2>/dev/null; "
               "ls -al /etc/cron.weekly/* 2>/dev/null; "
               "ls -al /var/spool/cron/* 2>/dev/null")
        _, out, _ = self._run_shell(cmd, timeout=15)

        issues = []
        # /etc/crontab 소유자 및 Other 권한 체크
        if os.path.exists("/etc/crontab"):
            r = self._stat("/etc/crontab")
            if r:
                perm, owner = r
                if owner != "root":
                    issues.append(f"/etc/crontab: 소유자 {owner} (root 권고)")
                if int(perm, 8) & 0o007:
                    issues.append(f"/etc/crontab: Other 권한 있음 ({perm})")

        # cron 디렉터리 내 파일 Other 권한 체크
        for d in ("/etc/cron.d", "/etc/cron.daily", "/etc/cron.hourly",
                  "/etc/cron.monthly", "/etc/cron.weekly", "/var/spool/cron"):
            if not os.path.isdir(d):
                continue
            _, ww_out, _ = self._run_shell(
                f"find {d} -maxdepth 1 -perm /007 -not -type d 2>/dev/null")
            for f in ww_out.splitlines():
                if f.strip():
                    issues.append(f"{f.strip()}: Other 권한 있음")

        if issues:
            self.vulnerable(cid, name, Severity.HIGH, desc,
                            "\n".join(issues[:15]), rec,
                            command=cmd, cmd_output=out[:800] or "(출력 없음)")
        else:
            self.safe(cid, name, Severity.HIGH, desc,
                      "crontab 파일 소유자 root, Other 권한 없음 (양호)",
                      rec, command=cmd, cmd_output=out[:800] or "(출력 없음)")

    def _b06(self):
        """2.6 /etc/profile 파일 권한 설정"""
        cid, name = "2.6", "/etc/profile 파일 권한 설정"
        desc = "/etc/profile 파일의 권한 중 Other에 쓰기 권한이 부여되어 있는지 점검합니다."
        rec  = "chown root /etc/profile && chmod o-w /etc/profile"

        cmd = "ls -ald /etc/profile"
        _, out, _ = self._run_shell(cmd)
        r = self._stat("/etc/profile")
        if r:
            perm, owner = r
            if int(perm, 8) & 0o002:
                self.vulnerable(cid, name, Severity.MEDIUM, desc,
                                f"/etc/profile: Other 쓰기 권한 있음 ({perm})", rec,
                                command=cmd, cmd_output=out or "(출력 없음)")
            else:
                self.safe(cid, name, Severity.MEDIUM, desc,
                          f"/etc/profile: Other 쓰기 권한 없음 ({perm}, {owner}) — 양호",
                          rec, command=cmd, cmd_output=out or "(출력 없음)")
        else:
            self.manual(cid, name, Severity.MEDIUM, desc,
                        "/etc/profile 확인 실패 — 수동 확인 필요",
                        rec, command=cmd, cmd_output=out or "(출력 없음)")

    def _b07(self):
        """2.7 /etc/hosts 파일 권한 설정"""
        cid, name = "2.7", "/etc/hosts 파일 권한 설정"
        desc = "/etc/hosts 파일의 권한 중 Other에 쓰기 권한이 부여되어 있는지 점검합니다."
        rec  = "chown root /etc/hosts && chmod o-w /etc/hosts"

        cmd = "ls -ald /etc/hosts"
        _, out, _ = self._run_shell(cmd)
        r = self._stat("/etc/hosts")
        if r:
            perm, owner = r
            if int(perm, 8) & 0o002:
                self.vulnerable(cid, name, Severity.MEDIUM, desc,
                                f"/etc/hosts: Other 쓰기 권한 있음 ({perm})", rec,
                                command=cmd, cmd_output=out or "(출력 없음)")
            else:
                self.safe(cid, name, Severity.MEDIUM, desc,
                          f"/etc/hosts: Other 쓰기 권한 없음 ({perm}, {owner}) — 양호",
                          rec, command=cmd, cmd_output=out or "(출력 없음)")
        else:
            self.manual(cid, name, Severity.MEDIUM, desc,
                        "/etc/hosts 확인 실패",
                        rec, command=cmd, cmd_output=out or "(출력 없음)")

    def _b08(self):
        """2.8 /etc/issue 파일 권한 설정"""
        cid, name = "2.8", "/etc/issue 파일 권한 설정"
        desc = ("/etc/issue, /etc/issue.net 파일의 권한 중 Other에 쓰기 권한이 "
                "부여되어 있는지 점검합니다.")
        rec  = ("chown root /etc/issue /etc/issue.net\n"
                "chmod o-w /etc/issue /etc/issue.net")

        cmd = "ls -al /etc/issue 2>/dev/null; ls -al /etc/issue.net 2>/dev/null"
        _, out, _ = self._run_shell(cmd)

        issues = []
        for path in ("/etc/issue", "/etc/issue.net"):
            if not os.path.exists(path):
                continue
            r = self._stat(path)
            if r:
                perm, owner = r
                if int(perm, 8) & 0o002:
                    issues.append(f"{path}: Other 쓰기 권한 있음 ({perm})")

        if issues:
            self.vulnerable(cid, name, Severity.MEDIUM, desc, "\n".join(issues), rec,
                            command=cmd, cmd_output=out or "(출력 없음)")
        else:
            self.safe(cid, name, Severity.MEDIUM, desc,
                      "/etc/issue, /etc/issue.net: Other 쓰기 권한 없음 (양호)",
                      rec, command=cmd, cmd_output=out or "(출력 없음)")

    def _b09(self):
        """2.9 사용자 홈 디렉터리 및 파일 관리"""
        cid, name = "2.9", "사용자 홈 디렉터리 및 파일 관리"
        desc = ("홈 디렉터리 권한 중 Other에 쓰기 권한이 없어야 하며, "
                "홈 디렉터리가 존재하지 않는 계정이 없어야 합니다.")
        rec  = ("chmod o-rwx [홈 디렉터리]\n"
                "chmod o-w [홈 디렉터리 내 환경변수 파일]")

        cmd1 = "ls -ald /home/* 2>/dev/null"
        cmd2 = "cat /etc/passwd | grep 'bash'"
        _, out1, _ = self._run_shell(cmd1)
        _, out2, _ = self._run_shell(cmd2)
        combined_cmd = f"{cmd1}\n\n{cmd2}"
        combined_out = (f"[홈 디렉터리 목록]\n{out1 or '(출력 없음)'}\n\n"
                        f"[bash 사용 계정]\n{out2 or '(출력 없음)'}")

        issues = []
        passwd = self._read_file("/etc/passwd") or ""
        for line in passwd.splitlines():
            parts = line.split(":")
            if len(parts) < 7:
                continue
            user, shell, home = parts[0], parts[6].strip(), parts[5]
            if "nologin" in shell or "false" in shell or not home or home == "/":
                continue
            if not os.path.isdir(home):
                issues.append(f"{user}: 홈 디렉터리 {home} 없음")
                continue
            r = self._stat(home)
            if r:
                perm, _ = r
                if int(perm, 8) & 0o002:
                    issues.append(f"{home}: Other 쓰기 권한 있음 ({perm})")

        if issues:
            self.vulnerable(cid, name, Severity.HIGH, desc,
                            "\n".join(issues[:15]), rec,
                            command=combined_cmd, cmd_output=combined_out)
        else:
            self.safe(cid, name, Severity.HIGH, desc,
                      "홈 디렉터리 권한 양호 (Other 쓰기 없음, 홈 디렉터리 존재)",
                      rec, command=combined_cmd, cmd_output=combined_out)

    def _b10(self):
        """2.10 중요 디렉터리 파일 권한 설정"""
        cid, name = "2.10", "중요 디렉터리 파일 권한 설정"
        desc = ("/sbin /etc/ /bin /usr/bin /usr/sbin /usr/lbin 디렉터리의 권한 중 "
                "Other에 쓰기 권한이 부여되어 있는지 점검합니다.")
        rec  = ("chown root [디렉터리명]\n"
                "chmod o-w [디렉터리명]")

        cmd = "ls -ald /sbin /etc/ /bin /usr/bin /usr/sbin /usr/lbin 2>/dev/null"
        _, out, _ = self._run_shell(cmd)

        issues = []
        for path in ("/sbin", "/etc", "/bin", "/usr/bin", "/usr/sbin", "/usr/lbin"):
            if not os.path.exists(path):
                continue
            r = self._stat(path)
            if r:
                perm, owner = r
                if int(perm, 8) & 0o002:
                    issues.append(f"{path}: Other 쓰기 권한 있음 ({perm})")
                if owner not in ("root", "bin"):
                    issues.append(f"{path}: 소유자 {owner} (root/bin 권고)")

        if issues:
            self.vulnerable(cid, name, Severity.MEDIUM, desc, "\n".join(issues), rec,
                            command=cmd, cmd_output=out or "(출력 없음)")
        else:
            self.safe(cid, name, Severity.MEDIUM, desc,
                      "중요 디렉터리: Other 쓰기 권한 없음 (양호)",
                      rec, command=cmd, cmd_output=out or "(출력 없음)")

    def _b11(self):
        """2.11 PATH 환경변수 설정"""
        cid, name = "2.11", "PATH 환경변수 설정"
        desc = ("root 계정의 PATH 환경변수에 '.'(현재 디렉터리)이 맨 앞이나 중간에 "
                "포함되어 있는지 점검합니다. (디렉터리명 제외)")
        rec  = "/etc/profile, root 환경변수 파일에서 PATH에 포함된 '.' 제거 또는 맨 끝으로 이동"

        cmd1 = "env | grep PATH"
        cmd2 = "cat /.profile 2>/dev/null | grep PATH"
        cmd3 = "cat /etc/profile | grep PATH"
        combined_cmd = f"{cmd1}\n{cmd2}\n{cmd3}"
        _, out1, _ = self._run_shell(cmd1)
        _, out2, _ = self._run_shell(cmd2)
        _, out3, _ = self._run_shell(cmd3)
        combined_out = (f"[env | grep PATH]\n{out1 or '(없음)'}\n\n"
                        f"[/.profile | grep PATH]\n{out2 or '(없음)'}\n\n"
                        f"[/etc/profile | grep PATH]\n{out3 or '(없음)'}")

        issues = []
        for src, content in [("env", out1), ("/.profile", out2), ("/etc/profile", out3)]:
            for line in content.splitlines():
                if "PATH=" in line and not line.strip().startswith("#"):
                    val = line.split("PATH=")[-1].strip().strip('"').strip("'")
                    parts = val.replace('"', '').replace("'", "").split(":")
                    # '.'이 맨 앞이나 중간에 있는지 확인 (맨 끝 제외)
                    if "." in parts[:-1] or (parts and parts[0] == "."):
                        issues.append(f"{src}: PATH에 '.'이 앞/중간에 포함 ({line[:80]})")
                    elif "" in parts[:-1]:
                        issues.append(f"{src}: PATH에 빈 항목(::) 존재 — 현재 디렉터리 지칭")

        if issues:
            self.vulnerable(cid, name, Severity.MEDIUM, desc, "\n".join(issues), rec,
                            command=combined_cmd, cmd_output=combined_out)
        else:
            self.safe(cid, name, Severity.MEDIUM, desc,
                      "PATH에 현재 디렉터리('.')가 앞/중간에 없음 (양호)",
                      rec, command=combined_cmd, cmd_output=combined_out)

    def _b12(self):
        """2.12 FTP 접근제어 파일 권한 설정"""
        cid, name = "2.12", "FTP 접근제어 파일 권한 설정"
        desc = "FTP 접근제어 설정 파일의 권한 중 Other에 쓰기 권한이 부여되어 있는지 점검합니다."
        rec  = ("chown root /etc/ftpusers && chmod o-w /etc/ftpusers\n"
                "vsftpd 사용 시: chown root /etc/vsftpd/user_list && chmod o-w")

        cmd = ("ls -al /etc/ftpusers 2>/dev/null; "
               "ls -al /etc/ftpd/ftpusers 2>/dev/null; "
               "ls -al /etc/vsftpd/ftpusers 2>/dev/null")
        _, out, _ = self._run_shell(cmd)

        ftp_paths = ["/etc/ftpusers", "/etc/ftpd/ftpusers", "/etc/vsftpd/ftpusers",
                     "/etc/vsftpd/user_list", "/etc/vsftpd.user_list"]
        found_any = False
        issues = []
        for path in ftp_paths:
            if not os.path.exists(path):
                continue
            found_any = True
            r = self._stat(path)
            if r:
                perm, owner = r
                if int(perm, 8) & 0o002:
                    issues.append(f"{path}: Other 쓰기 권한 있음 ({perm})")

        if not found_any:
            self.skipped(cid, name, Severity.HIGH, desc,
                         "ftpusers 파일 없음 — FTP 미설치 N/A", rec,
                         command=cmd, cmd_output=out or "(파일 없음)")
            return

        if issues:
            self.vulnerable(cid, name, Severity.HIGH, desc, "\n".join(issues), rec,
                            command=cmd, cmd_output=out or "(출력 없음)")
        else:
            self.safe(cid, name, Severity.HIGH, desc,
                      "FTP 접근제어 파일: Other 쓰기 권한 없음 (양호)",
                      rec, command=cmd, cmd_output=out or "(출력 없음)")

    def _b13(self):
        """2.13 root 원격 접근제어 파일 권한 설정"""
        cid, name = "2.13", "root 원격 접근제어 파일 권한 설정"
        desc = ("/etc/pam.d/login, /etc/securetty 파일의 권한 중 "
                "Other에 쓰기 권한이 부여되어 있는지 점검합니다.")
        rec  = ("chown root /etc/pam.d/login /etc/securetty\n"
                "chmod o-w /etc/pam.d/login && chmod o-w /etc/securetty")

        cmd = ("ls -al /etc/security/user 2>/dev/null; "
               "ls -al /etc/pam.d/login 2>/dev/null")
        _, out, _ = self._run_shell(cmd)

        issues = []
        for path in ("/etc/pam.d/login", "/etc/securetty", "/etc/security/user"):
            if not os.path.exists(path):
                continue
            r = self._stat(path)
            if r:
                perm, owner = r
                if int(perm, 8) & 0o002:
                    issues.append(f"{path}: Other 쓰기 권한 있음 ({perm})")

        if issues:
            self.vulnerable(cid, name, Severity.MEDIUM, desc, "\n".join(issues), rec,
                            command=cmd, cmd_output=out or "(출력 없음)")
        else:
            self.safe(cid, name, Severity.MEDIUM, desc,
                      "root 원격 접근제어 파일: Other 쓰기 권한 없음 (양호)",
                      rec, command=cmd, cmd_output=out or "(출력 없음)")

    def _b14(self):
        """2.14 NFS 접근제어 파일 권한 설정"""
        cid, name = "2.14", "NFS 접근제어 파일 권한 설정"
        desc = ("/etc/exports 파일의 권한 중 Group, Other에 쓰기 권한이 "
                "부여되어 있는지 점검합니다.")
        rec  = "chown root /etc/exports && chmod go-w /etc/exports"

        cmd = "ls -al /etc/exports 2>/dev/null"
        _, out, _ = self._run_shell(cmd)

        if not os.path.exists("/etc/exports"):
            self.skipped(cid, name, Severity.HIGH, desc,
                         "/etc/exports 없음 — NFS 미사용 N/A", rec,
                         command=cmd, cmd_output="(파일 없음)")
            return

        r = self._stat("/etc/exports")
        if r:
            perm, owner = r
            if int(perm, 8) & 0o022:
                self.vulnerable(cid, name, Severity.HIGH, desc,
                                f"/etc/exports: Group/Other 쓰기 권한 있음 ({perm})", rec,
                                command=cmd, cmd_output=out or "(출력 없음)")
            else:
                self.safe(cid, name, Severity.HIGH, desc,
                          f"/etc/exports: Group/Other 쓰기 권한 없음 (양호)",
                          rec, command=cmd, cmd_output=out or "(출력 없음)")
        else:
            self.manual(cid, name, Severity.HIGH, desc,
                        "/etc/exports stat 실패", rec,
                        command=cmd, cmd_output=out or "(출력 없음)")

    def _b15(self):
        """2.15 /etc/services 파일 권한 설정"""
        cid, name = "2.15", "/etc/services 파일 권한 설정"
        desc = ("/etc/services 파일의 권한 중 Group, Other에 쓰기 권한이 "
                "부여되어 있는지 점검합니다.")
        rec  = "chown root /etc/services && chmod go-w /etc/services"

        cmd = "ls -al /etc/services 2>/dev/null"
        _, out, _ = self._run_shell(cmd)

        if not os.path.exists("/etc/services"):
            self.skipped(cid, name, Severity.MEDIUM, desc,
                         "/etc/services 없음", rec,
                         command=cmd, cmd_output="(파일 없음)")
            return

        r = self._stat("/etc/services")
        if r:
            perm, owner = r
            if int(perm, 8) & 0o022:
                self.vulnerable(cid, name, Severity.MEDIUM, desc,
                                f"/etc/services: Group/Other 쓰기 권한 있음 ({perm})", rec,
                                command=cmd, cmd_output=out or "(출력 없음)")
            else:
                self.safe(cid, name, Severity.MEDIUM, desc,
                          f"/etc/services: Group/Other 쓰기 권한 없음 (양호)",
                          rec, command=cmd, cmd_output=out or "(출력 없음)")
        else:
            self.manual(cid, name, Severity.MEDIUM, desc,
                        "/etc/services stat 실패", rec,
                        command=cmd, cmd_output=out or "(출력 없음)")

    def _b16(self):
        """2.16 부팅 스크립트 파일 권한 설정"""
        cid, name = "2.16", "부팅 스크립트 파일 권한 설정"
        desc = ("/etc/rc*.d/* 및 /etc/inittab 파일의 권한 중 Other에 쓰기 권한이 "
                "부여되어 있는지 점검합니다.")
        rec  = "chmod o-w [파일명 또는 디렉터리명]"

        cmd = "ls -al /etc/rc*.d/* 2>/dev/null; ls -al /etc/inittab 2>/dev/null"
        _, out, _ = self._run_shell(cmd, timeout=15)

        issues = []
        rc_dirs = glob.glob("/etc/rc*.d")
        for d in rc_dirs:
            if not os.path.isdir(d):
                continue
            for entry in os.listdir(d):
                fpath = os.path.join(d, entry)
                real = os.path.realpath(fpath) if os.path.islink(fpath) else fpath
                if not os.path.exists(real):
                    continue
                r = self._stat(real)
                if r:
                    perm, _ = r
                    if int(perm, 8) & 0o002:
                        issues.append(f"{real}: Other 쓰기 권한 있음 ({perm})")

        if os.path.exists("/etc/inittab"):
            r = self._stat("/etc/inittab")
            if r:
                perm, _ = r
                if int(perm, 8) & 0o002:
                    issues.append(f"/etc/inittab: Other 쓰기 권한 있음 ({perm})")

        if not rc_dirs and not os.path.exists("/etc/inittab"):
            self.skipped(cid, name, Severity.HIGH, desc,
                         "rc*.d, inittab 없음 — systemd 환경 N/A", rec,
                         command=cmd, cmd_output=out or "(파일 없음)")
            return

        if issues:
            self.vulnerable(cid, name, Severity.HIGH, desc,
                            f"Other 쓰기 권한 파일 {len(issues)}개:\n" + "\n".join(issues[:10]),
                            rec, command=cmd, cmd_output=out[:500] or "(출력 없음)")
        else:
            self.safe(cid, name, Severity.HIGH, desc,
                      "부팅 스크립트: Other 쓰기 권한 없음 (양호)",
                      rec, command=cmd, cmd_output=out[:500] or "(출력 없음)")

    def _b17(self):
        """2.17 /etc/hosts.allow, /etc/hosts.deny 설정"""
        cid, name = "2.17", "/etc/hosts.allow · /etc/hosts.deny 설정"
        desc = ("hosts.deny에 ALL:ALL 설정이 되어 있고, hosts.allow에 접근 허용 호스트가 "
                "설정되어 있는지 점검합니다.")
        rec  = ("/etc/hosts.deny: ALL: ALL\n"
                "/etc/hosts.allow: 허용할 서비스 및 호스트만 명시\n"
                "RHEL/CentOS 8 이상: iptables로 접근 제어")

        cmd = ("cat /etc/hosts.allow 2>/dev/null; echo '---'; "
               "cat /etc/hosts.deny 2>/dev/null; echo '---'; "
               "iptables -L 2>/dev/null | head -20")
        _, out, _ = self._run_shell(cmd, timeout=15)

        allow_ex = os.path.exists("/etc/hosts.allow")
        deny_ex  = os.path.exists("/etc/hosts.deny")

        if not allow_ex and not deny_ex:
            _, ipt_out, _ = self._run_shell("iptables -L 2>/dev/null | head -30")
            if ipt_out and "DROP" in ipt_out:
                self.safe(cid, name, Severity.LOW, desc,
                          "hosts.allow/deny 없음 — iptables DROP 정책 확인됨",
                          rec, command=cmd, cmd_output=out or ipt_out)
            else:
                self.manual(cid, name, Severity.LOW, desc,
                            "hosts.allow/deny 없음 — TCP Wrappers 미사용, iptables 정책 수동 확인 필요",
                            rec, command=cmd, cmd_output=out or "(출력 없음)")
            return

        deny_content = self._read_file("/etc/hosts.deny") or ""
        has_deny_all = any(
            "ALL" in l and not l.strip().startswith("#")
            for l in deny_content.splitlines()
        )
        if has_deny_all:
            self.safe(cid, name, Severity.LOW, desc,
                      "hosts.deny에 ALL 기본 차단 설정됨 (양호)",
                      rec, command=cmd, cmd_output=out or "(출력 없음)")
        else:
            self.vulnerable(cid, name, Severity.LOW, desc,
                            "hosts.deny에 'ALL: ALL' 기본 차단 미설정",
                            rec, command=cmd, cmd_output=out or "(출력 없음)")

    def _b18(self):
        """2.18 기타 중요 파일 권한 설정"""
        cid, name = "2.18", "기타 중요 파일 권한 설정"
        self.skipped(cid, name, Severity.MEDIUM,
                     "시스템 운영상 중요한 파일의 접근 권한을 점검합니다.",
                     "N/A — 해당 OS는 체크리스트에 포함하지 않음 (사양서 명시)",
                     "해당 없음")

    def _b19(self):
        """2.19 at 파일 소유자 및 권한 설정"""
        cid, name = "2.19", "at 파일 소유자 및 권한 설정"
        desc = ("/etc/at.allow, /etc/at.deny 파일의 소유자가 root이고 권한이 640 이하인지 점검합니다.")
        rec  = ("chown root /etc/at.allow && chmod 640 /etc/at.allow\n"
                "chown root /etc/at.deny  && chmod 640 /etc/at.deny")

        cmd = "ls -al /etc/at.allow 2>/dev/null; ls -al /etc/at.deny 2>/dev/null"
        _, out, _ = self._run_shell(cmd)

        found_any = False
        issues = []
        for path in ("/etc/at.allow", "/etc/at.deny"):
            if not os.path.exists(path):
                continue
            found_any = True
            r = self._stat(path)
            if r:
                perm, owner = r
                if owner != "root":
                    issues.append(f"{path}: 소유자 {owner} (root 권고)")
                if int(perm, 8) > 0o640:
                    issues.append(f"{path}: 권한 {perm} (640 초과)")

        if not found_any:
            self.skipped(cid, name, Severity.MEDIUM, desc,
                         "at.allow / at.deny 없음 — at 서비스 미사용 N/A", rec,
                         command=cmd, cmd_output="(파일 없음)")
            return

        if issues:
            self.vulnerable(cid, name, Severity.MEDIUM, desc, "\n".join(issues), rec,
                            command=cmd, cmd_output=out or "(출력 없음)")
        else:
            self.safe(cid, name, Severity.MEDIUM, desc,
                      "at 파일: 소유자 root, 권한 640 이하 (양호)",
                      rec, command=cmd, cmd_output=out or "(출력 없음)")

    def _b20(self):
        """2.20 hosts.lpd 파일 소유자 및 권한 설정"""
        cid, name = "2.20", "hosts.lpd 파일 소유자 및 권한 설정"
        desc = "/etc/hosts.lpd 파일의 소유자가 root이고 권한이 600 이하인지 점검합니다."
        rec  = "chown root /etc/hosts.lpd && chmod 600 /etc/hosts.lpd"

        cmd = "ls -al /etc/hosts.lpd 2>/dev/null"
        _, out, _ = self._run_shell(cmd)

        if not os.path.exists("/etc/hosts.lpd"):
            self.skipped(cid, name, Severity.LOW, desc,
                         "/etc/hosts.lpd 없음 — LPD 미사용 N/A", rec,
                         command=cmd, cmd_output="(파일 없음)")
            return

        r = self._stat("/etc/hosts.lpd")
        if r:
            perm, owner = r
            issues = []
            if owner != "root":
                issues.append(f"소유자: {owner} (root 권고)")
            if int(perm, 8) > 0o600:
                issues.append(f"권한: {perm} (600 초과)")
            if issues:
                self.vulnerable(cid, name, Severity.LOW, desc, "\n".join(issues), rec,
                                command=cmd, cmd_output=out or "(출력 없음)")
            else:
                self.safe(cid, name, Severity.LOW, desc,
                          f"hosts.lpd: 소유자 root, 권한 {perm} (양호)",
                          rec, command=cmd, cmd_output=out or "(출력 없음)")

    def _b21(self):
        """2.21 /etc/(r)syslog.conf 파일 소유자 및 권한 설정"""
        cid, name = "2.21", "/etc/(r)syslog.conf 파일 소유자 및 권한 설정"
        desc = ("/etc/syslog.conf 또는 /etc/rsyslog.conf 파일의 소유자가 root이고 "
                "권한이 640 이하인지 점검합니다.")
        rec  = "chown root /etc/rsyslog.conf && chmod 640 /etc/rsyslog.conf"

        for path in ("/etc/syslog.conf", "/etc/rsyslog.conf"):
            cmd = f"ls -al {path} 2>/dev/null"
            _, out, _ = self._run_shell(cmd)
            if not os.path.exists(path):
                continue
            r = self._stat(path)
            if r:
                perm, owner = r
                issues = []
                if owner != "root":
                    issues.append(f"소유자: {owner} (root 권고)")
                if int(perm, 8) > 0o640:
                    issues.append(f"권한: {perm} (640 초과)")
                if issues:
                    self.vulnerable(cid, name, Severity.HIGH, desc, "\n".join(issues), rec,
                                    command=cmd, cmd_output=out or "(출력 없음)")
                else:
                    self.safe(cid, name, Severity.HIGH, desc,
                              f"{path}: 소유자 root, 권한 {perm} 이하 (양호)",
                              rec, command=cmd, cmd_output=out or "(출력 없음)")
                return

        self.skipped(cid, name, Severity.HIGH, desc,
                     "rsyslog.conf / syslog.conf 없음 — N/A", rec,
                     command="ls -al /etc/rsyslog.conf", cmd_output="(파일 없음)")

    def _b22(self):
        """2.22 world writable 파일 점검"""
        cid, name = "2.22", "world writable 파일 점검"
        desc = ("로그인 가능한 계정의 홈 디렉터리 내 world writable 파일이 있는지 점검합니다.")
        rec  = "chmod o-w <파일명> 으로 other 쓰기 권한 제거 또는 rm -rf <파일명>"

        # 로그인 가능 계정 확인
        cmd1 = 'cat /etc/passwd | grep "bash"'
        _, out1, _ = self._run_shell(cmd1)

        # 홈 디렉터리별 world writable 파일 탐색
        home_dirs = []
        passwd = self._read_file("/etc/passwd") or ""
        for line in passwd.splitlines():
            parts = line.split(":")
            if len(parts) >= 7 and "bash" in parts[6] and parts[5] and parts[5] != "/":
                home_dirs.append(parts[5])

        all_ww = []
        cmd2_parts = []
        for home in home_dirs[:5]:
            if not os.path.isdir(home):
                continue
            cp = f"find {home}/ -type f -perm -2 -exec ls -l {{}} \\; 2>/dev/null"
            cmd2_parts.append(cp)
            _, ww_out, _ = self._run_shell(cp, timeout=15)
            all_ww.extend(l for l in ww_out.splitlines() if l.strip())

        cmd2 = "\n".join(cmd2_parts) if cmd2_parts else \
               "find /home/ -type f -perm -2 -exec ls -l {} \\; 2>/dev/null"
        combined_cmd = f"# 로그인 가능 계정 확인\n{cmd1}\n\n# world writable 파일 점검\n{cmd2}"
        combined_out = (f"[bash 사용 계정]\n{out1 or '(없음)'}\n\n"
                        f"[world writable 파일]\n" + ("\n".join(all_ww[:20]) if all_ww else "(없음)"))

        if all_ww:
            self.vulnerable(cid, name, Severity.HIGH, desc,
                            f"world writable 파일 {len(all_ww)}개:\n" + "\n".join(all_ww[:10]),
                            rec, command=combined_cmd, cmd_output=combined_out)
        else:
            self.safe(cid, name, Severity.HIGH, desc,
                      "world writable 파일 없음 (양호)",
                      rec, command=combined_cmd, cmd_output=combined_out)

    def _b23(self):
        """2.23 /dev에 존재하지 않는 device 파일 점검"""
        cid, name = "2.23", "/dev에 존재하지 않는 device 파일 점검"
        desc = ("/dev 디렉터리에 장치 파일(block/char)이 아닌 일반 파일(-type f)이 "
                "존재하는지 점검합니다.")
        rec  = "/dev 내 일반 파일 확인 후 불필요한 파일 삭제 (담당자 확인 후 조치)"

        cmd = "find /dev -type f -exec ls -l {} \\; 2>/dev/null"
        _, out, _ = self._run_shell(cmd, timeout=15)
        files = [l.strip() for l in out.splitlines() if l.strip()]

        if files:
            self.vulnerable(cid, name, Severity.HIGH, desc,
                            f"/dev 내 일반 파일 {len(files)}개:\n" + "\n".join(files[:15]),
                            rec, command=cmd, cmd_output=out[:500] or "(출력 없음)")
        else:
            self.safe(cid, name, Severity.HIGH, desc,
                      "/dev 내 일반 파일 없음 (양호)",
                      rec, command=cmd, cmd_output=out or "(출력 없음)")

    def _b24(self):
        """2.24 시스템 시작 스크립트 권한 설정 (U-17 신규 — 2026)"""
        cid, name = "2.24", "시스템 시작 스크립트 권한 설정"
        desc = ("/etc/rc.d, /etc/init.d 시작 스크립트가 root 소유이고 "
                "other 쓰기 권한이 없는지(750 이하) 점검합니다.\n"
                "초기 부팅 단계 백도어 설치(persistence) 방지 목적")
        rec  = ("chown root /etc/rc.d/* /etc/init.d/*\n"
                "chmod o-rwx /etc/rc.d/* /etc/init.d/*  (750 이하 유지)")

        issues, any_found = [], False
        cmd_parts, out_parts = [], []

        for dir_path in ("/etc/rc.d", "/etc/init.d"):
            cmd = f"ls -al {dir_path} 2>/dev/null"
            cmd_parts.append(cmd)
            rc2, dir_out, _ = self._run_shell(cmd)
            out_parts.append(f"[{dir_path}]\n{dir_out or '(없음)'}")
            if rc2 != 0 or not dir_out.strip():
                continue
            for line in dir_out.splitlines():
                parts = line.split()
                if len(parts) < 4 or line.startswith("total"):
                    continue
                fname = parts[-1]
                if fname in (".", ".."):
                    continue
                perm_str, owner = parts[0], parts[2]
                any_found = True
                if owner != "root":
                    issues.append(f"{dir_path}/{fname}: 소유자 {owner} (root 권고)")
                # other 쓰기 비트 확인 (perm_str 인덱스 8 = other write)
                if len(perm_str) >= 10 and perm_str[8] == "w":
                    issues.append(f"{dir_path}/{fname}: other 쓰기 권한 ({perm_str})")

        combined_cmd = "\n".join(cmd_parts)
        combined_out = "\n\n".join(out_parts)

        if not any_found:
            self.skipped(cid, name, Severity.HIGH, desc,
                         "/etc/rc.d, /etc/init.d 없음 — N/A (systemd 전용 환경)",
                         rec, command=combined_cmd, cmd_output=combined_out)
            return

        if issues:
            self.vulnerable(cid, name, Severity.HIGH, desc,
                            f"권한 문제 {len(issues)}건:\n" + "\n".join(issues[:15]),
                            rec, command=combined_cmd, cmd_output=combined_out)
        else:
            self.safe(cid, name, Severity.HIGH, desc,
                      "시작 스크립트 소유자(root) 및 권한(other 쓰기 없음) 양호",
                      rec, command=combined_cmd, cmd_output=combined_out)

    # ══════════════════════════════════════════════════════════
    # 3. 네트워크 서비스
    # ══════════════════════════════════════════════════════════

    def _c01(self):
        """3.1 RPC 서비스 제한"""
        cid, name = "3.1", "RPC 서비스 제한"
        desc = ("불필요한 RPC 서비스(ttdb, cmsd, rstatd, sadmind, rexd 등)가 "
                "실행 중인지 점검합니다.")
        rec  = ("chkconfig --level 0123456 nfs off\n"
                "chkconfig --level 0123456 portmap off (또는 rpcbind off)")

        cmd1 = ("cat /etc/inetd.conf 2>/dev/null | grep -v '^#' | "
                "egrep 'ttdb|cmsd|rstartd|sadmind|rusersd|rexd|rwalld|sprayd|kcms_server|cachefsd'")
        cmd2 = ("chkconfig --list 2>/dev/null | "
                "egrep 'nfs|nfslock|portmap|rpcbind|rpcidmapd' | "
                "egrep -v 'umountnfs.sh' | egrep ':on|:활성'")
        combined_cmd = f"# inetd.conf RPC 서비스 확인\n{cmd1}\n\n# 부팅 스크립트 확인\n{cmd2}"
        _, out1, _ = self._run_shell(cmd1)
        _, out2, _ = self._run_shell(cmd2)

        # 추가: ps로 실행 중인 RPC 프로세스 확인
        _, ps_out, _ = self._run_shell(
            "ps -ef 2>/dev/null | grep -E 'rpc\\.statd|rpcbind|portmap|nfsd' | grep -v grep")
        combined_out = (f"[inetd.conf RPC 서비스]\n{out1 or '(없음)'}\n\n"
                        f"[chkconfig RPC 서비스]\n{out2 or '(없음 또는 systemd 환경)'}\n\n"
                        f"[실행 중 프로세스]\n{ps_out or '(없음)'}")

        found = bool(out1.strip()) or bool(out2.strip()) or bool(ps_out.strip())
        if found:
            self.vulnerable(cid, name, Severity.MEDIUM, desc,
                            "RPC 관련 서비스 실행 중 — 미사용 서비스 제거 필요",
                            rec, command=combined_cmd, cmd_output=combined_out)
        else:
            self.safe(cid, name, Severity.MEDIUM, desc,
                      "RPC 서비스 미실행 (양호)",
                      rec, command=combined_cmd, cmd_output=combined_out)

    def _c02(self):
        """3.2 NFS 제한"""
        cid, name = "3.2", "NFS 제한"
        desc = ("NFS 서비스 실행 여부 및 /etc/exports의 everyone 공유 설정을 점검합니다.")
        rec  = ("NFS 미사용 시: NFS 데몬(nfsd, statd, lockd) 중지\n"
                "사용 시: /etc/exports에서 everyone(*) 마운트 제거, 인가된 IP만 허용")

        cmd1 = "ps -ef 2>/dev/null | grep nfsd | grep -v 'grep'"
        cmd2 = "cat /etc/exports 2>/dev/null | grep -v '^#' | grep 'everyone'"
        combined_cmd = f"{cmd1}\n{cmd2}"
        _, out1, _ = self._run_shell(cmd1)
        _, out2, _ = self._run_shell(cmd2)
        combined_out = (f"[nfsd 프로세스]\n{out1 or '(없음)'}\n\n"
                        f"[exports everyone 설정]\n{out2 or '(없음)'}")

        nfsd_running = bool(out1.strip())
        everyone_set = bool(out2.strip())

        if not nfsd_running:
            self.safe(cid, name, Severity.HIGH, desc,
                      "NFS 서비스(nfsd) 미실행 (양호)",
                      rec, command=combined_cmd, cmd_output=combined_out)
        elif everyone_set:
            self.vulnerable(cid, name, Severity.HIGH, desc,
                            "NFS 실행 중 + everyone으로 마운트 허용:\n" + out2,
                            rec, command=combined_cmd, cmd_output=combined_out)
        else:
            self.manual(cid, name, Severity.HIGH, desc,
                        "NFS 실행 중 — everyone 마운트 없음, 인가된 시스템 목록 수동 확인 필요",
                        rec, command=combined_cmd, cmd_output=combined_out)

    def _c03(self):
        """3.3 Automountd 서비스 제거"""
        cid, name = "3.3", "Automountd 서비스 제거"
        desc = "Automount 데몬(autofs/automountd)이 실행 중인지 점검합니다."
        rec  = "chkconfig --level 0123456 autofs off (또는 systemctl disable --now autofs)"

        cmd = r"ps -ef 2>/dev/null | grep 'automount\|autofs' | grep -v grep"
        _, out, _ = self._run_shell(cmd)
        if out.strip():
            self.vulnerable(cid, name, Severity.LOW, desc,
                            f"Automountd 서비스 실행 중:\n{out}",
                            rec, command=cmd, cmd_output=out)
        else:
            self.safe(cid, name, Severity.LOW, desc,
                      "Automountd 서비스 미실행 (양호)",
                      rec, command=cmd, cmd_output=out or "(출력 없음)")

    def _c04(self):
        """3.4 NIS 제한"""
        cid, name = "3.4", "NIS 제한"
        desc = "NIS(ypbind/ypserv 등) 서비스가 실행 중인지 점검합니다."
        rec  = "NIS 서비스 중지 및 부팅 스크립트에서 제거"

        cmd = r"ps -ef 2>/dev/null | grep -E 'Ypserv|Ypbind|rpc\.yppasswd|ypxfrd|rpc\.ypupdated' | grep -v grep"
        _, out, _ = self._run_shell(cmd)
        if out.strip():
            self.vulnerable(cid, name, Severity.HIGH, desc,
                            f"NIS 서비스 실행 중:\n{out}",
                            rec, command=cmd, cmd_output=out)
        else:
            self.safe(cid, name, Severity.HIGH, desc,
                      "NIS 서비스 미실행 (양호)",
                      rec, command=cmd, cmd_output=out or "(출력 없음)")

    def _c05(self):
        """3.5 'r' commands 서비스 제거"""
        cid, name = "3.5", "'r' commands 서비스 제거"
        desc = ("rsh, rlogin, rexec 등 'r' commands 서비스가 실행 중이거나 "
                "hosts.equiv/.rhosts에 '+' 설정이 있는지 점검합니다.")
        rec  = ("inetd.conf에서 rsh/rlogin/rexec 서비스 제거 또는 주석 처리\n"
                "/etc/hosts.equiv: '+' 설정 제거, 소유자 root, 권한 400\n"
                "$HOME/.rhosts: '+' 설정 제거, 소유자 root, 권한 400")

        cmd1 = ("cat /etc/inetd.conf 2>/dev/null | grep -v '^ *#' | "
                "egrep 'shell|rlogin|rexec' | egrep -v 'grep|klogin|kshell|kexec'")
        cmd2 = "ls -al /etc/hosts.equiv 2>/dev/null"
        cmd3 = "ls -al /root/.rhosts 2>/dev/null"
        combined_cmd = (f"# r command 서비스 확인\n{cmd1}\n\n"
                        f"# hosts.equiv 권한\n{cmd2}\n\n"
                        f"# .rhosts 권한\n{cmd3}")
        _, out1, _ = self._run_shell(cmd1)
        _, out2, _ = self._run_shell(cmd2)
        _, out3, _ = self._run_shell(cmd3)
        combined_out = (f"[inetd.conf r command]\n{out1 or '(없음)'}\n\n"
                        f"[hosts.equiv]\n{out2 or '(없음)'}\n\n"
                        f"[.rhosts]\n{out3 or '(없음)'}")

        issues = []
        if out1.strip():
            issues.append(f"inetd에 r 계열 서비스 설정:\n{out1.strip()}")

        # hosts.equiv '+' 설정 확인
        equiv_content = self._read_file("/etc/hosts.equiv") or ""
        for line in equiv_content.splitlines():
            if line.strip() == "+" or line.strip().startswith("+ "):
                issues.append(f"/etc/hosts.equiv: '+' 설정 존재 ({line.strip()})")

        # .rhosts '+' 설정 확인
        rhosts_content = self._read_file("/root/.rhosts") or ""
        for line in rhosts_content.splitlines():
            if line.strip() == "+" or "+ " in line.strip():
                issues.append(f"/root/.rhosts: '+' 설정 존재 ({line.strip()})")

        # 포트로 r 서비스 확인
        ss = self._ss()
        for port, svc in {":512": "rexec", ":513": "rlogin", ":514": "rsh"}.items():
            if port in ss:
                issues.append(f"r 계열 서비스 포트 열림: {svc}(port {port.lstrip(':')})")

        if issues:
            self.vulnerable(cid, name, Severity.CRITICAL, desc,
                            "\n".join(issues), rec,
                            command=combined_cmd, cmd_output=combined_out)
        else:
            self.safe(cid, name, Severity.CRITICAL, desc,
                      "r commands 서비스 미실행, hosts.equiv/.rhosts '+' 설정 없음 (양호)",
                      rec, command=combined_cmd, cmd_output=combined_out)

    def _c06(self):
        """3.6 불필요한 서비스 제거"""
        cid, name = "3.6", "불필요한 서비스 제거"
        desc = ("echo, chargen, finger, tftp 등 불필요·취약 서비스가 실행 중인지 점검합니다.\n"
                "진단 방법: 담당자 인터뷰를 통한 불필요한 서비스 확인이 필요합니다.")
        rec  = ("불필요한 서비스 제거:\n"
                "chkconfig --level 0123456 [서비스명] off\n"
                "또는 /etc/(x)inetd.conf에서 해당 서비스 주석 처리")

        cmd = "ss -tlnup 2>/dev/null || netstat -tlnup 2>/dev/null"
        _, out, _ = self._run_shell(cmd)
        ss = out

        dangerous = {
            ":7": "echo", ":9": "discard", ":13": "daytime",
            ":19": "chargen", ":37": "time", ":69": "tftp",
            ":79": "finger", ":119": "nntp", ":138": "netbios-dgm",
            ":517": "talk", ":518": "ntalk", ":540": "uucp",
        }
        found = [f"{svc}(:{p.lstrip(':')})" for p, svc in dangerous.items() if p in ss]
        if found:
            self.vulnerable(cid, name, Severity.MEDIUM, desc,
                            f"불필요 서비스 실행 중: {', '.join(found)}\n담당자 확인 필요",
                            rec, command=cmd, cmd_output=out[:500] or "(출력 없음)")
        else:
            self.manual(cid, name, Severity.MEDIUM, desc,
                        "Black list 서비스 미발견 — 담당자 인터뷰를 통한 추가 확인 필요",
                        rec, command=cmd, cmd_output=out[:500] or "(출력 없음)")

    def _c07(self):
        """3.7 서비스 Banner 관리"""
        cid, name = "3.7", "서비스 Banner 관리"
        desc = ("SSH, Telnet, FTP, SMTP, DNS 서비스 배너에 O/S 및 버전 정보가 "
                "노출되는지 점검합니다.")
        rec  = ("각 서비스 설정 파일에서 버전/OS 정보 제거 후 경고 문구 삽입\n"
                "SSH: /etc/motd에 경고 문구 | Telnet: /etc/issue.net | "
                "FTP: vsftpd.conf ftpd_banner 설정")

        cmd = ("echo '=== [SSH motd] ==='; cat /etc/motd 2>/dev/null; "
               "echo '=== [Telnet issue.net] ==='; cat /etc/issue.net 2>/dev/null; "
               "echo '=== [FTP vsftpd.conf] ==='; "
               "grep -i 'ftpd_banner\\|serverident' /etc/vsftpd/vsftpd.conf 2>/dev/null; "
               "echo '=== [SMTP sendmail.cf] ==='; "
               "grep -i 'SmtpGreetingMessage' /etc/mail/sendmail.cf 2>/dev/null; "
               "echo '=== [DNS named.conf] ==='; "
               "grep -i 'version' /etc/named.conf 2>/dev/null | head -3")
        _, out, _ = self._run_shell(cmd, timeout=10)

        sensitive = ["ubuntu", "debian", "centos", "red hat", "fedora",
                     "kernel", "release", "version", "linux"]
        issues = []
        for path in ("/etc/issue", "/etc/issue.net", "/etc/motd"):
            content = (self._read_file(path) or "").lower()
            found = [k for k in sensitive if k in content]
            if found:
                issues.append(f"{path}: {', '.join(found)} 정보 노출")

        if issues:
            self.vulnerable(cid, name, Severity.MEDIUM, desc,
                            "\n".join(issues), rec,
                            command=cmd, cmd_output=out[:800] or "(출력 없음)")
        else:
            self.safe(cid, name, Severity.MEDIUM, desc,
                      "배너에 O/S 및 버전 정보 미노출 (양호)",
                      rec, command=cmd, cmd_output=out[:800] or "(출력 없음)")

    def _c08(self):
        """3.8 session timeout 설정"""
        cid, name = "3.8", "session timeout 설정"
        desc = "사용하지 않는 세션에 대한 timeout이 300초로 설정되어 있는지 점검합니다."
        rec  = ("/etc/profile: TMOUT=300 및 export TMOUT 추가\n"
                "csh/tcsh: /etc/.login에 set autologout=5")

        cmd1 = "cat /etc/profile | grep 'TMOUT'"
        cmd2 = "cat /etc/.login 2>/dev/null | grep 'autologout'"
        combined_cmd = f"# sh/ksh/bash 세션 타임아웃\n{cmd1}\n\n# csh/tcsh 세션 타임아웃\n{cmd2}"
        _, out1, _ = self._run_shell(cmd1)
        _, out2, _ = self._run_shell(cmd2)
        combined_out = (f"[/etc/profile TMOUT]\n{out1 or '(없음)'}\n\n"
                        f"[/etc/.login autologout]\n{out2 or '(없음)'}")

        issues = []
        tmout_set = False
        for line in out1.splitlines():
            if "TMOUT" in line and not line.strip().startswith("#"):
                m = re.search(r"TMOUT\s*=\s*(\d+)", line)
                if m:
                    val = int(m.group(1))
                    if val != 300:
                        issues.append(f"TMOUT={val} (300초 권고)")
                    tmout_set = True

        if not tmout_set:
            for p in ("/etc/bashrc", "/etc/bash.bashrc", "/etc/profile.d/timeout.sh"):
                c = self._read_file(p) or ""
                if "TMOUT" in c:
                    tmout_set = True
                    break

        if not tmout_set:
            issues.append("TMOUT 미설정 — 세션 자동 종료 없음")

        autologout_set = bool(out2.strip())
        if issues and not autologout_set:
            self.vulnerable(cid, name, Severity.LOW, desc,
                            "\n".join(issues), rec,
                            command=combined_cmd, cmd_output=combined_out)
        else:
            self.safe(cid, name, Severity.LOW, desc,
                      f"세션 타임아웃 설정됨 (TMOUT {'설정' if tmout_set else '미설정'}, "
                      f"autologout {'설정' if autologout_set else '미설정'})",
                      rec, command=combined_cmd, cmd_output=combined_out)

    def _c09(self):
        """3.9 root 계정 telnet·SSH 접근 제한"""
        cid, name = "3.9", "root 계정 telnet·SSH 접근 제한"
        desc = "원격 접속(telnet, ssh) 시 root의 직접 접속이 불가능하도록 설정되어 있는지 점검합니다."
        rec  = ("[SSH] sshd_config: PermitRootLogin no 설정 후 sshd 재시작\n"
                "[Telnet] /etc/pam.d/login: pam_securetty.so 활성화\n"
                "/etc/securetty에서 pts 항목 제거")

        cmd1 = "cat /etc/security/user 2>/dev/null | grep -v '^#' | grep -i 'rlogin' | grep -i 'false'"
        cmd2 = "cat /etc/ssh/sshd_config 2>/dev/null | grep -v '^#' | grep -i 'PermitRootLogin' | grep -i 'no'"
        combined_cmd = f"# Telnet root 접근 설정\n{cmd1}\n\n# SSH root 접근 설정\n{cmd2}"
        _, out1, _ = self._run_shell(cmd1)
        _, out2, _ = self._run_shell(cmd2)
        combined_out = (f"[/etc/security/user rlogin]\n{out1 or '(없음)'}\n\n"
                        f"[sshd_config PermitRootLogin no]\n{out2 or '(없음)'}")

        issues = []
        # SSH PermitRootLogin 확인
        sshd = self._read_file("/etc/ssh/sshd_config") or ""
        prl = None
        for line in sshd.splitlines():
            s = line.strip()
            if s.startswith("PermitRootLogin") and not s.startswith("#"):
                prl = s.split()[-1].lower()
                break
        if prl not in ("no", "forced-commands-only"):
            issues.append(f"SSH PermitRootLogin={prl or '미설정(기본 허용)'} — no 권고")

        # telnet: securetty pts 확인
        securetty = self._read_file("/etc/securetty") or ""
        pts_lines = [l for l in securetty.splitlines()
                     if l.startswith("pts/") and not l.startswith("#")]
        if pts_lines:
            issues.append(f"/etc/securetty에 pts 항목 존재 (root telnet 가능): {', '.join(pts_lines[:3])}")

        if issues:
            self.vulnerable(cid, name, Severity.CRITICAL, desc,
                            "\n".join(issues), rec,
                            command=combined_cmd, cmd_output=combined_out)
        else:
            self.safe(cid, name, Severity.CRITICAL, desc,
                      "root 원격 직접 접속 제한 적용됨 (양호)",
                      rec, command=combined_cmd, cmd_output=combined_out)

    def _c10(self):
        """3.10 DNS 보안 버전 패치"""
        cid, name = "3.10", "DNS 보안 버전 패치"
        desc = ("DNS 서비스(BIND) 사용 여부 및 주기적 보안 패치 관리 여부를 점검합니다.\n"
                "2022.01 기준 안전 버전: BIND 9.16.25 이상")
        rec  = ("최신 BIND 버전으로 업그레이드\n"
                "named.conf: version \"unknown\"; 으로 버전 정보 숨김\n"
                "참고: https://www.isc.org/bind/")

        cmd1 = "ps -ef 2>/dev/null | grep named | grep -v grep"
        cmd2 = "named -v 2>/dev/null"
        combined_cmd = f"{cmd1}\n{cmd2}"
        _, out1, _ = self._run_shell(cmd1)
        _, out2, _ = self._run_shell(cmd2)
        combined_out = (f"[named 프로세스]\n{out1 or '(없음)'}\n\n"
                        f"[BIND 버전]\n{out2 or '(확인 불가)'}")

        if not out1.strip():
            self.skipped(cid, name, Severity.HIGH, desc,
                         "BIND DNS(named) 미실행 — N/A", rec,
                         command=combined_cmd, cmd_output=combined_out)
            return

        self.manual(cid, name, Severity.HIGH, desc,
                    f"BIND 실행 중: {out2.strip() or '버전 확인 불가'}\n"
                    "최신 보안 버전 여부는 https://www.isc.org/bind/ 에서 수동 확인 필요",
                    rec, command=combined_cmd, cmd_output=combined_out)

    def _c11(self):
        """3.11 DNS 동적 업데이트 설정 금지 (U-51 신규 — 2026)"""
        cid, name = "3.11", "DNS 서비스 취약한 동적 업데이트 설정 금지"
        desc = ("named.conf에서 allow-update가 any로 설정되어 누구나 DNS 레코드를 "
                "수정할 수 있는지 점검합니다.")
        rec  = ("named.conf에서 allow-update를 none 또는 인가된 IP로 제한:\n"
                "  allow-update { none; };\n"
                "  또는  allow-update { 192.168.1.0/24; };")

        named_paths = ["/etc/named.conf", "/etc/bind/named.conf",
                       "/etc/named/named.conf", "/usr/local/etc/named.conf"]
        content = ""
        found_path = ""
        for p in named_paths:
            c = self._read_file(p)
            if c:
                content = c
                found_path = p
                break

        cmd = f"cat {found_path or '/etc/named.conf'} 2>/dev/null"
        _, out, _ = self._run_shell(cmd)

        # named 미실행 여부 확인
        rc_ps, ps_out, _ = self._run_shell("ps -ef 2>/dev/null | grep named | grep -v grep")
        if not ps_out.strip() and not content:
            self.skipped(cid, name, Severity.HIGH, desc,
                         "BIND DNS(named) 미실행 — N/A",
                         rec, command=cmd, cmd_output=out or "(없음)")
            return

        if not content:
            self.manual(cid, name, Severity.HIGH, desc,
                        "named.conf 읽기 실패 — 수동 확인 필요",
                        rec, command=cmd, cmd_output=out or "")
            return

        # allow-update any 확인
        vuln = []
        for line in content.splitlines():
            s = line.strip().lower()
            if s.startswith("#") or s.startswith("//"):
                continue
            if "allow-update" in s and "any" in s and "none" not in s:
                vuln.append(line.strip())

        if vuln:
            self.vulnerable(cid, name, Severity.HIGH, desc,
                            f"allow-update any 설정 발견 ({found_path}):\n" + "\n".join(vuln),
                            rec, command=cmd, cmd_output=content[:500])
        else:
            self.safe(cid, name, Severity.HIGH, desc,
                      f"allow-update 취약 설정 없음 ({found_path or '파일 없음'})",
                      rec, command=cmd, cmd_output=content[:300] or out or "(없음)")

    def _c12(self):
        """3.12 Telnet 서비스 비활성화 (U-52 신규 — 2026)"""
        cid, name = "3.12", "Telnet 서비스 비활성화"
        desc = ("Telnet은 평문 통신 프로토콜로 도청·세션 가로채기에 취약합니다.\n"
                "Telnet 서비스 실행 여부 및 23번 포트 리스닝 상태를 점검합니다.")
        rec  = ("Telnet 비활성화:\n"
                "  systemctl disable --now telnet.socket\n"
                "  또는 xinetd telnet 서비스 disable\n"
                "SSH(22) 사용으로 대체 권고")

        cmd1 = "ps -ef 2>/dev/null | grep -E 'telnet|telnetd' | grep -v grep"
        cmd2 = "systemctl is-active telnet.socket 2>/dev/null"
        cmd3 = "ss -tlnp 2>/dev/null | grep ':23'"
        combined_cmd = f"{cmd1}\n{cmd2}\n{cmd3}"
        _, out1, _ = self._run_shell(cmd1)
        _, out2, _ = self._run_shell(cmd2)
        _, out3, _ = self._run_shell(cmd3)
        combined_out = (f"[telnet 프로세스]\n{out1 or '(없음)'}\n\n"
                        f"[systemctl 상태]\n{out2 or '(inactive/없음)'}\n\n"
                        f"[23포트 리스닝]\n{out3 or '(없음)'}")

        telnet_running = (out1.strip() or out2.strip() == "active" or out3.strip())
        if telnet_running:
            self.vulnerable(cid, name, Severity.HIGH, desc,
                            "Telnet 서비스 실행 중 또는 23번 포트 리스닝",
                            rec, command=combined_cmd, cmd_output=combined_out)
        else:
            self.safe(cid, name, Severity.HIGH, desc,
                      "Telnet 서비스 미실행 (양호)",
                      rec, command=combined_cmd, cmd_output=combined_out)

    def _c13(self):
        """3.13 FTP 보안 강화 (U-53/54/55 신규 — 2026)"""
        cid, name = "3.13", "FTP 서비스 보안 강화 (정보노출·암호화·접근제어)"
        desc = ("vsftpd.conf 점검:\n"
                "  U-53: FTP 배너 정보 노출 제한 (ftpd_banner 설정)\n"
                "  U-54: 암호화되지 않은 FTP 비활성화 (ssl_enable=YES)\n"
                "  U-55: FTP 접근 제어 (tcp_wrappers/hosts_access)")
        rec  = ("vsftpd.conf:\n"
                "  ftpd_banner=FTP Service  (버전·OS 정보 노출 금지)\n"
                "  ssl_enable=YES / rsa_cert_file=/etc/ssl/certs/...  (FTPS 활성화)\n"
                "  tcp_wrappers=YES  (접근 제어 활성화)\n"
                "  /etc/hosts.allow: vsftpd: <허용IP>")

        ftp_conf = None
        for p in ("/etc/vsftpd.conf", "/etc/vsftpd/vsftpd.conf"):
            c = self._read_file(p)
            if c:
                ftp_conf = (p, c)
                break

        cmd = f"cat {ftp_conf[0] if ftp_conf else '/etc/vsftpd.conf'} 2>/dev/null"
        _, out, _ = self._run_shell(cmd)

        if ftp_conf is None:
            self.skipped(cid, name, Severity.MEDIUM, desc,
                         "vsftpd 미설치 또는 설정 파일 없음 — N/A",
                         rec, command=cmd, cmd_output=out or "(없음)")
            return

        path, content = ftp_conf
        issues = []

        # U-53: ftpd_banner 설정 확인 (기본값은 서버 버전 포함)
        has_banner = any("ftpd_banner" in l and not l.strip().startswith("#")
                         for l in content.splitlines())
        if not has_banner:
            issues.append("U-53: ftpd_banner 미설정 — FTP 배너에 버전 정보 노출 가능")

        # U-54: SSL/TLS 활성화 여부
        ssl_enabled = any("ssl_enable=yes" in l.lower() and not l.strip().startswith("#")
                          for l in content.splitlines())
        if not ssl_enabled:
            issues.append("U-54: ssl_enable=NO — 평문 FTP 사용 중 (FTPS 미적용)")

        # U-55: tcp_wrappers 또는 접근 제어
        tcp_wrap = any("tcp_wrappers=yes" in l.lower() and not l.strip().startswith("#")
                       for l in content.splitlines())
        hosts_allow = self._read_file("/etc/hosts.allow") or ""
        has_ftp_acl = tcp_wrap or "vsftpd" in hosts_allow or "ftp" in hosts_allow
        if not has_ftp_acl:
            issues.append("U-55: FTP 접근 제어(tcp_wrappers, hosts.allow) 미설정")

        if issues:
            self.vulnerable(cid, name, Severity.MEDIUM, desc,
                            f"{path} 설정 문제:\n" + "\n".join(issues),
                            rec, command=cmd, cmd_output=content[:600] or out)
        else:
            self.safe(cid, name, Severity.MEDIUM, desc,
                      "FTP 배너 제한·SSL·접근 제어 모두 양호",
                      rec, command=cmd, cmd_output=content[:400] or out)

    def _c14(self):
        """3.14 SNMP 보안 설정 (U-59/61 신규 — 2026)"""
        cid, name = "3.14", "안전한 SNMP 버전 및 접근 제어 설정"
        desc = ("SNMP 서비스 사용 시 SNMPv3 사용 여부와 접근 제어(ACL) 설정을 점검합니다.\n"
                "  U-59: 안전한 SNMP 버전 사용 (v3 권고)\n"
                "  U-61: SNMP Access Control 설정 (community string default 변경)")
        rec  = ("snmpd.conf:\n"
                "  SNMPv3 사용: createUser authUser MD5 <passwd> DES <enckey>\n"
                "  community string 기본값(public/private) 변경 또는 제거\n"
                "  com2sec 로 접근 IP 제한: com2sec local localhost <community>")

        snmp_conf = None
        for p in ("/etc/snmp/snmpd.conf", "/etc/snmpd.conf"):
            c = self._read_file(p)
            if c:
                snmp_conf = (p, c)
                break

        cmd1 = "ps -ef 2>/dev/null | grep snmpd | grep -v grep"
        _, ps_out, _ = self._run_shell(cmd1)
        cmd2 = f"cat {snmp_conf[0] if snmp_conf else '/etc/snmp/snmpd.conf'} 2>/dev/null"
        _, out, _ = self._run_shell(cmd2)

        if not ps_out.strip() and snmp_conf is None:
            self.skipped(cid, name, Severity.HIGH, desc,
                         "SNMP(snmpd) 미실행 — N/A",
                         rec, command=f"{cmd1}\n{cmd2}", cmd_output=f"[snmpd]\n{ps_out or '(없음)'}")
            return

        if snmp_conf is None:
            self.manual(cid, name, Severity.HIGH, desc,
                        "snmpd.conf 읽기 실패 — 수동 확인 필요",
                        rec, command=f"{cmd1}\n{cmd2}", cmd_output=ps_out or "")
            return

        path, content = snmp_conf
        issues = []

        # U-59: SNMPv3 사용 여부
        has_v3 = any("createUser" in l or "rouser" in l or "rwuser" in l
                     for l in content.splitlines()
                     if not l.strip().startswith("#"))
        # v1/v2c만 사용 중인지 확인
        has_v1v2 = any("rocommunity" in l.lower() or "rwcommunity" in l.lower()
                       for l in content.splitlines()
                       if not l.strip().startswith("#"))

        if not has_v3:
            issues.append("U-59: SNMPv3 설정 없음 — v1/v2c는 평문 community string 사용으로 취약")

        # U-61: 기본 community string 사용 여부
        for line in content.splitlines():
            s = line.strip().lower()
            if s.startswith("#"):
                continue
            if ("rocommunity public" in s or "rwcommunity public" in s or
                    "rocommunity private" in s or "rwcommunity private" in s):
                issues.append(f"U-61: 기본 community string 사용 중: {line.strip()}")

        if issues:
            self.vulnerable(cid, name, Severity.HIGH, desc,
                            "\n".join(issues),
                            rec, command=f"{cmd1}\n{cmd2}",
                            cmd_output=f"[snmpd 프로세스]\n{ps_out}\n\n[{path}]\n{content[:500]}")
        else:
            self.safe(cid, name, Severity.HIGH, desc,
                      f"SNMP v3 설정 및 기본 community string 미사용 양호 ({path})",
                      rec, command=f"{cmd1}\n{cmd2}",
                      cmd_output=f"[snmpd]\n{ps_out}\n\n[{path}]\n{content[:300]}")

    def _c15(self):
        """3.15 sudo 명령어 접근 관리 (U-63 신규 — 2026)"""
        cid, name = "3.15", "sudo 명령어 접근 관리"
        desc = ("/etc/sudoers에서 ALL=(ALL) ALL 또는 NOPASSWD 설정으로 "
                "불필요한 sudo 권한이 부여되어 있는지 점검합니다.")
        rec  = ("visudo로 편집:\n"
                "  특정 명령만 허용: username ALL=(ALL) /usr/bin/systemctl\n"
                "  NOPASSWD 제거 또는 최소 범위로 제한\n"
                "  %wheel ALL=(ALL) ALL  (wheel 그룹만 허용)")

        cmd = "cat /etc/sudoers 2>/dev/null; cat /etc/sudoers.d/* 2>/dev/null"
        _, out, _ = self._run_shell(cmd)

        if not out.strip():
            self.manual(cid, name, Severity.MEDIUM, desc,
                        "/etc/sudoers 읽기 실패 — root 권한으로 수동 확인 필요",
                        rec, command=cmd, cmd_output="")
            return

        issues = []
        for line in out.splitlines():
            s = line.strip()
            if s.startswith("#") or not s:
                continue
            # ALL=(ALL) ALL 설정 (root가 아닌 일반 계정에)
            if "ALL=(ALL) ALL" in s and not s.startswith("root") and not s.startswith("%wheel"):
                issues.append(f"광범위한 sudo 권한: {s}")
            # NOPASSWD 설정
            if "NOPASSWD" in s and not s.startswith("#"):
                issues.append(f"패스워드 없이 sudo 실행: {s}")

        if issues:
            self.vulnerable(cid, name, Severity.MEDIUM, desc,
                            f"과도한 sudo 권한 설정 {len(issues)}건:\n" + "\n".join(issues[:10]),
                            rec, command=cmd, cmd_output=out[:600])
        else:
            self.safe(cid, name, Severity.MEDIUM, desc,
                      "sudo 권한이 최소한으로 설정됨 (양호)",
                      rec, command=cmd, cmd_output=out[:400])

    # ══════════════════════════════════════════════════════════
    # 4. 로그 관리
    # ══════════════════════════════════════════════════════════

    def _d01(self):
        """4.1 (x)inetd Services 로그 설정"""
        cid, name = "4.1", "(x)inetd Services 로그 설정"
        desc = "inetd/xinetd 서비스의 로그 설정 여부를 점검합니다."
        rec  = "해당 OS는 체크리스트에 포함하지 않음"

        self.skipped(cid, name, Severity.LOW, desc,
                     "N/A — 해당 OS는 체크리스트에 포함하지 않음", rec)

    def _d02(self):
        """4.2 시스템 로그 설정"""
        cid, name = "4.2", "시스템 로그 설정"
        desc = ("su 로그 설정, syslog 주요 facility 설정, 로그 파일 권한이 "
                "적절한지 점검합니다.")
        rec  = ("su 로그: /etc/login.defs SULOG_FILE 설정, "
                "syslog: info/alert/notice/debug/emerg/err/crit facility 설정, "
                "로그 파일 소유자 root, 권한 640 이하")

        # --- su 로그 설정 확인 ---
        cmd1 = 'cat /etc/pam.conf 2>/dev/null | grep -i "^su" | grep -v "^#"'
        _, out1, _ = self._run_shell(cmd1)

        cmd2 = 'cat /etc/login.defs 2>/dev/null | grep "SULOG_FILE"'
        _, out2, _ = self._run_shell(cmd2)

        # --- syslog 주요 facility 설정 확인 ---
        cmd3 = ('cat /etc/syslog.conf 2>/dev/null | '
                'egrep "info|alert|notice|debug|emerg|err|crit" | '
                'egrep "var|log" | egrep -v "#"')
        _, out3, _ = self._run_shell(cmd3)

        cmd4 = ('cat /etc/rsyslog.conf 2>/dev/null | '
                'egrep "info|alert|notice|debug|emerg|err|crit" | '
                'egrep "var|log" | egrep -v "#"')
        _, out4, _ = self._run_shell(cmd4)

        cmd_str = f"{cmd1}\n{cmd2}\n{cmd3}\n{cmd4}"
        cmd_out = "\n".join(filter(None, [out1, out2, out3, out4]))

        issues = []

        # su 로그: pam.conf에 su 관련 설정 또는 login.defs에 SULOG_FILE 있어야 함
        su_log_ok = bool(out1.strip() or out2.strip())
        if not su_log_ok:
            issues.append("su 로그 설정 없음 (/etc/pam.conf su 항목, /etc/login.defs SULOG_FILE 미설정)")

        # syslog 주요 facility 설정
        syslog_ok = bool(out3.strip() or out4.strip())
        if not syslog_ok:
            issues.append("syslog 주요 facility 미설정 (info/alert/notice 등 var/log 경로 없음)")

        # 로그 파일 권한 확인 (/var/log 디렉터리 내 주요 파일)
        perm_issues = []
        log_files = ["/var/log/messages", "/var/log/secure", "/var/log/auth.log",
                     "/var/log/syslog", "/var/log/kern.log"]
        for lf in log_files:
            if not os.path.exists(lf):
                continue
            try:
                st = os.stat(lf)
                owner = st.st_uid
                perm = oct(st.st_mode & 0o777)[2:]
                if owner != 0:
                    perm_issues.append(f"{lf}: 소유자가 root가 아님 (uid={owner})")
                elif int(perm, 8) > 0o640:
                    perm_issues.append(f"{lf}: 권한 {perm} (640 초과)")
            except Exception:
                pass

        if perm_issues:
            issues.extend(perm_issues)

        if issues:
            self.vulnerable(cid, name, Severity.MEDIUM, desc,
                            "\n".join(issues), rec,
                            command=cmd_str, cmd_output=cmd_out)
        else:
            details = "su 로그 설정, syslog 주요 facility 설정, 로그 파일 권한 양호"
            self.safe(cid, name, Severity.MEDIUM, desc,
                      details, rec,
                      command=cmd_str, cmd_output=cmd_out)

    def _d03(self):
        """4.3 로그 저장 주기"""
        cid, name = "4.3", "로그 저장 주기"
        desc = ("로그 파일의 저장 기간 및 정기 백업 수행 여부를 점검합니다. "
                "담당자 인터뷰를 통해 확인합니다.")
        rec  = ("로그는 최소 1개월 이상 보관하고, 정기적으로 백업할 것. "
                "logrotate 설정: rotate 12 이상 (monthly 기준)")

        self.manual(cid, name, Severity.MEDIUM, desc,
                    "담당자 인터뷰 필요 — 로그 저장 기간 및 정기 백업 수행 여부 확인", rec)

    def _d04(self):
        """4.4 로그 디렉터리 소유자 및 권한 설정 (U-67 신규 — 2026)"""
        cid, name = "4.4", "로그 디렉터리 소유자 및 권한 설정"
        desc = ("/var/log 디렉터리 및 주요 로그 파일의 소유자가 root이고 "
                "권한이 적절한지 점검합니다.\n"
                "권고: /var/log 는 755 이하, 로그 파일은 640 이하")
        rec  = ("chown root /var/log && chmod 755 /var/log\n"
                "chmod 640 /var/log/messages /var/log/secure /var/log/auth.log 등")

        cmd = "ls -al /var/log 2>/dev/null | head -30"
        _, out, _ = self._run_shell(cmd)

        # /var/log 디렉터리 자체 권한
        r = self._stat("/var/log")
        issues = []
        if r:
            perm, owner = r
            if owner != "root":
                issues.append(f"/var/log: 소유자 {owner} (root 권고)")
            try:
                if int(perm, 8) > 0o755:
                    issues.append(f"/var/log: 권한 {perm} (755 초과)")
            except ValueError:
                pass

        # 주요 로그 파일 권한 확인
        log_files = ["/var/log/messages", "/var/log/secure",
                     "/var/log/auth.log", "/var/log/syslog",
                     "/var/log/kern.log", "/var/log/wtmp"]
        for lf in log_files:
            rf = self._stat(lf)
            if rf is None:
                continue
            perm, owner = rf
            if owner != "root":
                issues.append(f"{lf}: 소유자 {owner} (root 권고)")
            try:
                if int(perm, 8) > 0o640:
                    issues.append(f"{lf}: 권한 {perm} (640 초과)")
            except ValueError:
                pass

        if issues:
            self.vulnerable(cid, name, Severity.MEDIUM, desc,
                            f"권한 문제 {len(issues)}건:\n" + "\n".join(issues),
                            rec, command=cmd, cmd_output=out or "(출력 없음)")
        else:
            self.safe(cid, name, Severity.MEDIUM, desc,
                      "/var/log 디렉터리 및 주요 로그 파일 권한 양호",
                      rec, command=cmd, cmd_output=out or "(출력 없음)")

    def _d05(self):
        """4.5 NTP 시각 동기화 설정 (U-65 신규 — 2026)"""
        cid, name = "4.5", "NTP 시각 동기화 설정"
        desc = ("NTP(Network Time Protocol)가 설정되어 시스템 시각이 동기화되고 있는지 점검합니다.\n"
                "로그 분석·포렌식·감사 추적의 신뢰성을 위해 필수")
        rec  = ("NTP 동기화 설정:\n"
                "  systemctl enable --now chronyd  (또는 ntpd)\n"
                "  /etc/chrony.conf 또는 /etc/ntp.conf에 신뢰할 수 있는 NTP 서버 추가\n"
                "  timedatectl set-ntp true")

        cmd1 = "timedatectl status 2>/dev/null"
        cmd2 = "chronyc tracking 2>/dev/null | head -5"
        cmd3 = "ntpq -p 2>/dev/null | head -5"
        combined_cmd = f"{cmd1}\n{cmd2}\n{cmd3}"
        _, out1, _ = self._run_shell(cmd1)
        _, out2, _ = self._run_shell(cmd2)
        _, out3, _ = self._run_shell(cmd3)
        combined_out = (f"[timedatectl]\n{out1 or '(없음)'}\n\n"
                        f"[chrony tracking]\n{out2 or '(없음)'}\n\n"
                        f"[ntpq]\n{out3 or '(없음)'}")

        # NTP 동기화 여부 판단
        ntp_synced = False
        if out1:
            for line in out1.splitlines():
                if "NTP synchronized: yes" in line or "NTP service: active" in line:
                    ntp_synced = True
                    break
        if out2.strip():  # chrony 응답 있으면 동기화 중
            ntp_synced = True
        if out3.strip():  # ntpq 응답 있으면 동기화 중
            ntp_synced = True

        if ntp_synced:
            self.safe(cid, name, Severity.MEDIUM, desc,
                      "NTP 시각 동기화 설정 및 동작 중 (양호)",
                      rec, command=combined_cmd, cmd_output=combined_out)
        else:
            # timedatectl이 없는 경우 수동 확인
            if not out1.strip():
                self.manual(cid, name, Severity.MEDIUM, desc,
                            "NTP 동기화 상태 확인 불가 — 수동 점검 필요",
                            rec, command=combined_cmd, cmd_output=combined_out)
            else:
                self.vulnerable(cid, name, Severity.MEDIUM, desc,
                                "NTP 동기화 미설정 또는 비활성화 상태",
                                rec, command=combined_cmd, cmd_output=combined_out)

    # ══════════════════════════════════════════════════════════
    # 5. 주요 응용 설정
    # ══════════════════════════════════════════════════════════

    def _e01(self):
        """5.1 FTP 서비스 사용자 제한"""
        cid, name = "5.1", "FTP 서비스 사용자 제한"
        desc = "Anonymous FTP 허용 여부와 ftpusers에 root 포함 여부를 점검합니다."
        rec  = ("vsftpd.conf: anonymous_enable=NO\n"
                "ftpusers 파일에 root 및 시스템 계정 추가")

        issues = []
        ftp_conf_found = False
        for path in ("/etc/vsftpd.conf", "/etc/vsftpd/vsftpd.conf"):
            content = self._read_file(path)
            if content is None:
                continue
            ftp_conf_found = True
            for line in content.splitlines():
                s = line.strip().lower()
                if s.startswith("anonymous_enable") and "yes" in s and not s.startswith("#"):
                    issues.append(f"Anonymous FTP 활성화 ({path})")

        for path in ("/etc/ftpusers", "/etc/vsftpd/ftpusers", "/etc/vsftpd.ftpusers"):
            content = self._read_file(path)
            if content is None:
                continue
            users = {l.strip() for l in content.splitlines()
                     if l.strip() and not l.startswith("#")}
            if "root" not in users:
                issues.append(f"ftpusers에 root 미포함 ({path})")
            break

        if not ftp_conf_found:
            self.skipped(cid, name, Severity.HIGH, desc,
                         "FTP 서버 미설치 — N/A", rec)
            return

        if issues:
            self.vulnerable(cid, name, Severity.HIGH, desc,
                            "\n".join(issues), rec)
        else:
            self.safe(cid, name, Severity.HIGH, desc,
                      "FTP 사용자 제한 설정됨", rec)

    def _e02(self):
        """5.2 SNMP 서비스 설정"""
        cid, name = "5.2", "SNMP 서비스 설정"
        desc = "SNMP 서비스 실행 여부 및 기본 community string(public/private) 사용 여부를 점검합니다."
        rec  = ("SNMP 불필요 시 systemctl disable --now snmpd\n"
                "필요 시 community string 변경 및 v3 사용, ACL 적용")

        running, svc = self._service_up("snmpd")
        if not running:
            self.safe(cid, name, Severity.HIGH, desc, "SNMP 서비스 미실행", rec)
            return

        content = self._read_file("/etc/snmp/snmpd.conf") or ""
        found = [s for s in ("public", "private")
                 if any(s in l and not l.strip().startswith("#")
                        for l in content.splitlines())]
        if found:
            self.vulnerable(cid, name, Severity.HIGH, desc,
                            f"SNMP 실행 중 + 기본 community string: {', '.join(found)}", rec)
        else:
            self.manual(cid, name, Severity.HIGH, desc,
                        "SNMP 실행 중 — community string 수동 확인 필요", rec,
                        content[:300])

    def _e03(self):
        """5.3 SMTP 서비스 설정"""
        cid, name = "5.3", "SMTP 서비스 설정"
        desc = "메일 서버의 오픈 릴레이 허용 여부와 VRFY·EXPN 명령 노출 여부를 점검합니다."
        rec  = ("postfix main.cf: smtpd_recipient_restrictions 설정\n"
                "smtpd_discard_ehlo_keywords = expn, vrfy")

        running, svc = self._service_up("postfix", "sendmail", "exim4", "exim")
        if not running:
            self.skipped(cid, name, Severity.HIGH, desc,
                         "메일 서버 미실행 — N/A", rec)
            return

        issues = []
        # postfix
        main_cf = self._read_file("/etc/postfix/main.cf") or ""
        if main_cf:
            if "smtpd_recipient_restrictions" not in main_cf:
                issues.append("smtpd_recipient_restrictions 미설정 (오픈 릴레이 가능)")
            if "permit_open_relay" in main_cf.lower():
                issues.append("permit_open_relay 설정 발견")
        # sendmail
        for scf in ("/etc/mail/sendmail.cf", "/etc/sendmail.cf"):
            content = self._read_file(scf) or ""
            if content and "promiscuous_relay" in content:
                issues.append(f"sendmail promiscuous_relay 설정 ({scf})")

        if issues:
            self.vulnerable(cid, name, Severity.HIGH, desc,
                            "\n".join(issues), rec)
        else:
            self.safe(cid, name, Severity.HIGH, desc,
                      f"메일 서버 릴레이 제한 설정됨 ({svc})", rec)

    def _e04(self):
        """5.4 DNS 보안 설정"""
        cid, name = "5.4", "DNS 보안 설정"
        desc = "Zone Transfer 제한, recursion 제한, version.bind 숨김 여부를 점검합니다."
        rec  = ("named.conf: allow-transfer { <slave IP>; };\n"
                "recursion no; (권한 DNS 서버인 경우)\n"
                "version \"unknown\";")

        running, _ = self._service_up("named", "bind9")
        if not running:
            self.skipped(cid, name, Severity.HIGH, desc,
                         "BIND DNS 미실행 — N/A", rec)
            return

        content = ""
        for p in ("/etc/named.conf", "/etc/bind/named.conf"):
            c = self._read_file(p)
            if c:
                content = c
                break

        if not content:
            self.manual(cid, name, Severity.HIGH, desc,
                        "named.conf 읽기 실패 — 수동 확인 필요", rec)
            return

        issues = []
        if "allow-transfer" not in content:
            issues.append("allow-transfer 미설정 (Zone Transfer 모두 허용 가능)")
        elif re.search(r"allow-transfer\s*\{\s*any", content):
            issues.append("allow-transfer { any; } — 모든 호스트 허용")
        if "version" not in content:
            issues.append("version 숨김 미설정 (버전 정보 노출 가능)")

        if issues:
            self.vulnerable(cid, name, Severity.HIGH, desc,
                            "\n".join(issues), rec, content[:300])
        else:
            self.safe(cid, name, Severity.HIGH, desc,
                      "DNS 보안 설정 양호", rec)

    def _e05(self):
        """5.5 SWAT 보안 설정"""
        cid, name = "5.5", "SWAT 보안 설정"
        desc = "Samba Web Administration Tool(SWAT)이 포트 901에서 실행 중인지 점검합니다."
        rec  = "inetd.conf/xinetd에서 swat 비활성화 또는 방화벽으로 901 포트 차단"

        ss = self._ss()
        if ":901" in ss:
            self.vulnerable(cid, name, Severity.HIGH, desc,
                            "SWAT 서비스 실행 중 (포트 901) — 웹 인터페이스 노출", rec, ss)
        else:
            self.safe(cid, name, Severity.HIGH, desc, "SWAT 서비스 미실행", rec)

    def _e06(self):
        """5.6 X-server 접속 제한 설정"""
        cid, name = "5.6", "X-server 접속 제한 설정"
        desc = "X11 서버가 외부 접속을 허용하는지 및 SSH X11 Forwarding 설정을 점검합니다."
        rec  = ("xhost + 사용 금지 → xhost - 또는 특정 호스트만 허용\n"
                "sshd_config: X11Forwarding no (불필요 시)")

        issues = []
        # SSH X11 Forwarding
        sshd = self._read_file("/etc/ssh/sshd_config") or ""
        for line in sshd.splitlines():
            s = line.strip()
            if s.startswith("X11Forwarding") and not s.startswith("#"):
                if "yes" in s.lower():
                    issues.append("SSH X11Forwarding yes — 필요 여부 검토")

        # /tmp/.X 소켓: X 서버 실행 여부
        x_sockets = glob.glob("/tmp/.X*-lock")
        if x_sockets:
            issues.append(f"X 서버 실행 중: {', '.join(x_sockets)}")

        # DISPLAY 환경변수 및 xhost 설정은 실행 시점에 따라 달라져 자동 점검 한계
        if issues:
            self.manual(cid, name, Severity.MEDIUM, desc,
                        "\n".join(issues) +
                        "\n※ xhost 설정은 X 서버 실행 상태에서 'xhost' 명령으로 수동 확인 필요",
                        rec)
        else:
            self.safe(cid, name, Severity.MEDIUM, desc,
                      "X 서버 미실행 / X11Forwarding 미설정(기본 no)", rec)

    # ══════════════════════════════════════════════════════════
    # 6. 시스템 보안 설정
    # ══════════════════════════════════════════════════════════

    def _f01(self):
        """6.1 /etc/system 파일 보안 설정"""
        cid, name = "6.1", "/etc/system 파일 보안 설정"
        self.skipped(cid, name, Severity.LOW,
                     "/etc/system 파일 보안 설정을 점검합니다.",
                     "/etc/system은 Solaris 전용 파일 — Linux 환경 N/A\n"
                     "(Linux에서는 /etc/sysctl.conf 로 커널 파라미터 관리 → 항목 6.2 참조)",
                     "/etc/sysctl.conf 로 커널 보안 파라미터 설정")

    def _f02(self):
        """6.2 Kernel 파라미터 설정"""
        cid, name = "6.2", "Kernel 파라미터 설정"
        desc = ("IP forwarding, ICMP redirect, source routing, syn cookies 등 "
                "주요 커널 보안 파라미터를 점검합니다.")
        rec  = "/etc/sysctl.conf 또는 /etc/sysctl.d/*.conf에 권고값 설정 후 sysctl -p"

        params = {
            "net.ipv4.ip_forward":                   ("0",  "라우터가 아니면 0"),
            "net.ipv4.conf.all.accept_redirects":     ("0",  "ICMP 리다이렉트 수신 거부"),
            "net.ipv4.conf.all.send_redirects":       ("0",  "ICMP 리다이렉트 발송 금지"),
            "net.ipv4.conf.all.accept_source_route":  ("0",  "소스 라우팅 거부"),
            "net.ipv4.conf.all.rp_filter":            ("1",  "역방향 경로 필터링"),
            "net.ipv4.tcp_syncookies":                ("1",  "SYN Flood 방어"),
            "kernel.dmesg_restrict":                  ("1",  "dmesg 접근 제한"),
            "kernel.randomize_va_space":              ("2",  "ASLR 활성화"),
        }
        issues = []
        for key, (expected, comment) in params.items():
            val = self._sysctl(key)
            if val is None:
                issues.append(f"{key} = 확인불가 ({comment})")
            elif val.strip() != expected:
                issues.append(f"{key} = {val.strip()} (권고: {expected}, {comment})")

        if issues:
            self.vulnerable(cid, name, Severity.HIGH, desc,
                            f"{len(issues)}개 파라미터 미흡:\n" +
                            "\n".join(issues), rec)
        else:
            self.safe(cid, name, Severity.HIGH, desc,
                      "주요 커널 보안 파라미터 양호", rec)

    def _f03(self):
        """6.3 ISN 파라미터 설정"""
        cid, name = "6.3", "ISN 파라미터 설정"
        desc = ("TCP ISN 무작위화 및 SYN cookie 관련 커널 파라미터를 점검합니다.\n"
                "(ISN 취약점: 예측 가능한 초기 시퀀스 번호로 TCP 세션 가로채기 가능)")
        rec  = ("net.ipv4.tcp_syncookies=1\n"
                "net.ipv4.tcp_timestamps=1 (ISN 무작위화 보조)\n"
                "net.ipv4.ip_local_port_range=1024 65535")

        params = {
            "net.ipv4.tcp_syncookies":      ("1", "SYN Flood/ISN 공격 방어"),
            "net.ipv4.tcp_timestamps":      ("1", "ISN 무작위화 보조"),
        }
        issues = []
        for key, (expected, comment) in params.items():
            val = self._sysctl(key)
            if val is None:
                issues.append(f"{key} = 확인불가")
            elif val.strip() != expected:
                issues.append(f"{key} = {val.strip()} (권고: {expected}, {comment})")

        if issues:
            self.vulnerable(cid, name, Severity.HIGH, desc,
                            "\n".join(issues), rec)
        else:
            self.safe(cid, name, Severity.HIGH, desc,
                      "ISN 관련 파라미터 양호", rec)

    # ══════════════════════════════════════════════════════════
    # 7. 보안 패치
    # ══════════════════════════════════════════════════════════

    def _g01(self):
        """7.1 보안 패치 적용"""
        cid, name = "7.1", "보안 패치 적용"
        desc = "OS 및 주요 패키지 보안 업데이트가 적용되어 있는지 점검합니다."
        rec  = "apt-get upgrade / yum update 등으로 최신 보안 패치 적용"

        rc, uname, _ = self._run_cmd("uname -r")
        rc2, os_rel, _ = self._run_cmd("cat /etc/os-release 2>/dev/null | head -5")

        # apt 미적용 보안 패치 확인
        rc3, apt_out, _ = self._run_cmd(
            "apt-get -s upgrade 2>/dev/null | grep -i 'security' | head -10",
            timeout=30)
        if rc3 == 0 and apt_out.strip():
            self.vulnerable(cid, name, Severity.HIGH, desc,
                            f"미적용 보안 패치 존재 (apt):\n{apt_out[:400]}",
                            rec, f"Kernel: {uname.strip()}")
            return

        # yum 미적용 보안 패치 확인
        rc4, yum_out, _ = self._run_cmd(
            "yum check-update --security 2>/dev/null | head -15", timeout=30)
        if rc4 == 100:
            self.vulnerable(cid, name, Severity.HIGH, desc,
                            f"미적용 보안 패치 존재 (yum):\n{yum_out[:400]}",
                            rec, f"Kernel: {uname.strip()}")
            return

        self.manual(cid, name, Severity.HIGH, desc,
                    f"커널: {uname.strip()}\n"
                    f"OS: {os_rel.strip()}\n"
                    "※ 자동 확인 불가 — 벤더 보안 공지(CVE) 기준으로 수동 확인 필요",
                    rec, uname.strip())
