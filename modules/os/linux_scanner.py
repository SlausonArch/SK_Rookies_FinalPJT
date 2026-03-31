"""
OS - Linux 취약점 진단 모듈
점검 기준: 58개 항목
  1. 계정 관리        (1.1  ~ 1.12)  12개
  2. 파일 시스템      (2.1  ~ 2.23)  23개
  3. 네트워크 서비스  (3.1  ~ 3.10)  10개
  4. 로그 관리        (4.1  ~ 4.3)    3개
  5. 주요 응용 설정   (5.1  ~ 5.6)    6개
  6. 시스템 보안 설정 (6.1  ~ 6.3)    3개
  7. 보안 패치        (7.1)           1개
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
    CATEGORY = "OS-Linux"

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
        self._a11(); self._a12()

        print("\n  ─── 2. 파일 시스템 ─────────────────────────────────")
        self._b01(); self._b02(); self._b03(); self._b04(); self._b05()
        self._b06(); self._b07(); self._b08(); self._b09(); self._b10()
        self._b11(); self._b12(); self._b13(); self._b14(); self._b15()
        self._b16(); self._b17(); self._b18(); self._b19(); self._b20()
        self._b21(); self._b22(); self._b23()

        print("\n  ─── 3. 네트워크 서비스 ─────────────────────────────")
        self._c01(); self._c02(); self._c03(); self._c04(); self._c05()
        self._c06(); self._c07(); self._c08(); self._c09(); self._c10()

        print("\n  ─── 4. 로그 관리 ───────────────────────────────────")
        self._d01(); self._d02(); self._d03()

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

    def _a01(self):
        """1.1 로그인 설정"""
        cid, name = "1.1", "로그인 설정"
        desc = "로그인 실패 기록, login.defs 기본 설정, PAM 로그인 정책을 점검합니다."
        rec  = "login.defs: FAILLOG_ENAB yes, LOG_UNKFAIL_ENAB yes 설정 / PAM faillock 적용"

        content = self._read_file("/etc/login.defs") or ""
        issues = []
        settings = {}
        for line in content.splitlines():
            s = line.strip()
            if s and not s.startswith("#"):
                parts = s.split()
                if len(parts) >= 2:
                    settings[parts[0]] = parts[1]

        if settings.get("FAILLOG_ENAB", "no").lower() != "yes":
            issues.append("FAILLOG_ENAB 미설정(yes 권고)")
        if settings.get("LOG_UNKFAIL_ENAB", "no").lower() != "yes":
            issues.append("LOG_UNKFAIL_ENAB 미설정(yes 권고)")

        # PAM faillock/tally2 확인
        pam = self._pam_content()
        if "pam_faillock" not in pam and "pam_tally2" not in pam:
            issues.append("PAM 로그인 실패 잠금 미설정(pam_faillock/tally2)")

        if issues:
            self.vulnerable(cid, name, Severity.MEDIUM, desc,
                            " / ".join(issues), rec, "\n".join(
                                f"{k}={v}" for k, v in settings.items()
                                if k in ("FAILLOG_ENAB", "LOG_UNKFAIL_ENAB")))
        else:
            self.safe(cid, name, Severity.MEDIUM, desc,
                      "로그인 실패 로깅 및 잠금 정책 설정됨", rec)

    def _a02(self):
        """1.2 Default 계정 삭제"""
        cid, name = "1.2", "Default 계정 삭제"
        desc = "OS 설치 시 기본 생성되는 불필요한 계정이 삭제되었는지 점검합니다."
        rec  = "userdel <계정명> 으로 불필요한 기본 계정 삭제"

        content = self._read_file("/etc/passwd") or ""
        found = [a for a in _DEFAULT_ACCOUNTS
                 if any(l.startswith(a + ":") for l in content.splitlines())]
        if found:
            self.vulnerable(cid, name, Severity.MEDIUM, desc,
                            f"기본 계정 잔존: {', '.join(sorted(found))}", rec)
        else:
            self.safe(cid, name, Severity.MEDIUM, desc, "기본 계정 삭제됨", rec)

    def _a03(self):
        """1.3 일반계정 root 권한 관리"""
        cid, name = "1.3", "일반계정 root 권한 관리"
        desc = "sudo 권한 부여가 최소화되었는지, NOPASSWD 설정이 없는지 점검합니다."
        rec  = "/etc/sudoers에서 NOPASSWD:ALL 항목 제거, sudo 권한을 필요한 계정에만 부여"

        issues = []
        # sudoers 파일 + sudoers.d 디렉터리 전체 검사
        sudo_content = self._read_file("/etc/sudoers") or ""
        for f in glob.glob("/etc/sudoers.d/*"):
            c = self._read_file(f)
            if c:
                sudo_content += f"\n# === {f} ===\n" + c

        if not sudo_content:
            self.manual(cid, name, Severity.HIGH, desc,
                        "/etc/sudoers 읽기 실패 — root 권한으로 재시도 필요", rec)
            return

        for line in sudo_content.splitlines():
            s = line.strip()
            if s.startswith("#") or not s:
                continue
            if "NOPASSWD" in s and "ALL" in s:
                issues.append(f"NOPASSWD:ALL 항목 발견: {s}")
            if s.startswith("ALL") and "ALL=(ALL)" in s:
                issues.append(f"과도한 sudo 권한: {s}")

        # wheel/sudo 그룹 멤버 수
        group = self._read_file("/etc/group") or ""
        admin_members = []
        for line in group.splitlines():
            parts = line.split(":")
            if len(parts) >= 4 and parts[0] in ("wheel", "sudo"):
                members = [m for m in parts[3].split(",") if m.strip()]
                admin_members.extend(members)

        if len(admin_members) > 5:
            issues.append(f"sudo/wheel 그룹 멤버 과다 ({len(admin_members)}명): "
                          f"{', '.join(admin_members)}")

        if issues:
            self.vulnerable(cid, name, Severity.HIGH, desc,
                            "\n".join(issues), rec)
        else:
            self.safe(cid, name, Severity.HIGH, desc,
                      f"sudo 권한 적절히 관리됨 (멤버 {len(admin_members)}명)", rec)

    def _a04(self):
        """1.4 /etc/passwd 파일 권한 설정"""
        self._chk_perm("1.4", "/etc/passwd 파일 권한 설정",
                       "/etc/passwd", 0o644, Severity.HIGH,
                       "chown root /etc/passwd && chmod 644 /etc/passwd")

    def _a05(self):
        """1.5 /etc/group 파일 권한 설정"""
        self._chk_perm("1.5", "/etc/group 파일 권한 설정",
                       "/etc/group", 0o644, Severity.HIGH,
                       "chown root /etc/group && chmod 644 /etc/group")

    def _a06(self):
        """1.6 /etc/shadow 파일 권한 설정"""
        self._chk_perm("1.6", "/etc/shadow 파일 권한 설정",
                       "/etc/shadow", 0o400, Severity.CRITICAL,
                       "chown root /etc/shadow && chmod 400 /etc/shadow")

    def _a07(self):
        """1.7 패스워드 사용 규칙 적용"""
        cid, name = "1.7", "패스워드 사용 규칙 적용"
        desc  = "최소 길이 8자 이상, 최대 사용기간 90일 이하, 복잡도 정책 적용 여부를 점검합니다."
        rec   = ("login.defs: PASS_MIN_LEN 8, PASS_MAX_DAYS 90, PASS_MIN_DAYS 1\n"
                 "PAM: pam_pwquality minlen=8 dcredit=-1 ucredit=-1 ocredit=-1")

        issues = []
        min_len  = self._login_defs("PASS_MIN_LEN")
        max_days = self._login_defs("PASS_MAX_DAYS")
        min_days = self._login_defs("PASS_MIN_DAYS")

        if min_len  is None or (isinstance(min_len, int)  and min_len  < 8):
            issues.append(f"PASS_MIN_LEN={min_len} (8 미만)")
        if max_days is None or (isinstance(max_days, int) and max_days > 90):
            issues.append(f"PASS_MAX_DAYS={max_days} (90 초과)")
        if min_days is None or (isinstance(min_days, int) and min_days < 1):
            issues.append(f"PASS_MIN_DAYS={min_days} (1 미만)")

        pam = self._pam_content()
        if "pam_pwquality" not in pam and "pam_cracklib" not in pam:
            issues.append("패스워드 복잡도 모듈(pam_pwquality/pam_cracklib) 미적용")
        else:
            minlen_m = re.search(r"minlen=(\d+)", pam)
            if minlen_m and int(minlen_m.group(1)) < 8:
                issues.append(f"PAM minlen={minlen_m.group(1)} (8 미만)")

        if issues:
            self.vulnerable(cid, name, Severity.HIGH, desc,
                            "\n".join(issues), rec)
        else:
            self.safe(cid, name, Severity.HIGH, desc,
                      f"패스워드 정책 적용됨 (PASS_MIN_LEN={min_len}, "
                      f"PASS_MAX_DAYS={max_days})", rec)

    def _a08(self):
        """1.8 취약한 패스워드 점검"""
        cid, name = "1.8", "취약한 패스워드 점검"
        desc = "빈 패스워드 계정 존재 여부 및 패스워드 미설정 계정을 점검합니다."
        rec  = ("빈 패스워드 계정에 즉시 패스워드 설정\n"
                "전체 패스워드 강도 점검은 john/hashcat 등 별도 도구로 수행 권고")

        shadow = self._read_file("/etc/shadow")
        if shadow is None:
            self.manual(cid, name, Severity.CRITICAL, desc,
                        "/etc/shadow 읽기 실패 — root 권한 필요. 수동 점검 요망\n"
                        "※ 전체 패스워드 강도(사전 공격 등)는 john/hashcat으로 별도 진단 필요", rec)
            return

        empty, locked, never_set = [], [], []
        for line in shadow.splitlines():
            parts = line.split(":")
            if len(parts) < 2:
                continue
            user, pw = parts[0], parts[1]
            if pw == "":
                empty.append(user)
            elif pw in ("!!", "!"):
                locked.append(user)

        issues = []
        if empty:
            issues.append(f"빈 패스워드 계정: {', '.join(empty)}")

        note = ("※ 패스워드 강도(사전 공격·무차별 대입) 점검은 자동화 범위 초과 — "
                "john/hashcat 등 별도 도구로 수행 필요")

        if issues:
            self.vulnerable(cid, name, Severity.CRITICAL, desc,
                            "\n".join(issues) + "\n" + note, rec,
                            f"잠금 계정: {', '.join(locked) or '없음'}")
        else:
            self.safe(cid, name, Severity.CRITICAL, desc,
                      f"빈 패스워드 없음 (잠금 계정 {len(locked)}개)\n{note}", rec)

    def _a09(self):
        """1.9 로그인이 불필요한 계정 shell 제한"""
        cid, name = "1.9", "로그인이 불필요한 계정 shell 제한"
        desc = "서비스 계정의 shell이 /sbin/nologin 또는 /bin/false 로 제한되어 있는지 점검합니다."
        rec  = "usermod -s /sbin/nologin <계정명> 으로 서비스 계정 shell 변경"

        no_login = {"/bin/false", "/sbin/nologin", "/usr/sbin/nologin",
                    "/dev/null", "/nonexistent"}
        passwd = self._read_file("/etc/passwd") or ""
        issues = []
        for line in passwd.splitlines():
            parts = line.split(":")
            if len(parts) < 7:
                continue
            user, shell = parts[0], parts[6].strip()
            if user in _SYSTEM_ACCOUNTS and shell not in no_login:
                issues.append(f"{user}: {shell}")

        if issues:
            self.vulnerable(cid, name, Severity.MEDIUM, desc,
                            f"shell 미제한 서비스 계정 {len(issues)}개:\n" +
                            "\n".join(issues[:15]), rec)
        else:
            self.safe(cid, name, Severity.MEDIUM, desc,
                      "서비스 계정 shell 제한 적용됨", rec)

    def _a10(self):
        """1.10 SU(Select User) 사용 제한"""
        cid, name = "1.10", "SU 사용 제한"
        desc = "일반 사용자가 su 명령으로 root 전환하지 못하도록 wheel 그룹 제한 여부를 점검합니다."
        rec  = "/etc/pam.d/su에 'auth required pam_wheel.so use_uid' 추가"

        su_pam = self._read_file("/etc/pam.d/su") or ""
        if not su_pam:
            self.manual(cid, name, Severity.HIGH, desc,
                        "/etc/pam.d/su 읽기 실패 — 수동 확인 필요", rec)
            return

        has_wheel = any(
            "pam_wheel" in l and "use_uid" in l and not l.strip().startswith("#")
            for l in su_pam.splitlines()
        )
        if not has_wheel:
            self.vulnerable(cid, name, Severity.HIGH, desc,
                            "pam_wheel 미적용 — 모든 사용자 su root 가능", rec,
                            su_pam[:300])
            return

        group = self._read_file("/etc/group") or ""
        wheel_members = []
        for line in group.splitlines():
            parts = line.split(":")
            if parts[0] == "wheel" and len(parts) >= 4:
                wheel_members = [m for m in parts[3].split(",") if m.strip()]
        self.safe(cid, name, Severity.HIGH, desc,
                  f"pam_wheel 적용 (wheel 멤버: {', '.join(wheel_members) or '없음'})", rec)

    def _a11(self):
        """1.11 계정이 존재하지 않는 GID 금지"""
        cid, name = "1.11", "계정이 존재하지 않는 GID 금지"
        desc = "/etc/passwd의 GID가 /etc/group에 정의되지 않은 계정을 점검합니다."
        rec  = "orphan GID 계정의 그룹을 /etc/group에 추가하거나 계정 삭제"

        passwd = self._read_file("/etc/passwd") or ""
        group  = self._read_file("/etc/group")  or ""
        defined = {l.split(":")[2] for l in group.splitlines() if len(l.split(":")) >= 3}
        orphans = []
        for line in passwd.splitlines():
            parts = line.split(":")
            if len(parts) >= 5 and parts[3] not in defined:
                orphans.append(f"{parts[0]} (GID={parts[3]})")
        if orphans:
            self.vulnerable(cid, name, Severity.MEDIUM, desc,
                            f"미정의 GID 계정 {len(orphans)}개:\n" +
                            "\n".join(orphans), rec)
        else:
            self.safe(cid, name, Severity.MEDIUM, desc,
                      "모든 계정 GID 정상", rec)

    def _a12(self):
        """1.12 동일한 UID 금지"""
        cid, name = "1.12", "동일한 UID 금지"
        desc = "/etc/passwd에서 동일한 UID를 가진 계정이 있는지 점검합니다."
        rec  = "중복 UID 계정에 고유한 UID 재할당"

        passwd = self._read_file("/etc/passwd") or ""
        uid_map: dict[str, list] = {}
        for line in passwd.splitlines():
            parts = line.split(":")
            if len(parts) >= 3:
                uid_map.setdefault(parts[2], []).append(parts[0])
        dups = {uid: accs for uid, accs in uid_map.items() if len(accs) > 1}
        if dups:
            detail = "\n".join(f"UID {uid}: {', '.join(accs)}"
                               for uid, accs in dups.items())
            self.vulnerable(cid, name, Severity.MEDIUM, desc,
                            f"중복 UID {len(dups)}개:\n{detail}", rec)
        else:
            self.safe(cid, name, Severity.MEDIUM, desc, "UID 중복 없음", rec)

    # ══════════════════════════════════════════════════════════
    # 2. 파일 시스템
    # ══════════════════════════════════════════════════════════

    def _b01(self):
        """2.1 사용자 UMASK 설정"""
        cid, name = "2.1", "사용자 UMASK 설정"
        desc = "시스템 기본 UMASK가 022 이상으로 설정되어 있는지 점검합니다."
        rec  = "/etc/profile 및 /etc/bashrc에 umask 022 (또는 027) 설정"

        umask_val = None
        for path in ("/etc/profile", "/etc/bashrc", "/etc/bash.bashrc"):
            c = self._read_file(path) or ""
            for line in c.splitlines():
                s = line.strip()
                if s.startswith("umask") and not s.startswith("#"):
                    parts = s.split()
                    if len(parts) >= 2:
                        umask_val = parts[1]
                        break
            if umask_val:
                break

        if umask_val in ("022", "027", "0022", "0027"):
            self.safe(cid, name, Severity.MEDIUM, desc,
                      f"UMASK = {umask_val} (양호)", rec)
        elif umask_val:
            self.vulnerable(cid, name, Severity.MEDIUM, desc,
                            f"UMASK = {umask_val} (022 미만)", rec)
        else:
            self.vulnerable(cid, name, Severity.MEDIUM, desc,
                            "UMASK 미설정 — 기본값(022)이 적용되나 명시적 설정 권고", rec)

    def _b02(self):
        """2.2 SUID·SGID 설정"""
        cid, name = "2.2", "SUID·SGID 설정"
        desc = "불필요한 SUID/SGID 비트가 설정된 파일을 점검합니다."
        rec  = "불필요한 파일에 chmod -s <파일> 적용"

        rc, out, err = self._run_cmd(
            "find /usr/bin /usr/sbin /bin /sbin -perm /6000 -type f 2>/dev/null",
            timeout=20)
        if rc != 0 and not out:
            self.manual(cid, name, Severity.HIGH, desc,
                        f"find 실패 — {err[:100]}", rec)
            return

        known_safe = {
            "/usr/bin/passwd", "/usr/bin/sudo", "/usr/bin/su", "/bin/su",
            "/usr/bin/chsh", "/usr/bin/chfn", "/usr/bin/newgrp",
            "/usr/bin/gpasswd", "/usr/bin/at", "/usr/bin/crontab",
            "/usr/sbin/unix_chkpwd", "/usr/bin/pkexec",
        }
        files = [f.strip() for f in out.splitlines() if f.strip()]
        suspicious = [f for f in files if f not in known_safe]

        if suspicious:
            self.vulnerable(cid, name, Severity.HIGH, desc,
                            f"의심 SUID/SGID 파일 {len(suspicious)}개:\n" +
                            "\n".join(suspicious[:20]), rec)
        else:
            self.safe(cid, name, Severity.HIGH, desc,
                      f"SUID/SGID 파일 {len(files)}개 — 모두 일반 허용 범위", rec)

    def _b03(self):
        """2.3 /etc/(x)inetd.conf 파일 권한 설정"""
        cid, name = "2.3", "/etc/(x)inetd.conf 파일 권한 설정"
        for path in ("/etc/inetd.conf", "/etc/xinetd.conf"):
            if os.path.exists(path):
                self._chk_perm(cid, name, path, 0o600, Severity.HIGH,
                               f"chown root {path} && chmod 600 {path}")
                return
        self.skipped(cid, name, Severity.HIGH,
                     "inetd/xinetd 설정 파일 권한 점검",
                     "inetd/xinetd 미설치 — N/A", "해당 서비스 미사용 시 해당 없음")

    def _b04(self):
        """2.4 .history 파일 권한 설정"""
        cid, name = "2.4", ".history 파일 권한 설정"
        desc = "root 및 사용자 홈 디렉터리의 .bash_history 파일 권한이 600 이하인지 점검합니다."
        rec  = "chmod 600 ~/.bash_history (소유자 본인만 읽기/쓰기)"

        issues = []
        check_files = ["/root/.bash_history", "/root/.history"]
        passwd = self._read_file("/etc/passwd") or ""
        for line in passwd.splitlines():
            parts = line.split(":")
            if len(parts) >= 6 and parts[5] and parts[5] != "/":
                for hf in (".bash_history", ".history", ".sh_history"):
                    p = os.path.join(parts[5], hf)
                    if p not in check_files:
                        check_files.append(p)

        for path in check_files:
            if not os.path.exists(path):
                continue
            r = self._stat(path)
            if r:
                perm, owner = r
                try:
                    if int(perm, 8) > 0o600:
                        issues.append(f"{path}: {perm} ({owner})")
                except ValueError:
                    pass

        if issues:
            self.vulnerable(cid, name, Severity.MEDIUM, desc,
                            f"권한 과다 history 파일 {len(issues)}개:\n" +
                            "\n".join(issues), rec)
        else:
            self.safe(cid, name, Severity.MEDIUM, desc,
                      "history 파일 권한 양호", rec)

    def _b05(self):
        """2.5 Crontab 파일 권한 설정 및 관리"""
        cid, name = "2.5", "Crontab 파일 권한 설정 및 관리"
        desc = "/etc/crontab, /etc/cron.d/, /etc/cron.*/  권한·소유자를 점검합니다."
        rec  = "chown root /etc/crontab && chmod 640 /etc/crontab; cron.d/ 도 동일 적용"

        issues = []
        for path in ["/etc/crontab"]:
            if not os.path.exists(path):
                continue
            r = self._stat(path)
            if r:
                perm, owner = r
                try:
                    if int(perm, 8) > 0o640:
                        issues.append(f"{path}: 권한 {perm}")
                except ValueError:
                    pass
                if owner != "root":
                    issues.append(f"{path}: 소유자 {owner}")

        for d in ("/etc/cron.d", "/etc/cron.daily", "/etc/cron.weekly",
                  "/etc/cron.monthly"):
            if not os.path.isdir(d):
                continue
            r = self._stat(d)
            if r:
                perm, owner = r
                try:
                    if int(perm, 8) > 0o755:
                        issues.append(f"{d}/: 권한 {perm}")
                except ValueError:
                    pass
                if owner != "root":
                    issues.append(f"{d}/: 소유자 {owner}")

        if issues:
            self.vulnerable(cid, name, Severity.MEDIUM, desc,
                            "\n".join(issues), rec)
        else:
            self.safe(cid, name, Severity.MEDIUM, desc,
                      "crontab 파일·디렉터리 권한 양호", rec)

    def _b06(self):
        """2.6 /etc/profile 파일 권한 설정"""
        self._chk_perm("2.6", "/etc/profile 파일 권한 설정",
                       "/etc/profile", 0o644, Severity.MEDIUM,
                       "chown root /etc/profile && chmod 644 /etc/profile")

    def _b07(self):
        """2.7 /etc/hosts 파일 권한 설정"""
        self._chk_perm("2.7", "/etc/hosts 파일 권한 설정",
                       "/etc/hosts", 0o644, Severity.MEDIUM,
                       "chown root /etc/hosts && chmod 644 /etc/hosts")

    def _b08(self):
        """2.8 /etc/issue 파일 권한 설정"""
        cid, name = "2.8", "/etc/issue 파일 권한 설정"
        desc = "/etc/issue의 권한 설정 및 OS 버전 등 민감 정보 노출 여부를 점검합니다."
        rec  = ("chmod 644 /etc/issue /etc/issue.net\n"
                "내용을 법적 경고 문구로 교체 (OS 버전·커널 정보 제거)")

        issues = []
        for path in ("/etc/issue", "/etc/issue.net"):
            if not os.path.exists(path):
                continue
            r = self._stat(path)
            if r:
                perm, owner = r
                try:
                    if int(perm, 8) > 0o644:
                        issues.append(f"{path}: 권한 {perm}")
                except ValueError:
                    pass
            content = (self._read_file(path) or "").lower()
            sensitive = ["ubuntu", "debian", "centos", "red hat", "fedora",
                         "kernel", "release", "version", "linux"]
            found = [k for k in sensitive if k in content]
            if found:
                issues.append(f"{path}: 민감 정보 노출 ({', '.join(found)})")

        if issues:
            self.vulnerable(cid, name, Severity.LOW, desc,
                            "\n".join(issues), rec)
        else:
            self.safe(cid, name, Severity.LOW, desc,
                      "/etc/issue 권한·내용 양호", rec)

    def _b09(self):
        """2.9 사용자 홈 디렉터리 및 파일 관리"""
        cid, name = "2.9", "사용자 홈 디렉터리 및 파일 관리"
        desc = "홈 디렉터리 권한(other 쓰기 금지), .netrc·.rhosts 파일 존재 여부를 점검합니다."
        rec  = ("chmod 750 <홈디렉터리> / rm -f ~/.netrc ~/.rhosts\n"
                ".netrc는 평문 자격증명 저장 위험")

        issues = []
        passwd = self._read_file("/etc/passwd") or ""
        for line in passwd.splitlines():
            parts = line.split(":")
            if len(parts) < 7:
                continue
            user, home = parts[0], parts[5]
            if not home or home == "/" or not os.path.isdir(home):
                continue
            r = self._stat(home)
            if r:
                perm, _ = r
                try:
                    if int(perm, 8) & 0o002:
                        issues.append(f"{home}: other 쓰기 가능 ({perm})")
                except ValueError:
                    pass
            for danger in (".netrc", ".rhosts"):
                p = os.path.join(home, danger)
                if os.path.exists(p):
                    issues.append(f"{p}: 위험 파일 존재")

        if issues:
            self.vulnerable(cid, name, Severity.HIGH, desc,
                            f"{len(issues)}건 발견:\n" + "\n".join(issues[:15]), rec)
        else:
            self.safe(cid, name, Severity.HIGH, desc,
                      "홈 디렉터리 권한 및 위험 파일 점검 양호", rec)

    def _b10(self):
        """2.10 중요 디렉터리 파일 권한 설정"""
        cid, name = "2.10", "중요 디렉터리 파일 권한 설정"
        desc = "/tmp(sticky bit), /etc, /bin, /sbin, /usr 디렉터리 권한·소유자를 점검합니다."
        rec  = "chmod 1777 /tmp; chmod 755 /etc /bin /sbin /usr; chown root ..."

        checks = [
            ("/tmp",      0o1777, None),    # sticky bit 포함
            ("/etc",      0o755,  "root"),
            ("/bin",      0o755,  "root"),
            ("/sbin",     0o755,  "root"),
            ("/usr",      0o755,  "root"),
            ("/usr/bin",  0o755,  "root"),
            ("/usr/sbin", 0o755,  "root"),
        ]
        issues = []
        for path, max_oct, req_owner in checks:
            if not os.path.exists(path):
                continue
            r = self._stat(path)
            if not r:
                continue
            perm, owner = r
            try:
                actual = int(perm, 8)
                if path == "/tmp":
                    if not (actual & 0o1000):
                        issues.append(f"{path}: sticky bit 없음 ({perm})")
                    if actual & 0o002 and not (actual & 0o1000):
                        issues.append(f"{path}: world-writable & no sticky bit")
                elif actual > max_oct:
                    issues.append(f"{path}: 권한 {perm} ({oct(max_oct)[2:]} 초과)")
            except ValueError:
                pass
            if req_owner and owner != req_owner:
                issues.append(f"{path}: 소유자 {owner} ({req_owner} 권고)")

        if issues:
            self.vulnerable(cid, name, Severity.HIGH, desc,
                            "\n".join(issues), rec)
        else:
            self.safe(cid, name, Severity.HIGH, desc,
                      "중요 디렉터리 권한 양호", rec)

    def _b11(self):
        """2.11 PATH 환경변수 설정"""
        cid, name = "2.11", "PATH 환경변수 설정"
        desc = "PATH에 현재 디렉터리(. 또는 ::)가 포함되어 있으면 경로 조작 공격에 취약합니다."
        rec  = "/etc/profile, /root/.bashrc에서 PATH에 '.' 제거"

        issues = []
        for path in ("/etc/profile", "/etc/bashrc", "/etc/bash.bashrc",
                     "/root/.bashrc", "/root/.bash_profile", "/root/.profile"):
            content = self._read_file(path) or ""
            for line in content.splitlines():
                s = line.strip()
                if "PATH=" in s and not s.startswith("#"):
                    val = s.split("PATH=")[-1].strip().strip('"').strip("'")
                    path_parts = val.replace('"', '').replace("'", "").split(":")
                    if "." in path_parts or "" in path_parts:
                        issues.append(f"{path}: PATH에 '.' 또는 빈 항목 포함 ({s[:80]})")
                        break

        if issues:
            self.vulnerable(cid, name, Severity.HIGH, desc,
                            "\n".join(issues), rec)
        else:
            self.safe(cid, name, Severity.HIGH, desc,
                      "PATH에 현재 디렉터리 미포함", rec)

    def _b12(self):
        """2.12 FTP 접근제어 파일 권한 설정"""
        cid, name = "2.12", "FTP 접근제어 파일 권한 설정"
        for path in ("/etc/ftpusers", "/etc/vsftpd/ftpusers",
                     "/etc/vsftpd.ftpusers", "/etc/proftpd/ftpusers"):
            if os.path.exists(path):
                self._chk_perm(cid, name, path, 0o640, Severity.MEDIUM,
                               f"chown root {path} && chmod 640 {path}")
                return
        self.skipped(cid, name, Severity.MEDIUM,
                     "ftpusers 파일 권한 점검",
                     "ftpusers 파일 없음 — FTP 미설치 N/A",
                     "FTP 미사용 시 해당 없음")

    def _b13(self):
        """2.13 root 원격 접근제어 파일 권한 설정"""
        cid, name = "2.13", "root 원격 접근제어 파일 권한 설정"
        desc = "/etc/ssh/sshd_config 및 /etc/securetty 파일 권한이 적절한지 점검합니다."
        rec  = "chmod 600 /etc/ssh/sshd_config /etc/securetty; chown root ..."

        issues = []
        for path, max_oct in [("/etc/ssh/sshd_config", 0o640),
                               ("/etc/securetty",       0o640)]:
            if not os.path.exists(path):
                continue
            r = self._stat(path)
            if r:
                perm, owner = r
                try:
                    if int(perm, 8) > max_oct:
                        issues.append(f"{path}: {perm} ({oct(max_oct)[2:]} 초과)")
                except ValueError:
                    pass
                if owner != "root":
                    issues.append(f"{path}: 소유자 {owner}")

        if issues:
            self.vulnerable(cid, name, Severity.HIGH, desc,
                            "\n".join(issues), rec)
        else:
            self.safe(cid, name, Severity.HIGH, desc,
                      "접근제어 파일 권한 양호", rec)

    def _b14(self):
        """2.14 NFS 접근제어 파일 권한 설정"""
        cid, name = "2.14", "NFS 접근제어 파일 권한 설정"
        if os.path.exists("/etc/exports"):
            self._chk_perm(cid, name, "/etc/exports", 0o644, Severity.MEDIUM,
                           "chown root /etc/exports && chmod 644 /etc/exports")
        else:
            self.skipped(cid, name, Severity.MEDIUM,
                         "/etc/exports 파일 권한 점검",
                         "/etc/exports 없음 — NFS 미사용 N/A",
                         "NFS 미사용 시 해당 없음")

    def _b15(self):
        """2.15 /etc/services 파일 권한 설정"""
        self._chk_perm("2.15", "/etc/services 파일 권한 설정",
                       "/etc/services", 0o644, Severity.LOW,
                       "chown root /etc/services && chmod 644 /etc/services")

    def _b16(self):
        """2.16 부팅 스크립트 파일 권한 설정"""
        cid, name = "2.16", "부팅 스크립트 파일 권한 설정"
        desc = "/etc/init.d/ 또는 /etc/rc*.d/ 디렉터리 스크립트의 권한을 점검합니다."
        rec  = "chown root /etc/init.d/* && chmod 755 /etc/init.d/*"

        issues = []
        for search_dir in ("/etc/init.d", "/etc/rc.d/init.d"):
            if not os.path.isdir(search_dir):
                continue
            rc, out, _ = self._run_cmd(
                f"find {search_dir} -maxdepth 1 -type f -perm /022", timeout=10)
            files = [f for f in out.splitlines() if f.strip()]
            if files:
                issues.extend(files[:10])

        if issues:
            self.vulnerable(cid, name, Severity.MEDIUM, desc,
                            f"권한 과다 부팅 스크립트 {len(issues)}개:\n" +
                            "\n".join(issues[:10]), rec)
        else:
            # systemd 환경이면 init.d 자체가 없을 수 있음
            if not any(os.path.isdir(d) for d in ("/etc/init.d", "/etc/rc.d/init.d")):
                self.skipped(cid, name, Severity.MEDIUM, desc,
                             "init.d 없음 — systemd 환경 N/A (systemd unit 파일 별도 점검)", rec)
            else:
                self.safe(cid, name, Severity.MEDIUM, desc,
                          "부팅 스크립트 권한 양호", rec)

    def _b17(self):
        """2.17 /etc/hosts.allow, /etc/hosts.deny 설정"""
        cid, name = "2.17", "/etc/hosts.allow · /etc/hosts.deny 설정"
        desc = "TCP Wrappers 설정 파일이 존재하고, hosts.deny에 기본 차단이 설정되어 있는지 점검합니다."
        rec  = ("hosts.deny: ALL: ALL (기본 거부)\n"
                "hosts.allow: 허용할 서비스·IP만 명시")

        allow_ex = os.path.exists("/etc/hosts.allow")
        deny_ex  = os.path.exists("/etc/hosts.deny")

        if not allow_ex and not deny_ex:
            self.manual(cid, name, Severity.MEDIUM, desc,
                        "hosts.allow / hosts.deny 없음 — TCP Wrappers 미사용 또는 방화벽 대체 여부 수동 확인", rec)
            return

        deny_content = self._read_file("/etc/hosts.deny") or ""
        has_deny_all = any(
            "ALL" in l and "ALL" in l and not l.strip().startswith("#")
            for l in deny_content.splitlines()
        )
        if not has_deny_all:
            self.vulnerable(cid, name, Severity.MEDIUM, desc,
                            "hosts.deny에 'ALL: ALL' 기본 차단 미설정",
                            rec, deny_content[:300])
        else:
            self.safe(cid, name, Severity.MEDIUM, desc,
                      "hosts.allow/deny 설정됨, 기본 차단 적용", rec)

    def _b18(self):
        """2.18 기타 중요 파일 권한 설정"""
        cid, name = "2.18", "기타 중요 파일 권한 설정"
        desc = "/etc/gshadow, SSH 호스트 키 등 중요 파일의 권한을 점검합니다."
        rec  = ("chmod 400 /etc/gshadow; chmod 600 /etc/ssh/ssh_host_*_key\n"
                "chown root for all")

        issues = []
        targets = [
            ("/etc/gshadow",                0o400),
            ("/etc/sudoers",                0o440),
        ]
        # SSH 호스트 개인키
        for keyfile in glob.glob("/etc/ssh/ssh_host_*_key"):
            targets.append((keyfile, 0o600))

        for path, max_oct in targets:
            if not os.path.exists(path):
                continue
            r = self._stat(path)
            if not r:
                continue
            perm, owner = r
            try:
                if int(perm, 8) > max_oct:
                    issues.append(f"{path}: {perm} ({oct(max_oct)[2:]} 초과)")
            except ValueError:
                pass
            if owner != "root":
                issues.append(f"{path}: 소유자 {owner}")

        if issues:
            self.vulnerable(cid, name, Severity.HIGH, desc,
                            "\n".join(issues), rec)
        else:
            self.safe(cid, name, Severity.HIGH, desc,
                      "중요 파일 권한 양호", rec)

    def _b19(self):
        """2.19 at 파일 소유자 및 권한 설정"""
        cid, name = "2.19", "at 파일 소유자 및 권한 설정"
        desc = "/etc/at.allow, /etc/at.deny 파일의 소유자·권한을 점검합니다."
        rec  = "chown root /etc/at.allow && chmod 640 /etc/at.allow"

        found_any = False
        issues = []
        for path in ("/etc/at.allow", "/etc/at.deny"):
            if not os.path.exists(path):
                continue
            found_any = True
            r = self._stat(path)
            if r:
                perm, owner = r
                try:
                    if int(perm, 8) > 0o640:
                        issues.append(f"{path}: {perm}")
                except ValueError:
                    pass
                if owner != "root":
                    issues.append(f"{path}: 소유자 {owner}")

        if not found_any:
            self.skipped(cid, name, Severity.LOW, desc,
                         "at.allow / at.deny 없음 — at 서비스 미사용 N/A", rec)
            return
        if issues:
            self.vulnerable(cid, name, Severity.LOW, desc,
                            "\n".join(issues), rec)
        else:
            self.safe(cid, name, Severity.LOW, desc, "at 파일 권한 양호", rec)

    def _b20(self):
        """2.20 hosts.lpd 파일 소유자 및 권한 설정"""
        cid, name = "2.20", "hosts.lpd 파일 소유자 및 권한 설정"
        path = "/etc/hosts.lpd"
        if os.path.exists(path):
            self._chk_perm(cid, name, path, 0o600, Severity.LOW,
                           f"chown root {path} && chmod 600 {path}")
        else:
            self.skipped(cid, name, Severity.LOW,
                         "hosts.lpd 파일 권한 점검",
                         "/etc/hosts.lpd 없음 — LPD 미사용 N/A",
                         "프린터 서비스 미사용 시 해당 없음")

    def _b21(self):
        """2.21 /etc/(r)syslog.conf 파일 소유자 및 권한 설정"""
        cid, name = "2.21", "/etc/(r)syslog.conf 파일 소유자 및 권한 설정"
        for path in ("/etc/rsyslog.conf", "/etc/syslog.conf"):
            if os.path.exists(path):
                self._chk_perm(cid, name, path, 0o644, Severity.LOW,
                               f"chown root {path} && chmod 644 {path}")
                return
        self.skipped(cid, name, Severity.LOW,
                     "syslog 설정 파일 권한 점검",
                     "rsyslog.conf / syslog.conf 없음 — N/A",
                     "syslog 미설치 확인 필요")

    def _b22(self):
        """2.22 world writable 파일 점검"""
        cid, name = "2.22", "world writable 파일 점검"
        desc = "모든 사용자가 쓸 수 있는(world writable) 파일이 있는지 점검합니다."
        rec  = "chmod o-w <파일> 로 other 쓰기 권한 제거"

        rc, out, _ = self._run_cmd(
            "find /etc /usr/bin /usr/sbin /bin /sbin -perm -002 -type f 2>/dev/null",
            timeout=20)
        files = [f.strip() for f in out.splitlines() if f.strip()]
        if files:
            self.vulnerable(cid, name, Severity.HIGH, desc,
                            f"world writable 파일 {len(files)}개:\n" +
                            "\n".join(files[:20]), rec)
        else:
            self.safe(cid, name, Severity.HIGH, desc,
                      "world writable 파일 없음", rec)

    def _b23(self):
        """2.23 /dev에 존재하지 않는 device 파일 점검"""
        cid, name = "2.23", "/dev에 존재하지 않는 device 파일 점검"
        desc = "/dev 디렉터리에 장치 파일이 아닌 일반 파일이 있는지 점검합니다."
        rec  = "/dev 내 일반 파일 삭제 (정상 장치 파일인지 확인 후 삭제)"

        rc, out, _ = self._run_cmd(
            "find /dev -maxdepth 2 -not -type b -not -type c -not -type d "
            "-not -type l -not -type p -not -type s 2>/dev/null", timeout=10)
        allowed = {"/dev/null", "/dev/full", "/dev/zero",
                   "/dev/random", "/dev/urandom"}
        suspicious = [f.strip() for f in out.splitlines()
                      if f.strip() and f.strip() not in allowed]
        if suspicious:
            self.vulnerable(cid, name, Severity.MEDIUM, desc,
                            f"/dev 내 비장치 파일 {len(suspicious)}개:\n" +
                            "\n".join(suspicious[:15]), rec)
        else:
            self.safe(cid, name, Severity.MEDIUM, desc,
                      "/dev 내 불필요한 파일 없음", rec)

    # ══════════════════════════════════════════════════════════
    # 3. 네트워크 서비스
    # ══════════════════════════════════════════════════════════

    def _c01(self):
        """3.1 RPC 서비스 제한"""
        cid, name = "3.1", "RPC 서비스 제한"
        desc = "불필요한 RPC 서비스(rpcbind/portmapper)가 실행 중인지 점검합니다."
        rec  = "NFS/NIS 미사용 시 systemctl disable --now rpcbind"

        running, svc = self._service_up("rpcbind", "portmap")
        if running:
            self.vulnerable(cid, name, Severity.MEDIUM, desc,
                            f"RPC 서비스 실행 중 ({svc}) — NFS/NIS 미사용 시 취약", rec)
        else:
            self.safe(cid, name, Severity.MEDIUM, desc, "RPC 서비스 미실행", rec)

    def _c02(self):
        """3.2 NFS 제한"""
        cid, name = "3.2", "NFS 제한"
        desc = "NFS 서비스 실행 여부 및 exports 와일드카드 공유를 점검합니다."
        rec  = "systemctl disable --now nfs-server; /etc/exports 접근 IP 제한"

        running, svc = self._service_up("nfs-server", "nfs-kernel-server", "nfsd")
        if not running:
            self.safe(cid, name, Severity.HIGH, desc, "NFS 서비스 미실행", rec)
            return

        content = self._read_file("/etc/exports") or ""
        wild = [l for l in content.splitlines()
                if not l.startswith("#") and l.strip() and " *(rw" in l]
        if wild:
            self.vulnerable(cid, name, Severity.HIGH, desc,
                            f"NFS 실행 중 + 와일드카드 공유 {len(wild)}개:\n" +
                            "\n".join(wild), rec)
        else:
            self.manual(cid, name, Severity.HIGH, desc,
                        f"NFS 실행 중 ({svc}) — exports 내용 수동 확인 필요", rec,
                        content[:300])

    def _c03(self):
        """3.3 Automountd 서비스 제거"""
        cid, name = "3.3", "Automountd 서비스 제거"
        desc = "자동 마운트 데몬(autofs/automountd)이 실행 중인지 점검합니다."
        rec  = "systemctl disable --now autofs"

        running, svc = self._service_up("autofs", "automount")
        if running:
            self.vulnerable(cid, name, Severity.MEDIUM, desc,
                            f"automountd 실행 중 ({svc})", rec)
        else:
            self.safe(cid, name, Severity.MEDIUM, desc, "automountd 미실행", rec)

    def _c04(self):
        """3.4 NIS 제한"""
        cid, name = "3.4", "NIS 제한"
        desc = "NIS(ypbind/ypserv) 서비스가 실행 중인지 점검합니다."
        rec  = "systemctl disable --now ypbind ypserv yppasswdd"

        running, svc = self._service_up("ypbind", "ypserv", "yppasswdd")
        if running:
            self.vulnerable(cid, name, Severity.HIGH, desc,
                            f"NIS 서비스 실행 중 ({svc})", rec)
        else:
            self.safe(cid, name, Severity.HIGH, desc, "NIS 서비스 미실행", rec)

    def _c05(self):
        """3.5 'r' commands 서비스 제거"""
        cid, name = "3.5", "'r' commands 서비스 제거"
        desc = "rsh, rlogin, rexec 등 r 계열 취약 서비스 실행 여부를 점검합니다."
        rec  = "inetd.conf/xinetd에서 rsh·rlogin·rexec 제거, SSH 사용 권고"

        ss = self._ss()
        r_ports = {":512": "rexec", ":513": "rlogin", ":514": "rsh"}
        found = [svc for port, svc in r_ports.items() if port in ss]
        if found:
            self.vulnerable(cid, name, Severity.CRITICAL, desc,
                            f"r 계열 서비스 실행 중: {', '.join(found)}", rec)
        else:
            self.safe(cid, name, Severity.CRITICAL, desc, "r 계열 서비스 미실행", rec)

    def _c06(self):
        """3.6 불필요한 서비스 제거"""
        cid, name = "3.6", "불필요한 서비스 제거"
        desc = "telnet, ftp, echo, chargen, daytime 등 취약·불필요 서비스를 점검합니다."
        rec  = "systemctl disable --now <서비스> 또는 inetd에서 제거; SSH로 대체"

        ss = self._ss()
        dangerous = {
            ":23":  "telnet",
            ":21":  "ftp(평문)",
            ":7":   "echo",
            ":9":   "discard",
            ":11":  "systat",
            ":13":  "daytime",
            ":19":  "chargen",
            ":79":  "finger",
            ":69":  "tftp",
        }
        found = [f"{svc}(:{port.lstrip(':')})"
                 for port, svc in dangerous.items() if port in ss]
        if found:
            self.vulnerable(cid, name, Severity.HIGH, desc,
                            f"불필요/취약 서비스: {', '.join(found)}", rec, ss[:500])
        else:
            self.safe(cid, name, Severity.HIGH, desc,
                      "주요 취약 서비스 미실행", rec)

    def _c07(self):
        """3.7 서비스 Banner 관리"""
        cid, name = "3.7", "서비스 Banner 관리"
        desc = ("로그인 배너(/etc/issue, /etc/issue.net)에 OS·버전 정보 노출 여부 및 "
                "SSH 배너 설정 여부를 점검합니다.")
        rec  = ("/etc/issue.net 내용을 경고 문구로 교체\n"
                "sshd_config: Banner /etc/issue.net 설정")

        issues = []
        sensitive = ["ubuntu", "debian", "centos", "red hat", "fedora",
                     "kernel", "release", "version", "linux"]
        for path in ("/etc/issue", "/etc/issue.net"):
            content = (self._read_file(path) or "").lower()
            found = [k for k in sensitive if k in content]
            if found:
                issues.append(f"{path}: {', '.join(found)} 노출")

        sshd = self._read_file("/etc/ssh/sshd_config") or ""
        has_banner = any(
            "Banner" in l and not l.strip().startswith("#")
            for l in sshd.splitlines()
        )
        if not has_banner:
            issues.append("sshd_config: Banner 미설정")

        if issues:
            self.vulnerable(cid, name, Severity.MEDIUM, desc,
                            "\n".join(issues), rec)
        else:
            self.safe(cid, name, Severity.MEDIUM, desc,
                      "배너 정보 노출 없음, SSH 배너 설정됨", rec)

    def _c08(self):
        """3.8 session timeout 설정"""
        cid, name = "3.8", "session timeout 설정"
        desc = "비활성 세션이 자동으로 종료되도록 TMOUT 및 SSH ClientAliveInterval을 점검합니다."
        rec  = ("/etc/profile: export TMOUT=300\n"
                "sshd_config: ClientAliveInterval 300, ClientAliveCountMax 3")

        issues = []
        # TMOUT
        tmout_set = False
        for path in ("/etc/profile", "/etc/bashrc", "/etc/bash.bashrc",
                     "/etc/profile.d/timeout.sh"):
            content = self._read_file(path) or ""
            for line in content.splitlines():
                if "TMOUT" in line and not line.strip().startswith("#"):
                    m = re.search(r"TMOUT\s*=\s*(\d+)", line)
                    if m:
                        val = int(m.group(1))
                        if val <= 0 or val > 600:
                            issues.append(f"TMOUT={val} (1~600 권고)")
                        tmout_set = True
        if not tmout_set:
            issues.append("TMOUT 미설정 — 세션 자동 종료 없음")

        # SSH
        sshd = self._read_file("/etc/ssh/sshd_config") or ""
        settings = {}
        for line in sshd.splitlines():
            s = line.strip()
            if s and not s.startswith("#"):
                parts = s.split()
                if len(parts) >= 2:
                    settings[parts[0].lower()] = parts[1]

        alive_interval = int(settings.get("clientaliveinterval", "0"))
        if alive_interval == 0:
            issues.append("SSH ClientAliveInterval 미설정")
        elif alive_interval > 600:
            issues.append(f"SSH ClientAliveInterval={alive_interval} (600 초과)")

        if issues:
            self.vulnerable(cid, name, Severity.MEDIUM, desc,
                            "\n".join(issues), rec)
        else:
            self.safe(cid, name, Severity.MEDIUM, desc,
                      f"세션 타임아웃 설정됨 (TMOUT, SSH ClientAliveInterval={alive_interval})", rec)

    def _c09(self):
        """3.9 root 계정 telnet·SSH 접근 제한"""
        cid, name = "3.9", "root 계정 telnet·SSH 접근 제한"
        desc = "root가 telnet/SSH로 직접 로그인할 수 없도록 제한되어 있는지 점검합니다."
        rec  = ("sshd_config: PermitRootLogin no\n"
                "/etc/securetty: tty 항목만 남기고 pts/N 제거")

        issues = []
        # SSH
        sshd = self._read_file("/etc/ssh/sshd_config") or ""
        prl = None
        for line in sshd.splitlines():
            s = line.strip()
            if s.startswith("PermitRootLogin") and not s.startswith("#"):
                prl = s.split()[-1].lower()
                break
        if prl in (None, "yes", "without-password", "prohibit-password"):
            issues.append(f"SSH PermitRootLogin={prl or '미설정(기본 허용)'}")

        # telnet: securetty 확인
        securetty = self._read_file("/etc/securetty") or ""
        pts_lines = [l for l in securetty.splitlines()
                     if l.startswith("pts/") and not l.startswith("#")]
        if pts_lines:
            issues.append(f"/etc/securetty에 pts 항목 존재: {', '.join(pts_lines[:5])}")

        if issues:
            self.vulnerable(cid, name, Severity.CRITICAL, desc,
                            "\n".join(issues), rec)
        else:
            self.safe(cid, name, Severity.CRITICAL, desc,
                      "root 원격 접근 제한 적용됨", rec)

    def _c10(self):
        """3.10 DNS 보안 버전 패치"""
        cid, name = "3.10", "DNS 보안 버전 패치"
        desc = "BIND DNS 서버가 실행 중인 경우 최신 보안 버전인지, version.bind 노출 여부를 점검합니다."
        rec  = ("최신 BIND 버전으로 업그레이드\n"
                "named.conf: version \"unknown\"; 으로 버전 정보 숨김")

        running, _ = self._service_up("named", "bind9")
        if not running:
            self.skipped(cid, name, Severity.HIGH, desc,
                         "BIND DNS 미실행 — N/A", rec)
            return

        rc, ver, _ = self._run_cmd("named -v 2>&1")
        # version.bind 쿼리로 노출 여부 확인
        rc2, dig_out, _ = self._run_cmd(
            "dig @localhost version.bind chaos txt +short 2>/dev/null", timeout=5)
        issues = []
        if rc2 == 0 and dig_out.strip():
            issues.append(f"version.bind 응답 허용: {dig_out.strip()}")

        self.manual(cid, name, Severity.HIGH, desc,
                    f"BIND 실행 중: {ver.strip() or '버전 확인 불가'}\n" +
                    ("\n".join(issues) if issues else "version.bind 응답 없음(양호)") +
                    "\n※ 최신 보안 버전 여부는 https://www.isc.org/bind/ 에서 수동 확인 필요",
                    rec, ver)

    # ══════════════════════════════════════════════════════════
    # 4. 로그 관리
    # ══════════════════════════════════════════════════════════

    def _d01(self):
        """4.1 (x)inetd Services 로그 설정"""
        cid, name = "4.1", "(x)inetd Services 로그 설정"
        desc = "inetd/xinetd 서비스의 로그 설정 여부를 점검합니다."
        rec  = "xinetd: log_type = SYSLOG authpriv / inetd: syslog 통해 로깅"

        xinetd_conf = self._read_file("/etc/xinetd.conf") or ""
        if not xinetd_conf and not os.path.exists("/etc/inetd.conf"):
            self.skipped(cid, name, Severity.LOW, desc,
                         "inetd/xinetd 미설치 — N/A", rec)
            return

        if "log_type" in xinetd_conf:
            self.safe(cid, name, Severity.LOW, desc,
                      "xinetd log_type 설정됨", rec)
        else:
            self.vulnerable(cid, name, Severity.LOW, desc,
                            "log_type 미설정", rec, xinetd_conf[:200])

    def _d02(self):
        """4.2 시스템 로그 설정"""
        cid, name = "4.2", "시스템 로그 설정"
        desc = "rsyslog/syslog 서비스 실행 여부 및 auth, kern, cron 등 주요 facility 로깅 여부를 점검합니다."
        rec  = "systemctl enable --now rsyslog; rsyslog.conf에 auth.* kern.* cron.* 설정"

        running, svc = self._service_up("rsyslog", "syslog", "syslogd")
        issues = []
        if not running:
            issues.append("rsyslog/syslog 서비스 미실행")

        content = ""
        for p in ("/etc/rsyslog.conf", "/etc/syslog.conf"):
            c = self._read_file(p)
            if c:
                content = c
                break

        if content:
            for facility in ("auth", "kern", "cron"):
                if not any(facility in l and not l.strip().startswith("#")
                           for l in content.splitlines()):
                    issues.append(f"{facility} facility 로깅 미설정")
        else:
            issues.append("syslog 설정 파일 없음")

        if issues:
            self.vulnerable(cid, name, Severity.MEDIUM, desc,
                            "\n".join(issues), rec)
        else:
            self.safe(cid, name, Severity.MEDIUM, desc,
                      f"시스템 로그 설정 양호 ({svc} 실행 중)", rec)

    def _d03(self):
        """4.3 로그 저장 주기"""
        cid, name = "4.3", "로그 저장 주기"
        desc = "logrotate 설정이 있고, 로그 보관 기간이 적절한지(rotate ≥ 4 권고) 점검합니다."
        rec  = "/etc/logrotate.conf: rotate 12 이상; weekly 또는 monthly 설정"

        content = self._read_file("/etc/logrotate.conf")
        if content is None:
            self.vulnerable(cid, name, Severity.MEDIUM, desc,
                            "logrotate.conf 없음 — 로그 순환 미설정", rec)
            return

        rotate_vals = re.findall(r"^\s*rotate\s+(\d+)", content, re.MULTILINE)
        if rotate_vals:
            min_rot = min(int(v) for v in rotate_vals)
            if min_rot < 4:
                self.vulnerable(cid, name, Severity.MEDIUM, desc,
                                f"rotate={min_rot} (4 미만 — 보관 기간 부족)", rec,
                                content[:300])
            else:
                self.safe(cid, name, Severity.MEDIUM, desc,
                          f"logrotate rotate={min_rot} (양호)", rec)
        else:
            self.manual(cid, name, Severity.MEDIUM, desc,
                        "rotate 값 파싱 불가 — logrotate.conf 수동 확인 필요", rec)

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
