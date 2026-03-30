"""
OS - Linux 취약점 진단 모듈
주요 점검 영역: 계정/패스워드, 파일 권한, 서비스, 네트워크, 로그, 커널/패치
"""
from core.base_scanner import BaseScanner
from core.result import ScanReport, Severity


class LinuxScanner(BaseScanner):
    CATEGORY = "OS-Linux"

    def run(self) -> ScanReport:
        print(f"\n[*] Linux 취약점 진단 시작 → {self.target}")
        self._check_root_login()
        self._check_password_policy()
        self._check_empty_password()
        self._check_uid0_accounts()
        self._check_suid_files()
        self._check_world_writable()
        self._check_umask()
        self._check_shadow_permission()
        self._check_passwd_permission()
        self._check_ssh_config()
        self._check_unnecessary_services()
        self._check_cron_permission()
        self._check_syslog()
        self._check_kernel_version()
        self.report.finish()
        return self.report

    # ── 계정 관리 ──────────────────────────────────────────────────

    def _check_root_login(self):
        cid, name = "OS-L-01", "root 계정 원격 로그인 제한"
        desc = "/etc/ssh/sshd_config에서 PermitRootLogin 설정을 확인합니다."
        rec = "sshd_config에 'PermitRootLogin no' 설정 후 sshd 재시작"

        content = self._read_file("/etc/ssh/sshd_config")
        if content is None:
            self.error(cid, name, Severity.CRITICAL, desc, "sshd_config 파일을 읽을 수 없습니다.", rec)
            return
        for line in content.splitlines():
            stripped = line.strip()
            if stripped.startswith("PermitRootLogin"):
                val = stripped.split()[-1].lower()
                if val in ("yes", "without-password", "prohibit-password"):
                    self.vulnerable(cid, name, Severity.CRITICAL, desc,
                                    f"PermitRootLogin = {val} (원격 root 로그인 허용)", rec, stripped)
                else:
                    self.safe(cid, name, Severity.CRITICAL, desc,
                              f"PermitRootLogin = {val}", rec, stripped)
                return
        self.vulnerable(cid, name, Severity.CRITICAL, desc,
                        "PermitRootLogin 설정 없음 (기본값 허용)", rec)

    def _check_password_policy(self):
        cid, name = "OS-L-02", "패스워드 복잡도 및 최소 길이 설정"
        desc = "/etc/login.defs 또는 PAM 설정에서 패스워드 정책을 확인합니다."
        rec = "/etc/login.defs: PASS_MIN_LEN 8 이상, PAM pwquality 모듈 적용"

        content = self._read_file("/etc/login.defs")
        if content is None:
            self.error(cid, name, Severity.HIGH, desc, "login.defs 읽기 실패", rec)
            return
        min_len = None
        for line in content.splitlines():
            s = line.strip()
            if s.startswith("PASS_MIN_LEN"):
                try:
                    min_len = int(s.split()[1])
                except (IndexError, ValueError):
                    pass
        if min_len is None or min_len < 8:
            self.vulnerable(cid, name, Severity.HIGH, desc,
                            f"PASS_MIN_LEN = {min_len} (8 미만 또는 미설정)", rec)
        else:
            self.safe(cid, name, Severity.HIGH, desc, f"PASS_MIN_LEN = {min_len}", rec)

    def _check_empty_password(self):
        cid, name = "OS-L-03", "빈 패스워드 계정 존재 여부"
        desc = "/etc/shadow에서 패스워드 필드가 비어있는 계정을 확인합니다."
        rec = "해당 계정에 패스워드를 설정하거나 계정을 잠금 처리"

        content = self._read_file("/etc/shadow")
        if content is None:
            self.manual(cid, name, Severity.CRITICAL, desc,
                        "shadow 파일 접근 불가 (root 권한 필요) — 수동 점검 필요", rec)
            return
        empty_accounts = []
        for line in content.splitlines():
            parts = line.split(":")
            if len(parts) >= 2 and parts[1] in ("", "!!", "*"):
                if parts[1] == "":
                    empty_accounts.append(parts[0])
        if empty_accounts:
            self.vulnerable(cid, name, Severity.CRITICAL, desc,
                            f"빈 패스워드 계정: {', '.join(empty_accounts)}", rec)
        else:
            self.safe(cid, name, Severity.CRITICAL, desc, "빈 패스워드 계정 없음", rec)

    def _check_uid0_accounts(self):
        cid, name = "OS-L-04", "UID=0 계정 확인 (root 외)"
        desc = "/etc/passwd에서 UID가 0인 계정(root 제외)을 확인합니다."
        rec = "root 외 UID=0 계정 제거 또는 UID 변경"

        content = self._read_file("/etc/passwd")
        if content is None:
            self.error(cid, name, Severity.CRITICAL, desc, "passwd 파일 읽기 실패", rec)
            return
        uid0 = [line.split(":")[0] for line in content.splitlines()
                if len(line.split(":")) >= 3 and line.split(":")[2] == "0"
                and line.split(":")[0] != "root"]
        if uid0:
            self.vulnerable(cid, name, Severity.CRITICAL, desc,
                            f"UID=0 계정 발견: {', '.join(uid0)}", rec)
        else:
            self.safe(cid, name, Severity.CRITICAL, desc, "root 외 UID=0 계정 없음", rec)

    # ── 파일 권한 ──────────────────────────────────────────────────

    def _check_suid_files(self):
        cid, name = "OS-L-05", "불필요한 SUID/SGID 파일 존재 여부"
        desc = "SUID/SGID 비트가 설정된 실행 파일을 점검합니다."
        rec = "불필요한 SUID/SGID 파일에서 chmod -s 로 비트 제거"

        rc, out, err = self._run_cmd("find /usr/bin /usr/sbin /bin /sbin -perm /6000 -type f", timeout=15)
        if rc != 0 or not out:
            self.manual(cid, name, Severity.HIGH, desc, "SUID/SGID 파일 검색 실패 — 수동 점검 필요", rec, err)
            return
        files = out.splitlines()
        # 일반적으로 허용되는 목록
        known_safe = {"/usr/bin/passwd", "/usr/bin/sudo", "/usr/bin/su",
                      "/bin/su", "/bin/passwd", "/usr/bin/chsh", "/usr/bin/chfn",
                      "/usr/bin/newgrp", "/usr/bin/gpasswd"}
        suspicious = [f for f in files if f not in known_safe]
        if suspicious:
            self.vulnerable(cid, name, Severity.HIGH, desc,
                            f"의심 SUID/SGID 파일 {len(suspicious)}개 발견", rec,
                            "\n".join(suspicious))
        else:
            self.safe(cid, name, Severity.HIGH, desc,
                      f"SUID/SGID 파일 {len(files)}개 (모두 일반적)", rec)

    def _check_world_writable(self):
        cid, name = "OS-L-06", "중요 디렉토리 World-Writable 권한 확인"
        desc = "/etc, /usr, /bin 등 중요 경로의 world-writable 파일을 확인합니다."
        rec = "해당 파일/디렉토리에서 chmod o-w 로 other 쓰기 권한 제거"

        rc, out, err = self._run_cmd("find /etc /usr/bin /usr/sbin /bin /sbin -perm -002 -type f", timeout=15)
        if rc != 0:
            self.manual(cid, name, Severity.HIGH, desc, "검색 실패 — 수동 점검 필요", rec, err)
            return
        files = [f for f in out.splitlines() if f]
        if files:
            self.vulnerable(cid, name, Severity.HIGH, desc,
                            f"world-writable 파일 {len(files)}개", rec, "\n".join(files[:20]))
        else:
            self.safe(cid, name, Severity.HIGH, desc, "world-writable 파일 없음", rec)

    def _check_umask(self):
        cid, name = "OS-L-07", "기본 umask 설정"
        desc = "/etc/profile, /etc/bashrc 등에서 umask 설정을 확인합니다."
        rec = "umask 022 이상(022 또는 027) 으로 설정"

        umask_found = None
        for path in ("/etc/profile", "/etc/bashrc", "/etc/bash.bashrc"):
            content = self._read_file(path)
            if content is None:
                continue
            for line in content.splitlines():
                s = line.strip()
                if s.startswith("umask"):
                    try:
                        umask_found = s.split()[1]
                    except IndexError:
                        pass
        if umask_found is None:
            self.manual(cid, name, Severity.MEDIUM, desc, "umask 설정 확인 불가", rec)
        elif umask_found in ("022", "027", "0022", "0027"):
            self.safe(cid, name, Severity.MEDIUM, desc, f"umask = {umask_found}", rec)
        else:
            self.vulnerable(cid, name, Severity.MEDIUM, desc,
                            f"umask = {umask_found} (권장: 022 이상)", rec)

    def _check_shadow_permission(self):
        cid, name = "OS-L-08", "/etc/shadow 파일 권한"
        desc = "/etc/shadow 파일의 권한이 400 이하인지 확인합니다."
        rec = "chmod 400 /etc/shadow 또는 chmod 000 /etc/shadow"

        rc, out, _ = self._run_cmd("stat -c '%a %n' /etc/shadow")
        if rc != 0 or not out:
            self.manual(cid, name, Severity.CRITICAL, desc, "stat 실패 — 수동 점검 필요", rec)
            return
        perm = out.split()[0]
        try:
            if int(perm, 8) > 0o400:
                self.vulnerable(cid, name, Severity.CRITICAL, desc,
                                f"/etc/shadow 권한: {perm} (400 초과)", rec, out)
            else:
                self.safe(cid, name, Severity.CRITICAL, desc,
                          f"/etc/shadow 권한: {perm}", rec)
        except ValueError:
            self.error(cid, name, Severity.CRITICAL, desc, f"권한 파싱 실패: {perm}", rec)

    def _check_passwd_permission(self):
        cid, name = "OS-L-09", "/etc/passwd 파일 권한"
        desc = "/etc/passwd 파일의 권한이 644 이하인지 확인합니다."
        rec = "chmod 644 /etc/passwd"

        rc, out, _ = self._run_cmd("stat -c '%a %n' /etc/passwd")
        if rc != 0 or not out:
            self.manual(cid, name, Severity.HIGH, desc, "stat 실패 — 수동 점검 필요", rec)
            return
        perm = out.split()[0]
        try:
            if int(perm, 8) > 0o644:
                self.vulnerable(cid, name, Severity.HIGH, desc,
                                f"/etc/passwd 권한: {perm} (644 초과)", rec, out)
            else:
                self.safe(cid, name, Severity.HIGH, desc, f"/etc/passwd 권한: {perm}", rec)
        except ValueError:
            self.error(cid, name, Severity.HIGH, desc, f"권한 파싱 실패: {perm}", rec)

    # ── SSH 설정 ───────────────────────────────────────────────────

    def _check_ssh_config(self):
        cid, name = "OS-L-10", "SSH 보안 설정 (Protocol, MaxAuthTries 등)"
        desc = "sshd_config의 주요 보안 설정을 확인합니다."
        rec = "Protocol 2, MaxAuthTries 5, PermitEmptyPasswords no 설정"

        content = self._read_file("/etc/ssh/sshd_config")
        if content is None:
            self.error(cid, name, Severity.HIGH, desc, "sshd_config 읽기 실패", rec)
            return

        issues = []
        settings = {}
        for line in content.splitlines():
            s = line.strip()
            if not s or s.startswith("#"):
                continue
            parts = s.split()
            if len(parts) >= 2:
                settings[parts[0].lower()] = parts[1].lower()

        if settings.get("protocol", "2") != "2":
            issues.append(f"Protocol = {settings['protocol']} (SSHv1 사용)")
        max_tries = int(settings.get("maxauthtries", "6"))
        if max_tries > 5:
            issues.append(f"MaxAuthTries = {max_tries} (5 초과)")
        if settings.get("permitemptypasswords", "no") == "yes":
            issues.append("PermitEmptyPasswords = yes")

        if issues:
            self.vulnerable(cid, name, Severity.HIGH, desc, " | ".join(issues), rec)
        else:
            self.safe(cid, name, Severity.HIGH, desc, "SSH 보안 설정 양호", rec)

    # ── 서비스 ─────────────────────────────────────────────────────

    def _check_unnecessary_services(self):
        cid, name = "OS-L-11", "불필요한 서비스 실행 여부"
        desc = "telnet, ftp, rsh, rlogin 등 취약한 서비스 실행 여부를 확인합니다."
        rec = "systemctl disable --now <서비스명> 으로 불필요한 서비스 중지"

        dangerous = ["telnet", "ftp", "vsftpd", "rsh", "rlogin", "rexec",
                     "tftp", "nntp", "imap", "pop3"]
        rc, out, _ = self._run_cmd("ss -tlnp")
        if rc != 0:
            rc, out, _ = self._run_cmd("netstat -tlnp")
        found = [svc for svc in dangerous if svc in out.lower()]
        if found:
            self.vulnerable(cid, name, Severity.HIGH, desc,
                            f"취약 서비스 실행 중: {', '.join(found)}", rec, out[:500])
        else:
            self.safe(cid, name, Severity.HIGH, desc, "취약 서비스 미실행", rec)

    # ── Cron ───────────────────────────────────────────────────────

    def _check_cron_permission(self):
        cid, name = "OS-L-12", "cron 설정 파일 권한"
        desc = "/etc/crontab 파일의 소유자 및 권한을 확인합니다."
        rec = "chown root /etc/crontab && chmod 600 /etc/crontab"

        rc, out, _ = self._run_cmd("stat -c '%a %U' /etc/crontab")
        if rc != 0 or not out:
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
        if owner != "root":
            issues.append(f"소유자 {owner} (root 아님)")
        if issues:
            self.vulnerable(cid, name, Severity.MEDIUM, desc, " | ".join(issues), rec, out)
        else:
            self.safe(cid, name, Severity.MEDIUM, desc, f"권한 {perm}, 소유자 {owner}", rec)

    # ── 로그 ───────────────────────────────────────────────────────

    def _check_syslog(self):
        cid, name = "OS-L-13", "syslog/rsyslog 서비스 실행 여부"
        desc = "시스템 로그 데몬(rsyslog/syslog)이 실행 중인지 확인합니다."
        rec = "systemctl enable --now rsyslog"

        rc, out, _ = self._run_cmd("systemctl is-active rsyslog")
        if out.strip() == "active":
            self.safe(cid, name, Severity.MEDIUM, desc, "rsyslog 실행 중", rec)
            return
        rc2, out2, _ = self._run_cmd("systemctl is-active syslog")
        if out2.strip() == "active":
            self.safe(cid, name, Severity.MEDIUM, desc, "syslog 실행 중", rec)
        else:
            self.vulnerable(cid, name, Severity.MEDIUM, desc,
                            "rsyslog/syslog 미실행", rec)

    # ── 커널 ───────────────────────────────────────────────────────

    def _check_kernel_version(self):
        cid, name = "OS-L-14", "커널 버전 확인 (정보 수집)"
        desc = "현재 커널 버전을 수집합니다. 최신 보안 패치 적용 여부를 수동으로 확인하세요."
        rec = "apt upgrade / yum update 등으로 최신 커널 유지"

        rc, out, _ = self._run_cmd("uname -r")
        self.manual(cid, name, Severity.INFO, desc,
                    f"커널 버전: {out or '확인 불가'}", rec, out)
