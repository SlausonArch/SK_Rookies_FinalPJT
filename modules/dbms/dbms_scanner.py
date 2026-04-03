"""
DBMS 취약점 진단 모듈 (stub)
지원: MySQL/MariaDB, PostgreSQL, MSSQL
주통기 2026 개정 반영

[2026 개정 추가 항목]
  DB-07  DBMS 프로세스 root 권한 구동 여부  (2026 신규)
  DB-08  패스워드 강력 해시 알고리즘 사용   (2026 신규 — SHA-256/bcrypt)
  DB-09  계정 잠금 정책 설정                (2026 신규)
  DB-23  xp_cmdshell 프로시저 비활성화      (2026 신규 — MSSQL 전용)
  DB-24  레지스트리 접근 프로시저 비활성화  (2026 신규 — MSSQL 전용)
"""
from core.base_scanner import BaseScanner
from core.result import ScanReport, Severity


class DBMSScanner(BaseScanner):
    CATEGORY = "DBMS"

    SUPPORTED_TYPES = ["mysql", "postgresql", "mssql"]

    def __init__(self, target: str = "localhost", verbose: bool = False,
                 db_type: str = "mysql", port: int = 0,
                 user: str = "", password: str = ""):
        super().__init__(target, verbose)
        self.db_type = db_type.lower()
        self.port = port or self._default_port()
        self.user = user
        self.password = password
        self.CATEGORY = f"DBMS-{self.db_type.upper()}"

    def _default_port(self) -> int:
        return {"mysql": 3306, "postgresql": 5432, "mssql": 1433}.get(self.db_type, 3306)

    def run(self) -> ScanReport:
        print(f"\n[*] DBMS({self.db_type}) 취약점 진단 시작 → {self.target}:{self.port}")
        self._check_port_open()
        self._check_default_account()
        self._check_version_info()
        self._check_remote_root_login()
        self._check_audit_logging()
        self._check_data_dir_permission()
        self._check_root_process()          # ★2026 DB-07
        self._check_password_hash()         # ★2026 DB-08
        self._check_account_lockout()       # ★2026 DB-09
        if self.db_type == "mssql":
            self._check_xp_cmdshell()       # ★2026 DB-23
            self._check_registry_procs()    # ★2026 DB-24
        self.report.finish()
        return self.report

    # ── 공통 ───────────────────────────────────────────────────────

    def _check_port_open(self):
        cid, name = "DB-01", f"{self.db_type.upper()} 포트 외부 노출 여부"
        desc = f"DBMS 포트({self.port})가 외부에 열려 있는지 확인합니다."
        rec = f"방화벽으로 {self.port} 포트를 필요한 IP만 허용하도록 제한"

        rc, out, _ = self._run_cmd(f"nc -zv {self.target} {self.port}", timeout=5)
        if rc == 0 or "succeeded" in out.lower() or "open" in out.lower():
            self.vulnerable(cid, name, Severity.HIGH, desc,
                            f"포트 {self.port} 열려 있음 (외부 접근 가능)", rec, out)
        else:
            self.safe(cid, name, Severity.HIGH, desc,
                      f"포트 {self.port} 닫혀 있음 또는 필터링됨", rec)

    def _check_default_account(self):
        cid, name = "DB-02", "기본 계정 및 빈 패스워드 계정 확인"
        desc = "DBMS 기본 계정(root, sa, postgres 등)의 패스워드가 설정되어 있는지 확인합니다."
        rec = "기본 계정 패스워드 설정 또는 계정 비활성화"

        if self.db_type == "mysql":
            self._mysql_check_empty_password(cid, name, desc, rec)
        elif self.db_type == "postgresql":
            self.manual(cid, name, Severity.CRITICAL, desc,
                        "psql로 직접 접속하여 pg_shadow 테이블 확인 필요", rec)
        elif self.db_type == "mssql":
            self.manual(cid, name, Severity.CRITICAL, desc,
                        "SSMS 또는 sqlcmd로 sa 계정 패스워드 설정 여부 확인 필요", rec)

    def _mysql_check_empty_password(self, cid, name, desc, rec):
        if not self.user:
            self.manual(cid, name, Severity.CRITICAL, desc,
                        "MySQL 접속 계정 미입력 — 수동 점검 필요", rec)
            return
        query = "SELECT user, host FROM mysql.user WHERE authentication_string='' OR authentication_string IS NULL;"
        rc, out, err = self._run_cmd(
            f"mysql -h {self.target} -P {self.port} -u {self.user} -p{self.password} "
            f"-e \"{query}\" --batch --skip-column-names",
            timeout=10,
        )
        if rc != 0:
            self.error(cid, name, Severity.CRITICAL, desc, f"MySQL 접속 실패: {err}", rec)
            return
        empty_users = [line for line in out.splitlines() if line.strip()]
        if empty_users:
            self.vulnerable(cid, name, Severity.CRITICAL, desc,
                            f"빈 패스워드 계정: {len(empty_users)}개", rec,
                            "\n".join(empty_users))
        else:
            self.safe(cid, name, Severity.CRITICAL, desc, "빈 패스워드 계정 없음", rec)

    def _check_version_info(self):
        cid, name = "DB-03", "DBMS 버전 정보 수집"
        desc = "현재 DBMS 버전을 확인합니다. 최신 보안 패치 적용 여부를 수동으로 검토하세요."
        rec = "공식 지원 버전으로 업그레이드 및 최신 패치 유지"

        if self.db_type == "mysql":
            rc, out, err = self._run_cmd(
                f"mysql -h {self.target} -P {self.port} -u {self.user} -p{self.password} "
                "-e 'SELECT VERSION();' --batch --skip-column-names",
                timeout=10,
            )
        elif self.db_type == "postgresql":
            rc, out, err = self._run_cmd(
                f"psql -h {self.target} -p {self.port} -U {self.user} -c 'SELECT version();' -t",
                timeout=10,
            )
        else:
            self.manual(cid, name, Severity.INFO, desc, "수동으로 버전 확인 필요", rec)
            return

        version = out.strip() if rc == 0 else "확인 불가"
        self.manual(cid, name, Severity.INFO, desc, f"버전: {version}", rec, out)

    def _check_remote_root_login(self):
        cid, name = "DB-04", "원격 root/관리자 계정 로그인 허용 여부"
        desc = "DBMS 관리자 계정의 원격 로그인이 허용되어 있는지 확인합니다."
        rec = "관리자 계정의 host를 'localhost'/'127.0.0.1'로 제한"

        if self.db_type != "mysql":
            self.manual(cid, name, Severity.CRITICAL, desc,
                        f"{self.db_type} 관리자 계정의 원격 접속 여부 수동 확인 필요", rec)
            return
        if not self.user:
            self.manual(cid, name, Severity.CRITICAL, desc,
                        "MySQL 접속 계정 미입력 — 수동 점검 필요", rec)
            return
        query = "SELECT user, host FROM mysql.user WHERE user='root' AND host NOT IN ('localhost', '127.0.0.1', '::1');"
        rc, out, err = self._run_cmd(
            f"mysql -h {self.target} -P {self.port} -u {self.user} -p{self.password} "
            f"-e \"{query}\" --batch --skip-column-names",
            timeout=10,
        )
        if rc != 0:
            self.error(cid, name, Severity.CRITICAL, desc, f"MySQL 접속 실패: {err}", rec)
            return
        rows = [r for r in out.splitlines() if r.strip()]
        if rows:
            self.vulnerable(cid, name, Severity.CRITICAL, desc,
                            f"원격 root 계정 존재: {len(rows)}개", rec, "\n".join(rows))
        else:
            self.safe(cid, name, Severity.CRITICAL, desc, "root 계정 원격 로그인 제한됨", rec)

    def _check_audit_logging(self):
        cid, name = "DB-05", "DBMS 감사 로깅 설정"
        desc = "쿼리 감사 로그가 활성화되어 있는지 확인합니다."
        rec = "MySQL: general_log=ON 또는 audit_log 플러그인 활성화"

        if self.db_type == "mysql":
            if not self.user:
                self.manual(cid, name, Severity.MEDIUM, desc, "접속 계정 미입력 — 수동 점검 필요", rec)
                return
            rc, out, _ = self._run_cmd(
                f"mysql -h {self.target} -P {self.port} -u {self.user} -p{self.password} "
                "-e \"SHOW VARIABLES LIKE 'general_log';\" --batch --skip-column-names",
                timeout=10,
            )
            if rc != 0:
                self.error(cid, name, Severity.MEDIUM, desc, "쿼리 실패", rec)
                return
            if "on" in out.lower():
                self.safe(cid, name, Severity.MEDIUM, desc, "general_log 활성화됨", rec, out)
            else:
                self.vulnerable(cid, name, Severity.MEDIUM, desc, "general_log 비활성화됨", rec, out)
        else:
            self.manual(cid, name, Severity.MEDIUM, desc,
                        f"{self.db_type} 감사 로그 설정 수동 확인 필요", rec)

    def _check_data_dir_permission(self):
        cid, name = "DB-06", "DBMS 데이터 디렉토리 권한"
        desc = "DBMS 데이터 디렉토리가 다른 사용자에게 읽기 가능한지 확인합니다."
        rec = "chmod 700 <data_dir> && chown mysql:mysql <data_dir>"

        data_dirs = {
            "mysql": ["/var/lib/mysql", "/data/mysql"],
            "postgresql": ["/var/lib/postgresql", "/var/lib/pgsql"],
            "mssql": [],
        }
        for data_dir in data_dirs.get(self.db_type, []):
            import os
            if not os.path.exists(data_dir):
                continue
            rc, out, _ = self._run_cmd(f"stat -c '%a %U' {data_dir}")
            if rc != 0:
                continue
            parts = out.split()
            perm = parts[0]
            try:
                if int(perm, 8) & 0o007:
                    self.vulnerable(cid, name, Severity.HIGH, desc,
                                    f"{data_dir} 권한: {perm} (other 접근 가능)", rec, out)
                else:
                    self.safe(cid, name, Severity.HIGH, desc,
                              f"{data_dir} 권한: {perm}", rec)
            except ValueError:
                pass
            return

        self.manual(cid, name, Severity.HIGH, desc,
                    "데이터 디렉토리 경로 확인 불가 — 수동 점검 필요", rec)

    def _check_root_process(self):
        """DB-07 DBMS 프로세스 root 권한 구동 여부 [★2026 신규]
        주통기 2026: DBMS 프로세스가 root 계정으로 실행 시 취약점 악용 시
        시스템 전체 권한 탈취 가능. 전용 서비스 계정(mysql, postgres 등)으로 구동 필요.
        """
        cid, name = "DB-07", "DBMS 프로세스 root 권한 구동 여부"
        desc = ("DBMS 프로세스가 root 계정으로 실행될 경우 SQL 인젝션 등 "
                "취약점 악용 시 OS 전체 권한 탈취 위험. "
                "전용 서비스 계정(mysql, postgres, mssql)으로 구동 필요.")
        rec = ("MySQL: /etc/mysql/mysql.conf.d/mysqld.cnf 에서 user=mysql 설정\n"
               "PostgreSQL: postgres 계정으로 pg_ctl 실행\n"
               "MSSQL: 전용 서비스 계정 사용 (NT SERVICE\\MSSQLSERVER)")

        proc_names = {
            "mysql": ["mysqld", "mysql"],
            "postgresql": ["postgres", "postmaster"],
            "mssql": ["sqlservr"],
        }
        target_procs = proc_names.get(self.db_type, [self.db_type])
        proc_pattern = "|".join(target_procs)

        cmd = f"ps aux | grep -E '{proc_pattern}' | grep -v grep"
        rc, out, _ = self._run_cmd(cmd, timeout=10)

        if not out.strip():
            self.manual(cid, name, Severity.HIGH, desc,
                        "DBMS 프로세스 확인 불가 — 수동 점검 필요", rec,
                        command=cmd, cmd_output=out)
            return

        root_procs = [line for line in out.splitlines() if line.startswith("root ")]

        if root_procs:
            self.vulnerable(cid, name, Severity.HIGH, desc,
                            f"DBMS 프로세스가 root 계정으로 실행 중:\n"
                            + "\n".join(root_procs),
                            rec, command=cmd, cmd_output=out,
                            evidence="\n".join(root_procs))
        else:
            self.safe(cid, name, Severity.HIGH, desc,
                      "DBMS 프로세스가 전용 계정으로 실행 중 (root 아님)",
                      rec, command=cmd, cmd_output=out)

    def _check_password_hash(self):
        """DB-08 패스워드 강력 해시 알고리즘 사용 [★2026 신규]
        주통기 2026: MD5 등 취약 해시 알고리즘 사용 시 레인보우 테이블 공격 위험.
        MySQL: caching_sha2_password(SHA-256) 사용 여부 점검.
        """
        cid, name = "DB-08", "패스워드 강력 해시 알고리즘 사용"
        desc = ("MD5 기반 패스워드 플러그인(mysql_native_password) 사용 시 "
                "레인보우 테이블 공격에 취약. MySQL 8.0+ caching_sha2_password 권장.")
        rec = ("MySQL 8.0+: ALTER USER [계정] IDENTIFIED WITH caching_sha2_password BY '...';\n"
               "my.cnf: default_authentication_plugin=caching_sha2_password")

        if self.db_type == "mysql":
            if not self.user:
                self.manual(cid, name, Severity.HIGH, desc,
                            "접속 계정 미입력 — 수동 점검 필요", rec)
                return

            query = ("SELECT user, plugin FROM mysql.user "
                     "WHERE plugin NOT IN ('caching_sha2_password','mysql_old_password') "
                     "AND plugin='mysql_native_password';")
            rc, out, err = self._run_cmd(
                f"mysql -h {self.target} -P {self.port} -u {self.user} -p{self.password} "
                f'-e "{query}" --batch --skip-column-names',
                timeout=10,
            )
            if rc != 0:
                self.error(cid, name, Severity.HIGH, desc, f"쿼리 실패: {err}", rec)
                return

            weak_users = [line for line in out.splitlines() if line.strip()]
            if weak_users:
                self.vulnerable(cid, name, Severity.HIGH, desc,
                                f"취약 플러그인(mysql_native_password) 사용 계정 {len(weak_users)}개:\n"
                                + "\n".join(weak_users),
                                rec, command=query, cmd_output=out,
                                evidence="\n".join(weak_users))
            else:
                self.safe(cid, name, Severity.HIGH, desc,
                          "모든 계정이 강력 해시 플러그인 사용 (mysql_native_password 없음)",
                          rec, command=query, cmd_output=out)
        else:
            self.manual(cid, name, Severity.HIGH, desc,
                        f"{self.db_type.upper()} 패스워드 해시 알고리즘 수동 확인 필요",
                        rec)

    def _check_account_lockout(self):
        """DB-09 계정 잠금 정책 설정 [★2026 신규]
        주통기 2026: 로그인 실패 횟수 초과 시 계정 잠금이 설정되지 않으면
        무차별 대입 공격(Brute-force) 위험.
        MySQL: connection_control 플러그인 또는 max_connect_errors 설정.
        """
        cid, name = "DB-09", "계정 잠금 정책 설정"
        desc = ("로그인 실패 임계값 설정 없이 무제한 시도 허용 시 "
                "무차별 대입 공격(Brute-force) 위험. "
                "MySQL: connection_control 플러그인 또는 max_connect_errors 설정 권장.")
        rec = ("MySQL: INSTALL PLUGIN connection_control SONAME 'connection_control.so';\n"
               "SET GLOBAL connection_control_failed_connections_threshold=5;\n"
               "또는 my.cnf: max_connect_errors=5")

        if self.db_type == "mysql":
            if not self.user:
                self.manual(cid, name, Severity.HIGH, desc,
                            "접속 계정 미입력 — 수동 점검 필요", rec)
                return

            # connection_control 플러그인 확인
            q1 = "SHOW PLUGINS;"
            rc1, out1, _ = self._run_cmd(
                f"mysql -h {self.target} -P {self.port} -u {self.user} -p{self.password} "
                f'-e "{q1}" --batch --skip-column-names',
                timeout=10,
            )
            has_cc_plugin = "connection_control" in out1.lower() and "active" in out1.lower()

            # max_connect_errors 확인
            q2 = "SHOW VARIABLES LIKE 'max_connect_errors';"
            rc2, out2, _ = self._run_cmd(
                f"mysql -h {self.target} -P {self.port} -u {self.user} -p{self.password} "
                f'-e "{q2}" --batch --skip-column-names',
                timeout=10,
            )
            cmd_str = f"{q1}\n{q2}"
            cmd_out  = f"[SHOW PLUGINS]\n{out1[:400]}\n\n[max_connect_errors]\n{out2}"

            max_err = None
            for line in out2.splitlines():
                parts = line.split()
                if len(parts) >= 2 and "max_connect_errors" in parts[0].lower():
                    try:
                        max_err = int(parts[1])
                    except ValueError:
                        pass

            issues = []
            if not has_cc_plugin:
                issues.append("connection_control 플러그인 미설치")
            if max_err is None:
                issues.append("max_connect_errors 조회 실패")
            elif max_err > 10 or max_err == 0:
                issues.append(f"max_connect_errors={max_err} (권장: 1~10)")

            if issues and not has_cc_plugin:
                self.vulnerable(cid, name, Severity.HIGH, desc,
                                "\n".join(issues), rec,
                                command=cmd_str, cmd_output=cmd_out,
                                evidence="\n".join(issues))
            else:
                self.safe(cid, name, Severity.HIGH, desc,
                          "계정 잠금 정책 설정됨 (connection_control 또는 max_connect_errors)",
                          rec, command=cmd_str, cmd_output=cmd_out)
        else:
            self.manual(cid, name, Severity.HIGH, desc,
                        f"{self.db_type.upper()} 계정 잠금 정책 수동 확인 필요", rec)

    def _check_xp_cmdshell(self):
        """DB-23 xp_cmdshell 프로시저 비활성화 [★2026 신규 — MSSQL 전용]
        주통기 2026: xp_cmdshell 활성화 시 SQL을 통해 OS 명령 실행 가능.
        비활성화 여부를 sys.configurations 테이블로 확인.
        """
        cid, name = "DB-23", "xp_cmdshell 프로시저 비활성화 (MSSQL)"
        desc = ("xp_cmdshell 활성화 시 SQL 쿼리로 OS 명령 실행 가능 — "
                "SQL 인젝션과 결합하면 시스템 전체 탈취 위험.")
        rec = ("EXEC sp_configure 'show advanced options', 1; RECONFIGURE;\n"
               "EXEC sp_configure 'xp_cmdshell', 0; RECONFIGURE;")

        if not self.user:
            self.manual(cid, name, Severity.HIGH, desc,
                        "접속 계정 미입력 — 수동 점검 필요", rec)
            return

        query = "SELECT value_in_use FROM sys.configurations WHERE name='xp_cmdshell';"
        cmd = (f'sqlcmd -S {self.target},{self.port} -U {self.user} -P {self.password} '
               f'-Q "{query}" -h -1')
        rc, out, err = self._run_cmd(cmd, timeout=15)

        if rc != 0:
            self.error(cid, name, Severity.HIGH, desc, f"sqlcmd 실패: {err}", rec)
            return

        val = out.strip().splitlines()[0].strip() if out.strip() else ""

        if val == "0":
            self.safe(cid, name, Severity.HIGH, desc,
                      "xp_cmdshell 비활성화됨 (value_in_use=0)",
                      rec, command=cmd, cmd_output=out)
        elif val == "1":
            self.vulnerable(cid, name, Severity.HIGH, desc,
                            "xp_cmdshell 활성화됨 — OS 명령 실행 가능",
                            rec, command=cmd, cmd_output=out,
                            evidence="xp_cmdshell value_in_use=1")
        else:
            self.manual(cid, name, Severity.HIGH, desc,
                        f"xp_cmdshell 상태 확인 불가: {out[:100]}", rec,
                        command=cmd, cmd_output=out)

    def _check_registry_procs(self):
        """DB-24 레지스트리 접근 프로시저 비활성화 [★2026 신규 — MSSQL 전용]
        주통기 2026: xp_regread, xp_regwrite 등 레지스트리 프로시저 활성화 시
        SQL을 통한 레지스트리 읽기/쓰기로 시스템 정보 유출 및 설정 변조 가능.
        """
        cid, name = "DB-24", "레지스트리 접근 프로시저 비활성화 (MSSQL)"
        desc = ("xp_regread, xp_regwrite, xp_regenumvalues 등 레지스트리 관련 "
                "확장 프로시저 활성화 시 SQL을 통해 Windows 레지스트리 접근 가능 — "
                "시스템 정보 유출 및 설정 변조 위험.")
        rec = ("EXEC master..sp_dropextendedproc 'xp_regread';\n"
               "EXEC master..sp_dropextendedproc 'xp_regwrite';\n"
               "EXEC master..sp_dropextendedproc 'xp_regenumvalues';")

        if not self.user:
            self.manual(cid, name, Severity.HIGH, desc,
                        "접속 계정 미입력 — 수동 점검 필요", rec)
            return

        reg_procs = ["xp_regread", "xp_regwrite", "xp_regenumvalues",
                     "xp_regdeletekey", "xp_regdeletevalue"]
        query = ("SELECT name FROM master.sys.objects WHERE type='X' "
                 f"AND name IN ({', '.join(repr(p) for p in reg_procs)});")
        cmd = (f'sqlcmd -S {self.target},{self.port} -U {self.user} -P {self.password} '
               f'-Q "{query}" -h -1')
        rc, out, err = self._run_cmd(cmd, timeout=15)

        if rc != 0:
            self.error(cid, name, Severity.HIGH, desc, f"sqlcmd 실패: {err}", rec)
            return

        found = [line.strip() for line in out.splitlines() if line.strip()
                 and any(p in line.lower() for p in ("xp_reg",))]

        if found:
            self.vulnerable(cid, name, Severity.HIGH, desc,
                            f"레지스트리 접근 프로시저 존재: {', '.join(found)}",
                            rec, command=cmd, cmd_output=out,
                            evidence=", ".join(found))
        else:
            self.safe(cid, name, Severity.HIGH, desc,
                      "레지스트리 접근 프로시저 없음 (삭제 또는 미설치)",
                      rec, command=cmd, cmd_output=out)
