"""
DBMS 취약점 진단 모듈 (stub)
지원: MySQL/MariaDB, PostgreSQL, MSSQL
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
