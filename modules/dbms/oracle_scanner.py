"""
Oracle DB 취약점 진단 모듈
SK Shieldus Oracle 11g/12c/18c/19c/21c 보안가이드라인 기반

배포 유형별 동작:
  server : SQL 쿼리(DB 직접 접속) + OS 명령(executor/로컬)
  docker : SQL 쿼리만 (OS 접근 불가 시 환경파일 항목 N/A)
  rds    : SQL 쿼리만 (리스너·sqlnet.ora·파일권한 모두 N/A)
"""
from __future__ import annotations
from core.base_scanner import BaseScanner
from core.result import ScanReport, Severity


# Oracle 기본(시스템) 계정 목록
_DEFAULT_USERS_11G = frozenset([
    'ANONYMOUS','AWR_STAGE','CSMIG','CTXSYS','DIP','DBSNMP','DEMO','DMSYS','DSSYS',
    'EXFSYS','FLOWS_030000','IMP_FULL_DATABASE','LBACSYS','MDSYS','MGMT_VIEW','ODM',
    'OLAPSYS','OWBSYS','ORACLE_OCM','ORDPLUGINS','ORDSYS','OUTLN','PERFSTAT',
    'SI_INFORMTN_SCHEMA','SYS','SYSMAN','SYSTEM','TRACESVR','TSMSYS','WK_TEST',
    'WKSYS','WKPROXY','WMSYS','XDB',
])
_DEFAULT_USERS_12C = frozenset([
    'ANONYMOUS','AUDSYS','AWR_STAGE','CSMIG','CTXSYS','DIP','DBSNMP','DEMO',
    'DGPDB_INT','DMSYS','DSSYS','DVF','DVSYS','EXFSYS','FLOWS_030000','GGSYS',
    'GSMADMIN_INTERNAL','GSMCATUSER','GSMUSER','IMP_FULL_DATABASE','LBACSYS',
    'MDSYS','MGMT_VIEW','ODM','OLAPSYS','ORDDATA','OWBSYS','ORACLE_OCM',
    'ORDPLUGINS','ORDSYS','OUTLN','PERFSTAT','SI_INFORMTN_SCHEMA','SYS',
    'SYSBACKUP','SYSDG','SYSKM','SYSRAC','SYSMAN','SYSTEM','TRACESVR','TSMSYS',
    'WK_TEST','WKSYS','WKPROXY','WMSYS','XDB',
])

# 위험 PL/SQL 패키지
_DANGEROUS_PACKAGES = [
    'UTL_SMTP','UTL_TCP','UTL_HTTP','UTL_FILE','DBMS_RANDOM','DBMS_LOB',
    'DBMS_SQL','DBMS_JOB','DBMS_BACKUP_RESTORE','DBMS_OBFUSCATION_TOOLKIT',
    'UTL_INADDR',
]


class OracleScanner(BaseScanner):
    CATEGORY = "DBMS-Oracle"

    def __init__(
        self,
        target: str = "localhost",
        verbose: bool = False,
        executor=None,
        db_host: str = "localhost",
        db_port: int = 1521,
        service_name: str = "ORCL",
        db_user: str = "system",
        db_password: str = "",
        deploy_type: str = "server",   # server | docker | rds
    ):
        super().__init__(target, verbose, executor)
        self.db_host = db_host
        self.db_port = db_port
        self.service_name = service_name
        self.db_user = db_user
        self.db_password = db_password
        self.deploy_type = deploy_type.lower()
        self._conn = None
        self._conn_error: str = ""
        self._ora_major: int = 0   # 버전 (예: 19)
        self._ora_minor: int = 0
        self._oracle_home: str = ""

    # ── DB 연결 ────────────────────────────────────────────────────────

    def _connect(self):
        """oracledb(thin) 또는 cx_Oracle로 Oracle에 연결."""
        dsn = f"{self.db_host}:{self.db_port}/{self.service_name}"
        for lib_name, connect_fn in [
            ("oracledb",  self._connect_oracledb),
            ("cx_Oracle", self._connect_cxoracle),
        ]:
            conn, err = connect_fn(dsn)
            if conn:
                self._conn = conn
                return
            self._conn_error = err
        # 연결 실패 메시지 출력
        print(f"  [!] Oracle DB 연결 실패: {self._conn_error}")
        print("      SQL 기반 점검은 수동 점검으로 처리됩니다.")

    def _connect_oracledb(self, dsn) -> tuple:
        try:
            import oracledb
            oracledb.init_oracle_client()   # thick mode (선택)
        except Exception:
            pass
        try:
            import oracledb
            conn = oracledb.connect(user=self.db_user, password=self.db_password, dsn=dsn)
            return conn, ""
        except ImportError:
            return None, "oracledb 미설치"
        except Exception as e:
            return None, str(e)

    def _connect_cxoracle(self, dsn) -> tuple:
        try:
            import cx_Oracle
            conn = cx_Oracle.connect(self.db_user, self.db_password, dsn)
            return conn, ""
        except ImportError:
            return None, "cx_Oracle 미설치"
        except Exception as e:
            return None, str(e)

    def _sql(self, query: str, params=None) -> list | None:
        """SQL 실행 → 행 리스트 반환. 연결 없거나 오류면 None."""
        if self._conn is None:
            return None
        try:
            cur = self._conn.cursor()
            cur.execute(query, params or [])
            return cur.fetchall()
        except Exception:
            return None

    def _get_version(self):
        rows = self._sql("SELECT version FROM v$instance")
        if rows:
            parts = rows[0][0].split(".")
            try:
                self._ora_major = int(parts[0])
                self._ora_minor = int(parts[1]) if len(parts) > 1 else 0
            except ValueError:
                pass

    def _get_oracle_home(self) -> str:
        if self._oracle_home:
            return self._oracle_home
        rc, out, _ = self._run_shell("echo $ORACLE_HOME 2>/dev/null")
        if rc == 0 and out.strip() and out.strip() != "$ORACLE_HOME":
            self._oracle_home = out.strip()
        return self._oracle_home

    def _is_rds(self) -> bool:
        return self.deploy_type == "rds"

    def _has_os(self) -> bool:
        """OS 명령 실행 가능 여부"""
        return not self._is_rds() and (self.executor is not None or self.deploy_type == "server")

    def _no_sql(self, cid, name, sev, desc, rec):
        """DB 연결 불가 시 수동 점검 처리"""
        self.manual(cid, name, sev, desc,
                    f"DB 연결 불가 ({self._conn_error}) — 수동 점검 필요", rec,
                    command="DB 직접 접속 후 SQL 실행 필요")

    def _rds_na(self, cid, name, sev, desc, rec):
        """RDS/Docker에서 OS 접근 불가 항목 N/A"""
        reason = "AWS RDS — 관리형 서비스, OS 직접 접근 불가" if self._is_rds() \
                 else "Docker/원격 OS 접근 불가"
        self.skipped(cid, name, sev, desc, reason, rec,
                     command="해당 없음(N/A)")

    # ── 메인 실행 ────────────────────────────────────────────────────

    def run(self) -> ScanReport:
        print(f"\n[*] Oracle DB 취약점 진단 시작 → {self.db_host}:{self.db_port}/{self.service_name}")
        print(f"  배포 유형: {self.deploy_type}")

        self._connect()
        if self._conn:
            self._get_version()
            print(f"  Oracle 버전: {self._ora_major}.{self._ora_minor}")

        print("  [1] 계정 관리")
        self._o101(); self._o102(); self._o103()
        self._o104(); self._o105(); self._o106()

        print("  [2] 권한 관리")
        self._o201(); self._o202(); self._o203()
        self._o204(); self._o205(); self._o206()
        self._o207(); self._o208(); self._o209()

        print("  [3] DBMS 보안 설정")
        self._o301(); self._o302(); self._o303()
        self._o304(); self._o305(); self._o306()

        print("  [4] 환경 파일 점검")
        self._o401(); self._o402(); self._o403()
        self._o404(); self._o405(); self._o406()
        self._o407(); self._o408()

        print("  [5] 보안 패치")
        self._o501()

        print("  [6] 보안 감사 설정")
        self._o601(); self._o602()

        print("  [7] 네트워크 접근 제어")
        self._o701(); self._o702()

        if self._conn:
            try:
                self._conn.close()
            except Exception:
                pass

        self.report.finish()
        return self.report

    # ══════════════════════════════════════════════════════════════════
    # 섹션 1: 계정 관리
    # ══════════════════════════════════════════════════════════════════

    def _o101(self):
        cid, name = "O-1.1", "불필요한 계정 확인"
        sev = Severity.LOW
        desc = "OPEN 상태인 불필요한 계정이 존재하면 DB 무단 접근 위험"
        rec = "불필요한 계정 DROP 또는 ACCOUNT LOCK PASSWORD EXPIRE 처리"

        default_list = _DEFAULT_USERS_12C if self._ora_major >= 12 else _DEFAULT_USERS_11G
        placeholders = ",".join([f":{i+1}" for i in range(len(default_list))])
        q = (f"SELECT username, account_status FROM sys.dba_users "
             f"WHERE account_status='OPEN' AND username NOT IN ({placeholders})")

        rows = self._sql(q, list(default_list))
        cmd = "SELECT username,account_status FROM dba_users WHERE account_status='OPEN'"
        if rows is None:
            self._no_sql(cid, name, sev, desc, rec); return

        if rows:
            accts = [r[0] for r in rows]
            self.vulnerable(cid, name, sev, desc,
                            f"불필요 계정 {len(accts)}개 발견: {', '.join(accts[:10])}",
                            rec, command=cmd, evidence="\n".join(accts))
        else:
            self.safe(cid, name, sev, desc, "불필요한 OPEN 계정 없음", rec, command=cmd)

    def _o102(self):
        cid, name = "O-1.2", "무제한 로그인 시도 차단"
        sev = Severity.MEDIUM
        desc = "FAILED_LOGIN_ATTEMPTS 10 초과 시 Brute force 공격에 노출"
        rec = "ALTER PROFILE <profile> LIMIT FAILED_LOGIN_ATTEMPTS 10"
        q = ("SELECT profile, limit FROM dba_profiles "
             "WHERE resource_name='FAILED_LOGIN_ATTEMPTS'")
        cmd = "SELECT profile,limit FROM dba_profiles WHERE resource_name='FAILED_LOGIN_ATTEMPTS'"

        rows = self._sql(q)
        if rows is None:
            self._no_sql(cid, name, sev, desc, rec); return

        vuln = []
        for profile, limit in rows:
            limit_s = str(limit).upper()
            if limit_s in ("UNLIMITED", "DEFAULT"):
                vuln.append(f"{profile}({limit})")
            else:
                try:
                    if int(limit) > 10:
                        vuln.append(f"{profile}({limit})")
                except ValueError:
                    pass

        ev = "\n".join([f"{p}|{l}" for p, l in rows])
        if vuln:
            self.vulnerable(cid, name, sev, desc,
                            f"FAILED_LOGIN_ATTEMPTS 초과 프로파일: {', '.join(vuln)}",
                            rec, command=cmd, evidence=ev)
        else:
            self.safe(cid, name, sev, desc, "모든 프로파일 10회 이하 설정됨", rec,
                      command=cmd, cmd_output=ev)

    def _o103(self):
        cid, name = "O-1.3", "패스워드 주기적 변경 (PASSWORD_LIFE_TIME)"
        sev = Severity.MEDIUM
        desc = "PASSWORD_LIFE_TIME 60일 초과 시 Brute force에 취약"
        rec = "ALTER PROFILE <profile> LIMIT PASSWORD_LIFE_TIME 60"
        q = "SELECT profile, limit FROM dba_profiles WHERE resource_name='PASSWORD_LIFE_TIME'"
        cmd = q

        rows = self._sql(q)
        if rows is None:
            self._no_sql(cid, name, sev, desc, rec); return

        vuln = []
        for profile, limit in rows:
            limit_s = str(limit).upper()
            if limit_s in ("UNLIMITED", "DEFAULT"):
                vuln.append(f"{profile}({limit})")
            else:
                try:
                    if int(limit) > 60:
                        vuln.append(f"{profile}({limit})")
                except ValueError:
                    pass

        ev = "\n".join([f"{p}|{l}" for p, l in rows])
        if vuln:
            self.vulnerable(cid, name, sev, desc,
                            f"PASSWORD_LIFE_TIME 초과 프로파일: {', '.join(vuln)}",
                            rec, command=cmd, evidence=ev)
        else:
            self.safe(cid, name, sev, desc, "모든 프로파일 60일 이하 설정됨", rec,
                      command=cmd, cmd_output=ev)

    def _o104(self):
        cid, name = "O-1.4", "패스워드 복잡도 설정 (PASSWORD_VERIFY_FUNCTION)"
        sev = Severity.MEDIUM
        desc = "복잡도 함수 미설정 시 단순 패스워드 허용"
        rec = ("Oracle 11g: VERIFY_FUNCTION_11G, "
               "12c 이상: ORA12C_VERIFY_FUNCTION 으로 설정")
        q = ("SELECT profile, limit FROM dba_profiles "
             "WHERE resource_name='PASSWORD_VERIFY_FUNCTION'")
        cmd = q

        rows = self._sql(q)
        if rows is None:
            self._no_sql(cid, name, sev, desc, rec); return

        _valid_funcs = {"VERIFY_FUNCTION_11G", "ORA12C_VERIFY_FUNCTION",
                        "ORA12C_STRONG_VERIFY_FUNCTION"}
        vuln = []
        for profile, limit in rows:
            if str(limit).upper() in ("NULL", "NONE", "DEFAULT", "") or limit is None:
                vuln.append(f"{profile}(NULL)")
            elif str(limit).upper() not in _valid_funcs:
                vuln.append(f"{profile}({limit})")

        ev = "\n".join([f"{p}|{l}" for p, l in rows])
        if vuln:
            self.vulnerable(cid, name, sev, desc,
                            f"복잡도 함수 미설정 프로파일: {', '.join(vuln)}",
                            rec, command=cmd, evidence=ev)
        else:
            self.safe(cid, name, sev, desc, "패스워드 복잡도 함수 설정됨", rec,
                      command=cmd, cmd_output=ev)

    def _o105(self):
        """1.5 취약한 패스워드 사용 점검 (수동)"""
        cid, name = "O-1.5", "취약한 패스워드 사용 점검"
        sev = Severity.HIGH
        desc = "계정 ID와 동일하거나 단순 패스워드 사용 시 무차별 대입 공격에 노출"
        rec = "8자 이상, 대/소문자·숫자·특수문자 2종류 이상 조합으로 변경"

        # dba_users에서 password 컬럼(해시값)이 username과 동일한지 간접 확인
        # 실제 패스워드 평문 확인은 불가 — 수동 점검 처리
        q = "SELECT username FROM sys.dba_users WHERE account_status='OPEN'"
        rows = self._sql(q)
        cmd = "SELECT password||':'||username FROM sys.dba_users WHERE account_status='OPEN'"
        note = f"OPEN 계정 {len(rows)}개 존재 — 패스워드 정책 수동 확인 필요" if rows else \
               "DB 연결 불가 — 수동 점검 필요"
        self.manual(cid, name, sev, desc, note, rec, command=cmd)

    def _o106(self):
        """1.6 OS DBA 그룹 멤버 확인"""
        cid, name = "O-1.6", "OS DBA 그룹 멤버 확인"
        sev = Severity.LOW
        desc = "OS DBA 그룹 멤버는 패스워드 없이 SYSDBA 권한으로 접속 가능"
        rec = "dba 그룹에서 불필요한 계정 제거 (cat /etc/group | grep dba)"
        cmd = "cat /etc/group | grep dba"

        if not self._has_os():
            self._rds_na(cid, name, sev, desc, rec); return

        rc, out, _ = self._run_shell("cat /etc/group 2>/dev/null | grep -i dba")
        if rc != 0 or not out.strip():
            self.manual(cid, name, sev, desc, "/etc/group 조회 불가 — 수동 점검 필요", rec,
                        command=cmd); return

        # dba 그룹 멤버 파싱
        members = []
        for line in out.splitlines():
            parts = line.split(":")
            if len(parts) >= 4:
                members += [m.strip() for m in parts[3].split(",") if m.strip()]

        if not members:
            self.safe(cid, name, sev, desc, "DBA 그룹 멤버 없음 (oracle 계정만 허용)", rec,
                      command=cmd, cmd_output=out)
        else:
            # oracle 외 계정 존재 여부 확인
            extra = [m for m in members if m.lower() not in ("oracle", "grid")]
            if extra:
                self.vulnerable(cid, name, sev, desc,
                                f"DBA 그룹에 불필요 계정: {', '.join(extra)}",
                                rec, command=cmd, cmd_output=out, evidence=out)
            else:
                self.safe(cid, name, sev, desc,
                          f"DBA 그룹 멤버: {', '.join(members)} (적절)", rec,
                          command=cmd, cmd_output=out)

    # ══════════════════════════════════════════════════════════════════
    # 섹션 2: 권한 관리
    # ══════════════════════════════════════════════════════════════════

    def _o201(self):
        """2.1 개발 및 운영 시스템 분리 (수동)"""
        cid, name = "O-2.1", "개발 및 운영 시스템 분리 사용"
        sev = Severity.LOW
        desc = "개발/운영 DB가 동일 시스템에서 운영되는 경우 취약점 노출 위험"
        rec = "개발/운영 DB를 물리적으로 분리, DB Link 제거"
        self.manual(cid, name, sev, desc, "담당자 인터뷰로만 확인 가능", rec,
                    command="담당자 인터뷰")

    def _o202(self):
        cid, name = "O-2.2", "PUBLIC에 대한 불필요한 Object 권한 제한"
        sev = Severity.MEDIUM
        desc = "Object 권한이 PUBLIC에 부여되면 모든 계정이 해당 오브젝트에 접근 가능"
        rec = "REVOKE <권한> ON <object> FROM PUBLIC"
        _sys_owners = ('SYS','CTXSYS','MDSYS','ODM','OLAPSYS','MTSSYS','ORDPLUGINS',
                       'ORDSYS','SYSTEM','WKSYS','WMSYS','XDB','LBACSYS','PERFSTAT',
                       'SYSMAN','DMSYS','EXFSYS','WK_TEST','IMP_FULL_DATABASE',
                       'FLOWS_030000','MGMT_VIEW')
        placeholders = ",".join([f":{i+1}" for i in range(len(_sys_owners))])
        q = (f"SELECT owner||'.'||table_name||': '||privilege "
             f"FROM dba_tab_privs WHERE grantee='PUBLIC' "
             f"AND owner NOT IN ({placeholders})")
        cmd = "SELECT ... FROM dba_tab_privs WHERE grantee='PUBLIC'"

        rows = self._sql(q, list(_sys_owners))
        if rows is None:
            self._no_sql(cid, name, sev, desc, rec); return

        if rows:
            items = [r[0] for r in rows]
            self.vulnerable(cid, name, sev, desc,
                            f"PUBLIC 권한 부여 오브젝트 {len(items)}개",
                            rec, command=cmd, evidence="\n".join(items[:20]))
        else:
            self.safe(cid, name, sev, desc, "불필요한 PUBLIC 권한 없음", rec, command=cmd)

    def _o203(self):
        cid, name = "O-2.3", "SYS.LINK$ 테이블 접근 제한"
        sev = Severity.MEDIUM
        desc = "DB Link 계정/패스워드가 평문 저장 — 비DBA 계정의 LINK$ 접근 차단 필요"
        rec = "REVOKE <권한> ON SYS.LINK$ FROM <user>"
        _safe_users = ('SYS','CTXSYS','MDSYS','ODM','OLAPSYS','MTSSYS','ORDPLUGINS',
                       'ORDSYS','SYSTEM','WKSYS','WMSYS','XDB','LBACSYS','PERFSTAT',
                       'SYSMAN','DMSYS','EXFSYS','WK_TEST','IMP_FULL_DATABASE',
                       'FLOWS_030000','MGMT_VIEW')
        placeholders = ",".join([f":{i+1}" for i in range(len(_safe_users))])
        q = (f"SELECT grantee, privilege FROM dba_tab_privs "
             f"WHERE table_name='LINK$' AND grantee NOT IN ({placeholders})")
        cmd = "SELECT grantee,privilege FROM dba_tab_privs WHERE table_name='LINK$'"

        rows = self._sql(q, list(_safe_users))
        if rows is None:
            self._no_sql(cid, name, sev, desc, rec); return

        if rows:
            items = [f"{r[0]}({r[1]})" for r in rows]
            self.vulnerable(cid, name, sev, desc,
                            f"비DBA 계정의 LINK$ 접근 권한: {', '.join(items)}",
                            rec, command=cmd, evidence="\n".join(items))
        else:
            self.safe(cid, name, sev, desc, "비DBA 계정의 LINK$ 접근 없음", rec, command=cmd)

    def _o204(self):
        cid, name = "O-2.4", "SYSDBA 권한 제한"
        sev = Severity.HIGH
        desc = "SYSDBA 권한은 DB Startup/Shutdown/Reconfiguration 가능 — 최소 부여 필요"
        rec = "REVOKE SYSDBA FROM <user>"
        q = ("SELECT username, sysdba, sysoper FROM v$pwfile_users "
             "WHERE username NOT IN "
             "(SELECT grantee FROM dba_role_privs WHERE granted_role='DBA') "
             "AND username != 'INTERNAL' AND sysdba='TRUE'")
        cmd = "SELECT username,sysdba FROM v$pwfile_users"

        rows = self._sql(q)
        if rows is None:
            self._no_sql(cid, name, sev, desc, rec); return

        if rows:
            accts = [r[0] for r in rows]
            self.vulnerable(cid, name, sev, desc,
                            f"비DBA 계정에 SYSDBA 권한: {', '.join(accts)}",
                            rec, command=cmd, evidence="\n".join(accts))
        else:
            self.safe(cid, name, sev, desc, "SYSDBA 권한 적절히 제한됨", rec, command=cmd)

    def _o205(self):
        cid, name = "O-2.5", "DBA 권한 제한"
        sev = Severity.HIGH
        desc = "비인가자의 DBA 권한 획득 시 DB 삭제·변경·정보유출 위험"
        rec = "REVOKE DBA FROM <user>; 필요한 경우만 부여"
        _safe = ('SYS','SYSTEM','WKSYS','CTXSYS','CSTA','SYSMAN')
        placeholders = ",".join([f":{i+1}" for i in range(len(_safe))])
        q = (f"SELECT grantee, granted_role FROM dba_role_privs "
             f"WHERE granted_role='DBA' AND grantee NOT IN ({placeholders})")
        cmd = "SELECT grantee FROM dba_role_privs WHERE granted_role='DBA'"

        rows = self._sql(q, list(_safe))
        if rows is None:
            self._no_sql(cid, name, sev, desc, rec); return

        if rows:
            accts = [r[0] for r in rows]
            self.vulnerable(cid, name, sev, desc,
                            f"DBA 권한 보유 계정: {', '.join(accts)}",
                            rec, command=cmd, evidence="\n".join(accts))
        else:
            self.safe(cid, name, sev, desc, "DBA 권한 적절히 제한됨", rec, command=cmd)

    def _o206(self):
        cid, name = "O-2.6", "WITH GRANT OPTION 사용 제한"
        sev = Severity.LOW
        desc = "WITH GRANT OPTION 수령자는 타 계정에 권한 재부여 가능"
        rec = "비DBA 계정의 WITH GRANT OPTION REVOKE"
        q = ("SELECT grantor, owner, table_name, grantee FROM dba_tab_privs "
             "WHERE grantable='YES' "
             "AND owner NOT IN (SELECT DISTINCT owner FROM dba_objects) "
             "AND grantee NOT IN "
             "(SELECT grantee FROM dba_role_privs WHERE granted_role='DBA')")
        cmd = "SELECT ... FROM dba_tab_privs WHERE grantable='YES'"

        rows = self._sql(q)
        if rows is None:
            self._no_sql(cid, name, sev, desc, rec); return

        if rows:
            items = [f"{r[3]}" for r in rows]
            self.vulnerable(cid, name, sev, desc,
                            f"WITH GRANT OPTION 보유 계정: {', '.join(set(items))}",
                            rec, command=cmd,
                            evidence="\n".join([f"{r[0]}|{r[1]}.{r[2]}→{r[3]}" for r in rows[:20]]))
        else:
            self.safe(cid, name, sev, desc, "WITH GRANT OPTION 적절히 제한됨", rec, command=cmd)

    def _o207(self):
        cid, name = "O-2.7", "WITH ADMIN OPTION 사용 제한"
        sev = Severity.LOW
        desc = "WITH ADMIN OPTION 수령자는 시스템 권한을 타 계정에 재부여 가능"
        rec = "비DBA 계정의 WITH ADMIN OPTION REVOKE"
        _safe = ('SYS','SYSTEM','AQ_ADMINISTRATOR_ROLE','DBA','MDSYS','LBACSYS',
                 'SCHEDULER_ADMIN','WMSYS')
        placeholders = ",".join([f":{i+1}" for i in range(len(_safe))])
        q = (f"SELECT grantee, privilege FROM dba_sys_privs "
             f"WHERE grantee NOT IN ({placeholders}) "
             f"AND admin_option='YES' "
             f"AND grantee NOT IN "
             f"(SELECT grantee FROM dba_role_privs WHERE granted_role='DBA')")
        cmd = "SELECT grantee,privilege FROM dba_sys_privs WHERE admin_option='YES'"

        rows = self._sql(q, list(_safe))
        if rows is None:
            self._no_sql(cid, name, sev, desc, rec); return

        if rows:
            items = [f"{r[0]}({r[1]})" for r in rows]
            self.vulnerable(cid, name, sev, desc,
                            f"WITH ADMIN OPTION 보유 계정: {', '.join(items[:10])}",
                            rec, command=cmd, evidence="\n".join(items))
        else:
            self.safe(cid, name, sev, desc, "WITH ADMIN OPTION 적절히 제한됨", rec, command=cmd)

    def _o208(self):
        cid, name = "O-2.8", "SYSDBA 로그인 제한 (OS 인증 비활성화)"
        sev = Severity.HIGH
        desc = "sqlnet.authentication_services=(none) 미설정 시 OS 인증으로 패스워드 없이 SYSDBA 접속 가능"
        rec = "ORACLE_HOME/network/admin/sqlnet.ora: SQLNET.AUTHENTICATION_SERVICES=(NONE)"
        cmd = "grep -i 'sqlnet.authentication_services' $ORACLE_HOME/network/admin/sqlnet.ora"

        if not self._has_os():
            self._rds_na(cid, name, sev, desc, rec); return

        ora_home = self._get_oracle_home()
        if not ora_home:
            self.manual(cid, name, sev, desc, "ORACLE_HOME 환경변수 미설정 — 수동 점검", rec,
                        command=cmd); return

        rc, out, _ = self._run_shell(
            f"grep -i 'sqlnet.authentication_services' "
            f"'{ora_home}/network/admin/sqlnet.ora' 2>/dev/null"
        )
        if rc != 0 or not out.strip():
            self.vulnerable(cid, name, sev, desc,
                            "sqlnet.ora에 AUTHENTICATION_SERVICES 설정 없음 — OS 인증 가능",
                            rec, command=cmd, cmd_output=out)
        else:
            if "none" in out.lower():
                self.safe(cid, name, sev, desc,
                          "SQLNET.AUTHENTICATION_SERVICES=(NONE) 설정됨", rec,
                          command=cmd, cmd_output=out)
            else:
                self.vulnerable(cid, name, sev, desc,
                                f"AUTHENTICATION_SERVICES 설정 확인 필요: {out.strip()}",
                                rec, command=cmd, cmd_output=out, evidence=out)

    def _o209(self):
        cid, name = "O-2.9", "CREATE ANY DIRECTORY 권한 제한"
        sev = Severity.MEDIUM
        desc = "CREATE ANY DIRECTORY + UTL_FILE.PUT_RAW 로 SYSDBA 권한 획득 가능"
        rec = "REVOKE CREATE ANY DIRECTORY FROM <user>; REVOKE EXECUTE ON SYS.UTL_FILE FROM PUBLIC"
        _safe = ('DBA','IMP_FULL_DATABASE','WKSYS','SYS','SYSDBA')
        placeholders = ",".join([f":{i+1}" for i in range(len(_safe))])
        q = (f"SELECT grantee, privilege FROM dba_sys_privs "
             f"WHERE privilege='CREATE ANY DIRECTORY' "
             f"AND grantee NOT IN ({placeholders})")
        cmd = "SELECT grantee FROM dba_sys_privs WHERE privilege='CREATE ANY DIRECTORY'"

        rows = self._sql(q, list(_safe))
        if rows is None:
            self._no_sql(cid, name, sev, desc, rec); return

        if rows:
            accts = [r[0] for r in rows]
            self.vulnerable(cid, name, sev, desc,
                            f"CREATE ANY DIRECTORY 불필요 부여: {', '.join(accts)}",
                            rec, command=cmd, evidence="\n".join(accts))
        else:
            self.safe(cid, name, sev, desc, "CREATE ANY DIRECTORY 적절히 제한됨", rec, command=cmd)

    # ══════════════════════════════════════════════════════════════════
    # 섹션 3: DBMS 보안 설정
    # ══════════════════════════════════════════════════════════════════

    def _o301(self):
        cid, name = "O-3.1", "백업 관리"
        sev = Severity.LOW
        desc = "주기적 백업 미수행 시 장애·침해 발생 시 복구 불가"
        rec = "주기적 full 백업 수행, 외부 안전 장소 보관, 정기 백업 절차 수립"
        self.manual(cid, name, sev, desc, "담당자 인터뷰로만 확인 가능", rec,
                    command="담당자 인터뷰")

    def _o302(self):
        cid, name = "O-3.2", "PL/SQL 패키지 PUBLIC Execute 권한 점검"
        sev = Severity.HIGH
        desc = "위험 PL/SQL 패키지(UTL_FILE, UTL_SMTP 등)에 PUBLIC Execute 권한 부여 시 취약"
        rec = "REVOKE EXECUTE ON <package> FROM PUBLIC"
        placeholders = ",".join([f":{i+1}" for i in range(len(_DANGEROUS_PACKAGES))])
        q = (f"SELECT grantee, owner, table_name, privilege FROM dba_tab_privs "
             f"WHERE grantee='PUBLIC' AND privilege='EXECUTE' "
             f"AND table_name IN ({placeholders})")
        cmd = "SELECT table_name FROM dba_tab_privs WHERE grantee='PUBLIC' AND privilege='EXECUTE'"

        rows = self._sql(q, _DANGEROUS_PACKAGES)
        if rows is None:
            self._no_sql(cid, name, sev, desc, rec); return

        if rows:
            pkgs = [r[2] for r in rows]
            self.vulnerable(cid, name, sev, desc,
                            f"PUBLIC Execute 권한 패키지: {', '.join(pkgs)}",
                            rec, command=cmd, evidence="\n".join(pkgs))
        else:
            self.safe(cid, name, sev, desc, "위험 패키지 PUBLIC Execute 없음", rec, command=cmd)

    def _o303(self):
        cid, name = "O-3.3", "Listener 보안 설정 여부"
        sev = Severity.HIGH
        desc = "Listener 패스워드 미설정 시 DoS, 임의 파일 생성, listener.ora 원격 변경 가능"
        rec = "LSNRCTL change_password로 패스워드 설정, listener.ora에 PASSWORDS_LISTENER 추가"
        cmd = "lsnrctl status + grep PASSWORDS listener.ora"

        if self._is_rds():
            self.skipped(cid, name, sev, desc,
                         "AWS RDS — Listener는 AWS 관리형 서비스, 비밀번호 설정 불필요/불가",
                         rec, command="N/A"); return

        if not self._has_os():
            self._rds_na(cid, name, sev, desc, rec); return

        # Oracle 12.1+ 은 Listener 패스워드 기능 미지원
        if self._ora_major >= 12 and self._ora_minor >= 1:
            self.skipped(cid, name, sev, desc,
                         f"Oracle {self._ora_major}.{self._ora_minor} — "
                         "Listener 패스워드 기능 미지원 (12.1+)", rec, command=cmd); return

        rc, out, _ = self._run_shell("lsnrctl status 2>/dev/null | head -30")
        if rc != 0 or not out.strip():
            self.manual(cid, name, sev, desc, "lsnrctl 실행 불가 — 수동 점검 필요", rec,
                        command=cmd); return

        ora_home = self._get_oracle_home()
        listener_path = f"{ora_home}/network/admin/listener.ora" if ora_home else ""
        rc2, listener_content, _ = self._run_shell(
            f"cat '{listener_path}' 2>/dev/null" if listener_path else "echo ''"
        )

        has_password = "PASSWORDS_" in listener_content.upper() if listener_content else False
        if has_password:
            self.safe(cid, name, sev, desc, "listener.ora에 패스워드 설정됨", rec,
                      command=cmd, cmd_output=out)
        else:
            self.vulnerable(cid, name, sev, desc,
                            "listener.ora에 PASSWORDS_ 설정 없음",
                            rec, command=cmd, cmd_output=out,
                            evidence=listener_content[:300] if listener_content else "")

    def _o304(self):
        cid, name = "O-3.4", "DB 접속 IP 통제 (sqlnet.ora TCP.VALIDNODE_CHECKING)"
        sev = Severity.LOW
        desc = "IP 접근 제한 미설정 시 임의의 호스트에서 원격 DB 접속 가능"
        rec = "sqlnet.ora: TCP.VALIDNODE_CHECKING=YES, TCP.INVITED_NODES=(허용 IP 목록)"
        cmd = "grep -i 'VALIDNODE\\|INVITED\\|EXCLUDED' $ORACLE_HOME/network/admin/sqlnet.ora"

        if self._is_rds():
            self.skipped(cid, name, sev, desc,
                         "AWS RDS — VPC Security Group으로 접속 IP 제어 (sqlnet.ora N/A)",
                         rec, command="N/A"); return

        if not self._has_os():
            self._rds_na(cid, name, sev, desc, rec); return

        ora_home = self._get_oracle_home()
        if not ora_home:
            self.manual(cid, name, sev, desc, "ORACLE_HOME 미설정 — 수동 점검", rec,
                        command=cmd); return

        rc, out, _ = self._run_shell(
            f"grep -iE 'VALIDNODE|INVITED_NODES|EXCLUDED_NODES' "
            f"'{ora_home}/network/admin/sqlnet.ora' 2>/dev/null"
        )
        if rc == 0 and "validnode_checking" in out.lower() and "yes" in out.lower():
            self.safe(cid, name, sev, desc,
                      "TCP.VALIDNODE_CHECKING=YES 설정됨", rec, command=cmd, cmd_output=out)
        elif rc == 0 and out.strip():
            self.manual(cid, name, sev, desc,
                        f"설정 내용 확인 필요: {out.strip()}", rec,
                        command=cmd, cmd_output=out)
        else:
            self.vulnerable(cid, name, sev, desc,
                            "TCP.VALIDNODE_CHECKING 미설정 — IP 접근 제한 없음",
                            rec, command=cmd, cmd_output=out)

    def _o305(self):
        cid, name = "O-3.5", "로그 저장 주기"
        sev = Severity.HIGH
        desc = "접속기록 보관: 사용자 접속 6개월, 개인정보처리시스템 2년, 권한변경 5년"
        rec = "담당자와 로그 보관 기간 정책 수립, 정기 백업·감독 수행"

        # 로그 경로 정보는 SQL로 조회
        q = ("SELECT name, value FROM v$parameter "
             "WHERE name IN ('user_dump_dest','background_dump_dest',"
             "'core_dump_dest','audit_file_dest')")
        rows = self._sql(q)
        log_info = "\n".join([f"{r[0]}={r[1]}" for r in rows]) if rows else "DB 연결 불가"
        self.manual(cid, name, sev, desc,
                    f"로그 경로 정보:\n{log_info}\n담당자 인터뷰 필요", rec,
                    command="SELECT name,value FROM v$parameter WHERE name IN (...)")

    def _o306(self):
        cid, name = "O-3.6", "세션 IDLE_TIME 설정"
        sev = Severity.LOW
        desc = "IDLE_TIME 미설정(UNLIMITED) 시 방치된 세션을 통한 비인가 접근 위험"
        rec = "ALTER PROFILE <profile> LIMIT IDLE_TIME 5 (5분 권고)"
        q = ("SELECT profile, limit FROM dba_profiles "
             "WHERE resource_name='IDLE_TIME'")
        cmd = "SELECT profile,limit FROM dba_profiles WHERE resource_name='IDLE_TIME'"

        rows = self._sql(q)
        if rows is None:
            self._no_sql(cid, name, sev, desc, rec); return

        vuln = []
        for profile, limit in rows:
            limit_s = str(limit).upper()
            if limit_s in ("UNLIMITED", "NULL", "DEFAULT"):
                vuln.append(f"{profile}({limit})")
            else:
                try:
                    if int(limit) > 5:
                        vuln.append(f"{profile}({limit}분 초과)")
                except ValueError:
                    pass

        ev = "\n".join([f"{p}|{l}" for p, l in rows])
        if vuln:
            self.vulnerable(cid, name, sev, desc,
                            f"IDLE_TIME 초과 프로파일: {', '.join(vuln)}",
                            rec, command=cmd, evidence=ev)
        else:
            self.safe(cid, name, sev, desc, "모든 프로파일 IDLE_TIME 5분 이하", rec,
                      command=cmd, cmd_output=ev)

    # ══════════════════════════════════════════════════════════════════
    # 섹션 4: 환경 파일 점검 (RDS: 전체 N/A, Docker/server: OS 필요)
    # ══════════════════════════════════════════════════════════════════

    def _check_file_perm(self, cid, name, sev, desc, rec, find_cmd,
                         max_oct: int, dir_max_oct: int = None):
        """파일 권한 점검 헬퍼 (Unix 계열)"""
        if not self._has_os():
            self._rds_na(cid, name, sev, desc, rec); return

        rc, out, _ = self._run_shell(find_cmd)
        if rc != 0 or not out.strip():
            self.manual(cid, name, sev, desc, "파일 조회 불가 — 수동 점검 필요", rec,
                        command=find_cmd); return

        vuln_files = []
        for line in out.splitlines():
            line = line.strip()
            if not line or line.startswith("find:"):
                continue
            parts = line.split()
            if len(parts) < 9:
                continue
            perm_str = parts[0]   # e.g. -rw-r-----
            try:
                oct_val = self._perm_to_oct(perm_str[1:])
                if oct_val > max_oct:
                    vuln_files.append(f"{parts[-1]}({perm_str})")
            except Exception:
                pass

        if vuln_files:
            self.vulnerable(cid, name, sev, desc,
                            f"권한 초과 파일: {', '.join(vuln_files[:5])}",
                            rec, command=find_cmd,
                            cmd_output=out[:300], evidence=out[:500])
        else:
            self.safe(cid, name, sev, desc, f"파일 권한 적절 (최대 0o{oct(max_oct)[2:]})", rec,
                      command=find_cmd, cmd_output=out[:300])

    @staticmethod
    def _perm_to_oct(perm9: str) -> int:
        """rwxr-x--- → 0o750"""
        val = 0
        for i, c in enumerate(perm9[:9]):
            if c != "-":
                val |= (1 << (8 - i))
        return val

    def _o401(self):
        cid, name = "O-4.1", "SQL*PLUS 명령 히스토리 파일 접근 권한"
        sev = Severity.LOW
        desc = "쉘 히스토리에 계정/패스워드 평문 기록 가능 — 파일 권한 600 필요"
        rec = "chmod 600 ~/.bash_history ~/.sh_history; sqlplus /nolog 후 개별 입력"
        cmd = "ls -la ~/.bash_history ~/.sh_history ~/.history 2>/dev/null"

        if not self._has_os():
            self._rds_na(cid, name, sev, desc, rec); return

        rc, out, _ = self._run_shell(
            "ls -la ~/.bash_history ~/.sh_history ~/.history 2>/dev/null"
        )
        if not out.strip():
            self.safe(cid, name, sev, desc, "히스토리 파일 없음", rec, command=cmd); return

        vuln = []
        for line in out.splitlines():
            parts = line.split()
            if len(parts) >= 9 and parts[0].startswith("-"):
                try:
                    oct_val = self._perm_to_oct(parts[0][1:])
                    if oct_val > 0o600:
                        vuln.append(f"{parts[-1]}({parts[0]})")
                except Exception:
                    pass

        if vuln:
            self.vulnerable(cid, name, sev, desc,
                            f"권한 초과: {', '.join(vuln)}", rec,
                            command=cmd, cmd_output=out, evidence=out)
        else:
            self.safe(cid, name, sev, desc, "히스토리 파일 권한 600 이하", rec,
                      command=cmd, cmd_output=out)

    def _o402(self):
        cid, name = "O-4.2", "Initialization 파일 접근 권한 (init*.ora, spfile*.ora)"
        sev = Severity.MEDIUM
        desc = "초기화 파일 변경으로 시스템 장애 발생 가능 — 640 이하 필요"
        rec = "chmod 640 init<SID>.ora spfile<SID>.ora"
        cmd = "find / -name 'init*.ora' -o -name 'spfile*.ora' 2>/dev/null | xargs ls -la"
        self._check_file_perm(cid, name, sev, desc, rec,
                              f"find / -name 'init*.ora' -o -name 'spfile*.ora' 2>/dev/null "
                              f"| xargs ls -la 2>/dev/null",
                              max_oct=0o640)

    def _o403(self):
        cid, name = "O-4.3", "Oracle Password 파일 접근 권한 (orapw*)"
        sev = Severity.MEDIUM
        desc = "패스워드 파일 변경으로 시스템 접근 불가 가능 — 640 이하 필요"
        rec = "chmod 640 orapw<SID>"
        self._check_file_perm(cid, name, sev, desc, rec,
                              "find / -name 'orapw*' 2>/dev/null | xargs ls -la 2>/dev/null",
                              max_oct=0o640)

    def _o404(self):
        cid, name = "O-4.4", "Alert Log 파일 접근 제한"
        sev = Severity.LOW
        desc = "Alert Log 유출로 서버 정보 노출 가능 — 파일 640, 디렉터리 750 이하"
        rec = "chmod 640 alert_<SID>.log; chmod 750 <상위디렉터리>"

        if not self._has_os():
            self._rds_na(cid, name, sev, desc, rec); return

        # SQL로 경로 조회
        rows = self._sql(
            "SELECT value FROM v$parameter WHERE name='background_dump_dest'"
        )
        dump_dir = rows[0][0] if rows else ""

        if not dump_dir:
            self.manual(cid, name, sev, desc, "background_dump_dest 조회 불가", rec,
                        command="SELECT value FROM v$parameter WHERE name='background_dump_dest'")
            return

        cmd = f"ls -la '{dump_dir}'/alert_*.log 2>/dev/null"
        rc, out, _ = self._run_shell(cmd)
        if not out.strip():
            self.manual(cid, name, sev, desc,
                        f"{dump_dir} 에서 alert log 없음 — 수동 확인", rec, command=cmd); return

        vuln = [l for l in out.splitlines()
                if l.startswith("-") and len(l.split()) >= 9
                and self._perm_to_oct(l.split()[0][1:]) > 0o640]

        if vuln:
            self.vulnerable(cid, name, sev, desc,
                            f"권한 초과 Alert Log: {len(vuln)}개",
                            rec, command=cmd, cmd_output=out, evidence=out[:300])
        else:
            self.safe(cid, name, sev, desc, "Alert Log 파일 권한 적절", rec,
                      command=cmd, cmd_output=out)

    def _o405(self):
        cid, name = "O-4.5", "Trace Log 파일 접근 제한"
        sev = Severity.LOW
        desc = "Trace Log 유출로 서버 정보 노출 — 파일 640, 디렉터리 750 이하"
        rec = "chmod 640 <trace log>; chmod 750 <trace 디렉터리>"

        if not self._has_os():
            self._rds_na(cid, name, sev, desc, rec); return

        rows = self._sql(
            "SELECT name, value FROM v$parameter "
            "WHERE name IN ('user_dump_dest','background_dump_dest')"
        )
        dirs = [r[1] for r in rows if r[1]] if rows else []
        if not dirs:
            self.manual(cid, name, sev, desc, "Trace 경로 조회 불가", rec,
                        command="SELECT value FROM v$parameter WHERE name='user_dump_dest'")
            return

        issues = []
        for d in dirs:
            rc, out, _ = self._run_shell(f"ls -la '{d}'/*.trc 2>/dev/null | head -20")
            for line in out.splitlines():
                if line.startswith("-") and len(line.split()) >= 9:
                    try:
                        if self._perm_to_oct(line.split()[0][1:]) > 0o640:
                            issues.append(line.split()[-1])
                    except Exception:
                        pass

        if issues:
            self.vulnerable(cid, name, sev, desc,
                            f"권한 초과 Trace 파일: {len(issues)}개",
                            rec, command=f"ls -la {dirs[0]}/*.trc",
                            evidence="\n".join(issues[:10]))
        else:
            self.safe(cid, name, sev, desc, "Trace 파일 권한 적절", rec,
                      command=f"ls -la {dirs[0]}/*.trc" if dirs else "")

    def _o406(self):
        cid, name = "O-4.6", "컨트롤/Redo 로그/데이터 파일 접근 제한"
        sev = Severity.MEDIUM
        desc = "Oracle 핵심 파일 변경·삭제 시 시스템 장애 — 640 이하 필요"
        rec = "chmod 640 <control file> <redo log> <datafile>"

        if not self._has_os():
            self._rds_na(cid, name, sev, desc, rec); return

        # 파일 경로 SQL 조회
        ctl_rows  = self._sql("SELECT value FROM v$parameter WHERE name='control_files'")
        redo_rows = self._sql("SELECT member FROM v$logfile")
        data_rows = self._sql("SELECT name FROM v$datafile")

        all_files = []
        if ctl_rows:
            for r in ctl_rows:
                all_files += [p.strip() for p in str(r[0]).split(",")]
        if redo_rows:
            all_files += [r[0] for r in redo_rows]
        if data_rows:
            all_files += [r[0] for r in data_rows]

        if not all_files:
            self.manual(cid, name, sev, desc, "파일 경로 조회 불가 — 수동 점검", rec,
                        command="SELECT value FROM v$parameter WHERE name='control_files'")
            return

        cmd = f"ls -la {' '.join(all_files[:5])}"
        rc, out, _ = self._run_shell(
            f"ls -la {' '.join(repr(f) for f in all_files[:10])} 2>/dev/null"
        )

        vuln = [l for l in out.splitlines()
                if l.startswith("-") and len(l.split()) >= 9
                and self._perm_to_oct(l.split()[0][1:]) > 0o640]

        if vuln:
            self.vulnerable(cid, name, sev, desc,
                            f"권한 초과 파일: {len(vuln)}개",
                            rec, command=cmd, cmd_output=out, evidence=out[:500])
        else:
            self.safe(cid, name, sev, desc, "컨트롤/Redo/데이터 파일 권한 적절", rec,
                      command=cmd, cmd_output=out[:300])

    def _o407(self):
        cid, name = "O-4.7", "$TNS_ADMIN 파일 접근 제한 (sqlnet.ora/listener.ora)"
        sev = Severity.MEDIUM
        desc = "TNS 설정 파일 변경으로 시스템 장애 가능 — 644 이하 필요"
        rec = "chmod 644 sqlnet.ora listener.ora tnsnames.ora"

        if not self._has_os():
            self._rds_na(cid, name, sev, desc, rec); return

        ora_home = self._get_oracle_home()
        tns_dir = f"{ora_home}/network/admin" if ora_home else ""
        if not tns_dir:
            self.manual(cid, name, sev, desc, "ORACLE_HOME 미설정", rec,
                        command="find / -name sqlnet.ora"); return

        cmd = f"ls -la '{tns_dir}/sqlnet.ora' '{tns_dir}/listener.ora' '{tns_dir}/tnsnames.ora' 2>/dev/null"
        rc, out, _ = self._run_shell(cmd)

        vuln = []
        for line in out.splitlines():
            if line.startswith("-") and len(line.split()) >= 9:
                try:
                    if self._perm_to_oct(line.split()[0][1:]) > 0o644:
                        vuln.append(f"{line.split()[-1]}({line.split()[0]})")
                except Exception:
                    pass

        if vuln:
            self.vulnerable(cid, name, sev, desc,
                            f"권한 초과: {', '.join(vuln)}", rec,
                            command=cmd, cmd_output=out, evidence=out)
        else:
            self.safe(cid, name, sev, desc, "TNS 설정 파일 권한 644 이하", rec,
                      command=cmd, cmd_output=out)

    def _o408(self):
        cid, name = "O-4.8", "감사 로그 파일 접근 제한 (audit_file_dest)"
        sev = Severity.LOW
        desc = "감사 로그 디렉터리 타 사용자 읽기/쓰기 가능 시 중요 정보 노출"
        rec = "chmod 750 <audit_file_dest 디렉터리>"

        if not self._has_os():
            self._rds_na(cid, name, sev, desc, rec); return

        rows = self._sql("SELECT value FROM v$parameter WHERE name='audit_file_dest'")
        audit_dir = rows[0][0] if rows and rows[0][0] else ""
        if not audit_dir:
            self.manual(cid, name, sev, desc, "audit_file_dest 조회 불가", rec,
                        command="SELECT value FROM v$parameter WHERE name='audit_file_dest'")
            return

        cmd = f"ls -ld '{audit_dir}' 2>/dev/null"
        rc, out, _ = self._run_shell(cmd)
        if rc != 0 or not out.strip():
            self.manual(cid, name, sev, desc, f"디렉터리 조회 불가: {audit_dir}", rec,
                        command=cmd); return

        parts = out.strip().split()
        if parts and parts[0].startswith("d"):
            try:
                oct_val = self._perm_to_oct(parts[0][1:])
                if oct_val > 0o750:
                    self.vulnerable(cid, name, sev, desc,
                                    f"감사 로그 디렉터리 권한 초과: {parts[0]} ({audit_dir})",
                                    rec, command=cmd, cmd_output=out, evidence=out)
                else:
                    self.safe(cid, name, sev, desc,
                              f"감사 로그 디렉터리 권한 적절: {parts[0]}", rec,
                              command=cmd, cmd_output=out)
            except Exception:
                self.manual(cid, name, sev, desc, f"권한 파싱 불가: {out}", rec, command=cmd)
        else:
            self.manual(cid, name, sev, desc, f"디렉터리 정보 확인 불가: {out}", rec,
                        command=cmd)

    # ══════════════════════════════════════════════════════════════════
    # 섹션 5: 보안 패치
    # ══════════════════════════════════════════════════════════════════

    def _o501(self):
        cid, name = "O-5.1", "Oracle 보안 패치 적용 여부"
        sev = Severity.HIGH
        desc = "Oracle exploit·제로데이 공격 대응을 위해 최신 패치 필요"
        rec = "oracle.com에서 최신 PSU/RU 확인 및 적용; opatch lsinventory 로 현재 패치 확인"
        cmd = "SELECT version, product FROM product_component_version"

        rows = self._sql("SELECT version, product FROM product_component_version")
        if rows is None:
            self._no_sql(cid, name, sev, desc, rec); return

        versions = "\n".join([f"{r[1]}: {r[0]}" for r in rows])
        self.manual(cid, name, sev, desc,
                    f"현재 버전:\n{versions}\n\nOpatch 패치 이력 수동 확인 필요 (opatch lsinventory)",
                    rec, command=cmd, cmd_output=versions)

    # ══════════════════════════════════════════════════════════════════
    # 섹션 6: 보안 감사 설정
    # ══════════════════════════════════════════════════════════════════

    def _o601(self):
        cid, name = "O-6.1", "SYS 감사 수행 설정 (AUDIT_SYS_OPERATIONS)"
        sev = Severity.LOW
        desc = "SYS/SYSDBA/SYSOPER 접속에 대한 감사 미설정 시 침해 추적 불가"
        rec = "ALTER SYSTEM SET AUDIT_SYS_OPERATIONS=TRUE SCOPE=spfile (재시작 필요)"
        q = "SELECT name, value FROM v$parameter WHERE name='audit_sys_operations'"
        cmd = q

        rows = self._sql(q)
        if rows is None:
            self._no_sql(cid, name, sev, desc, rec); return

        val = rows[0][1].upper() if rows else ""
        if val == "TRUE":
            self.safe(cid, name, sev, desc, "AUDIT_SYS_OPERATIONS=TRUE 설정됨", rec,
                      command=cmd, cmd_output=f"{rows[0][0]}={rows[0][1]}")
        else:
            self.vulnerable(cid, name, sev, desc,
                            f"AUDIT_SYS_OPERATIONS={val or 'FALSE(미설정)'}",
                            rec, command=cmd, evidence=f"{rows[0][0]}={rows[0][1]}" if rows else "")

    def _o602(self):
        cid, name = "O-6.2", "Audit Trail 기록 설정 (AUDIT_TRAIL)"
        sev = Severity.LOW
        desc = "audit_trail=NONE 설정 시 감사 기록 비활성화 — 침해 분석 불가"
        rec = "ALTER SYSTEM SET AUDIT_TRAIL=DB SCOPE=spfile (재시작 필요)"
        q = "SELECT name, value FROM v$parameter WHERE name='audit_trail'"
        cmd = q

        rows = self._sql(q)
        if rows is None:
            self._no_sql(cid, name, sev, desc, rec); return

        val = rows[0][1].upper() if rows else ""
        if val in ("NONE", ""):
            self.vulnerable(cid, name, sev, desc,
                            f"AUDIT_TRAIL={val or 'NONE'} — 감사 비활성화",
                            rec, command=cmd, evidence=f"{rows[0][0]}={rows[0][1]}" if rows else "")
        else:
            self.safe(cid, name, sev, desc, f"AUDIT_TRAIL={val} (활성화됨)", rec,
                      command=cmd, cmd_output=f"{rows[0][0]}={rows[0][1]}" if rows else "")

    # ══════════════════════════════════════════════════════════════════
    # 섹션 7: 네트워크 접근 제어
    # ══════════════════════════════════════════════════════════════════

    def _o701(self):
        cid, name = "O-7.1", "DATA DICTIONARY 접근 제한 (O7_DICTIONARY_ACCESSIBILITY)"
        sev = Severity.LOW
        desc = "O7_DICTIONARY_ACCESSIBILITY=TRUE 시 일반 사용자가 Data Dictionary 접근 가능"
        rec = "ALTER SYSTEM SET O7_DICTIONARY_ACCESSIBILITY=FALSE SCOPE=spfile"
        q = "SELECT name, value FROM v$parameter WHERE name='o7_dictionary_accessibility'"
        cmd = q

        # Oracle 19c+ 에서는 해당 파라미터 미지원
        if self._ora_major >= 19:
            self.skipped(cid, name, sev, desc,
                         f"Oracle {self._ora_major}c — O7_DICTIONARY_ACCESSIBILITY 미지원",
                         rec, command=cmd); return

        rows = self._sql(q)
        if rows is None:
            self._no_sql(cid, name, sev, desc, rec); return

        val = rows[0][1].upper() if rows else "FALSE"
        if val == "TRUE":
            self.vulnerable(cid, name, sev, desc,
                            "O7_DICTIONARY_ACCESSIBILITY=TRUE",
                            rec, command=cmd, evidence=f"{rows[0][0]}={rows[0][1]}" if rows else "")
        else:
            self.safe(cid, name, sev, desc, "O7_DICTIONARY_ACCESSIBILITY=FALSE", rec,
                      command=cmd, cmd_output=f"{rows[0][0]}={rows[0][1]}" if rows else "")

    def _o702(self):
        cid, name = "O-7.2", "원격 OS 인증 방식 설정 (REMOTE_OS_AUTHENT)"
        sev = Severity.MEDIUM
        desc = "REMOTE_OS_AUTHENT=TRUE 시 원격지 OS 인증으로 패스워드 없이 DB 접속 가능"
        rec = "ALTER SYSTEM SET REMOTE_OS_AUTHENT=FALSE SCOPE=spfile"
        q = "SELECT name, value FROM v$parameter WHERE name='remote_os_authent'"
        cmd = q

        # Oracle 21c+ 에서는 미지원
        if self._ora_major >= 21:
            self.skipped(cid, name, sev, desc,
                         f"Oracle {self._ora_major}c — REMOTE_OS_AUTHENT 미지원",
                         rec, command=cmd); return

        rows = self._sql(q)
        if rows is None:
            self._no_sql(cid, name, sev, desc, rec); return

        val = rows[0][1].upper() if rows else "FALSE"
        if val == "TRUE":
            self.vulnerable(cid, name, sev, desc,
                            "REMOTE_OS_AUTHENT=TRUE — 원격 OS 인증 허용",
                            rec, command=cmd, evidence=f"{rows[0][0]}={rows[0][1]}" if rows else "")
        else:
            self.safe(cid, name, sev, desc, "REMOTE_OS_AUTHENT=FALSE", rec,
                      command=cmd, cmd_output=f"{rows[0][0]}={rows[0][1]}" if rows else "")
