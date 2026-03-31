"""
WebServer - IIS 취약점 진단 모듈
SK Shieldus IIS 7.X/8.X/10.X 보안 가이드라인 기반
섹션: 설정(1.1-1.14), 솔루션취약점(2.1-2.3), 보안패치(3.1), 접근제어(4.1-4.3)
"""
from core.base_scanner import BaseScanner
from core.result import ScanReport, Severity


class IISScanner(BaseScanner):
    CATEGORY = "WebServer-IIS"

    def __init__(self, target: str = "localhost", verbose: bool = False, executor=None):
        super().__init__(target, verbose, executor)
        self._webroot: str | None = None  # 최초 조회 후 캐시

    # ── 헬퍼 ─────────────────────────────────────────────────────────────

    def _ps(self, ps_cmd: str, timeout: int = 15) -> tuple[int, str, str]:
        """PowerShell 명령 실행 (cmd.exe / SSM 모두 동작)"""
        safe = ps_cmd.replace('"', '\\"')
        return self._run_shell(f'powershell -NoProfile -NonInteractive -Command "{safe}"', timeout)

    def _get_webroot(self) -> str:
        """Default Web Site 실제 경로 조회 (캐시)"""
        if self._webroot is not None:
            return self._webroot
        rc, out, _ = self._ps(
            "Import-Module WebAdministration -ErrorAction SilentlyContinue; "
            "(Get-Item 'IIS:\\\\Sites\\\\Default Web Site' -ErrorAction SilentlyContinue).physicalPath"
        )
        if rc == 0 and out.strip():
            path = out.strip().replace("%SystemDrive%", "C:").replace("%WinDir%", "C:\\Windows")
            self._webroot = path
        else:
            self._webroot = "C:\\inetpub\\wwwroot"
        return self._webroot

    # ── 메인 실행 ────────────────────────────────────────────────────────

    def run(self) -> ScanReport:
        print(f"\n[*] IIS 취약점 진단 시작 → {self.target}")

        print("  [1] 설정")
        self._i101()
        self._i102()
        self._i103()
        self._i104()
        self._i105()
        self._i106()
        self._i107()
        self._i108()
        self._i109()
        self._i110()
        self._i111()
        self._i112()
        self._i113()
        self._i114()

        print("  [2] 솔루션 취약점")
        self._i201()
        self._i202()
        self._i203()

        print("  [3] 보안 패치")
        self._i301()

        print("  [4] 접근 제어")
        self._i401()
        self._i402()
        self._i403()

        self.report.finish()
        return self.report

    # ══════════════════════════════════════════════════════════════════════
    # 섹션 1: 설정
    # ══════════════════════════════════════════════════════════════════════

    def _i101(self):
        """1.1 응용 프로그램 풀 설정"""
        cid, name = "I-1.1", "응용 프로그램 풀 ID 설정"
        sev = Severity.MEDIUM
        desc = "App Pool Identity가 LocalSystem 또는 Administrators 계정으로 설정된 경우 권한 탈취 위험"
        rec = "App Pool ID를 ApplicationPoolIdentity, LocalService, NetworkService 또는 전용 계정으로 설정"
        cmd = "Get-ChildItem IIS:\\AppPools (processModel 확인)"

        rc, out, _ = self._ps(
            "Import-Module WebAdministration -ErrorAction SilentlyContinue; "
            "Get-ChildItem IIS:\\\\AppPools -ErrorAction SilentlyContinue | ForEach-Object { "
            "$n=$_.Name; $pm=(Get-ItemProperty \\\"IIS:\\\\AppPools\\\\$n\\\" -Name processModel); "
            "\\\"$n|\\\" + $pm.identityType + \\\"|\\\" + $pm.userName }"
        )
        if rc != 0 or not out.strip():
            self.manual(cid, name, sev, desc, "WebAdministration 모듈 로드 불가 — 수동 점검 필요", rec,
                        command=cmd, cmd_output=out)
            return

        vuln_pools = []
        for line in out.splitlines():
            parts = line.split("|")
            if len(parts) < 2:
                continue
            pool_name = parts[0].strip()
            id_type = parts[1].strip().lower() if len(parts) > 1 else ""
            user = parts[2].strip().lower() if len(parts) > 2 else ""
            if "localsystem" in id_type or "administrator" in user:
                vuln_pools.append(f"{pool_name}({id_type}/{user})")

        if vuln_pools:
            self.vulnerable(cid, name, sev, desc,
                            f"위험 ID 설정 풀: {', '.join(vuln_pools)}", rec,
                            command=cmd, cmd_output=out, evidence=out)
        else:
            self.safe(cid, name, sev, desc, "모든 App Pool이 안전한 ID로 설정됨", rec,
                      command=cmd, cmd_output=out)

    def _i102(self):
        """1.2 IIS 사용자 그룹 권한 설정"""
        cid, name = "I-1.2", "IIS 사용자 그룹 권한 설정"
        sev = Severity.MEDIUM
        desc = "웹 루트에 Everyone 그룹 존재 또는 IUSR/Users에 쓰기 권한 부여 시 악성 파일 업로드 위험"
        rec = "Everyone 그룹 제거, IUSR/IIS_IUSRS/Users의 쓰기 권한 제거"

        webroot = self._get_webroot()
        cmd = f'icacls "{webroot}"'
        rc, out, _ = self._run_shell(cmd)
        if rc != 0 or not out.strip():
            self.manual(cid, name, sev, desc, f"icacls 조회 실패 (경로: {webroot})", rec,
                        command=cmd, cmd_output=out)
            return

        out_lower = out.lower()
        issues = []
        if "everyone" in out_lower:
            issues.append("Everyone 그룹 존재")
        for acct in ["iusr", "iis_iusrs", "users"]:
            for line in out.splitlines():
                if acct in line.lower():
                    # (W), (F), (M) 포함 여부 (쓰기/전체/수정)
                    if any(p in line.lower() for p in ["(w)", "(f)", "(m)", "(write)", "(full)"]):
                        issues.append(f"{acct.upper()} 쓰기 권한 존재")
                        break

        if issues:
            self.vulnerable(cid, name, sev, desc, "; ".join(issues), rec,
                            command=cmd, cmd_output=out, evidence=out[:500])
        else:
            self.safe(cid, name, sev, desc, "웹 루트 권한 적절히 설정됨", rec,
                      command=cmd, cmd_output=out)

    def _i103(self):
        """1.3 스크립트 실행 옵션 비활성화"""
        cid, name = "I-1.3", "업로드 디렉터리 스크립트/실행 권한 비활성화"
        sev = Severity.MEDIUM
        desc = "업로드 디렉터리에 Script/Execute 권한이 있을 경우 악성 스크립트 업로드 후 실행 가능"
        rec = "처리기 매핑 → 기능 사용 권한 편집에서 Script, Execute 비활성화"
        cmd = "Get-WebConfiguration system.webServer/handlers (accessPolicy)"

        rc, out, _ = self._ps(
            "Import-Module WebAdministration -ErrorAction SilentlyContinue; "
            "Get-WebConfiguration system.webServer/handlers -PSPath 'IIS:\\\\' "
            "-ErrorAction SilentlyContinue | Select-Object -ExpandProperty accessPolicy"
        )
        if rc != 0 or not out.strip():
            self.manual(cid, name, sev, desc, "핸들러 accessPolicy 조회 불가 — 수동 점검 필요", rec,
                        command=cmd, cmd_output=out)
            return

        out_lower = out.lower()
        issues = []
        if "script" in out_lower:
            issues.append("Script 권한 설정됨")
        if "execute" in out_lower:
            issues.append("Execute 권한 설정됨")

        if issues:
            self.vulnerable(cid, name, sev, desc, "; ".join(issues), rec,
                            command=cmd, cmd_output=out, evidence=out)
        else:
            self.safe(cid, name, sev, desc, "Script/Execute 권한 없음", rec,
                      command=cmd, cmd_output=out)

    def _i104(self):
        """1.4 상위 경로 사용 옵션 비활성화"""
        cid, name = "I-1.4", "ASP 상위 경로(부모 경로) 사용 비활성화"
        sev = Severity.MEDIUM
        desc = "부모 경로(../) 사용 활성화 시 Unicode 버그·디렉터리 트래버설 공격에 노출"
        rec = "IIS 관리자 → ASP → 부모 경로 사용 → False 설정"
        cmd = "Get-WebConfigurationProperty system.webServer/asp enableParentPaths"

        rc, out, _ = self._ps(
            "Import-Module WebAdministration -ErrorAction SilentlyContinue; "
            "Get-WebConfigurationProperty -Filter 'system.webServer/asp' "
            "-PSPath 'IIS:\\\\' -Name enableParentPaths -ErrorAction SilentlyContinue"
        )
        if rc != 0 or not out.strip():
            self.manual(cid, name, sev, desc, "ASP 설정 조회 불가 — 수동 점검 필요", rec,
                        command=cmd, cmd_output=out)
            return

        if "true" in out.lower():
            self.vulnerable(cid, name, sev, desc, "enableParentPaths = True", rec,
                            command=cmd, cmd_output=out, evidence=out)
        else:
            self.safe(cid, name, sev, desc, "부모 경로 사용 비활성화됨 (False)", rec,
                      command=cmd, cmd_output=out)

    def _i105(self):
        """1.5 디렉터리 검색 기능 제거"""
        cid, name = "I-1.5", "디렉터리 검색(Directory Browsing) 비활성화"
        sev = Severity.MEDIUM
        desc = "디렉터리 검색 활성화 시 서버 파일 목록 노출 및 주요 설정 파일 유출 위험"
        rec = "IIS 관리자 → 디렉터리 검색 → 사용 안 함"
        cmd = "Get-WebConfigurationProperty directoryBrowse enabled"

        rc, out, _ = self._ps(
            "Import-Module WebAdministration -ErrorAction SilentlyContinue; "
            "Get-WebConfigurationProperty -Filter /system.webServer/directoryBrowse "
            "-PSPath 'IIS:\\\\' -Name enabled -ErrorAction SilentlyContinue"
        )
        if rc != 0 or not out.strip():
            self.manual(cid, name, sev, desc, "설정 조회 불가 — 수동 점검 필요", rec,
                        command=cmd, cmd_output=out)
            return

        if "true" in out.lower():
            self.vulnerable(cid, name, sev, desc, "디렉터리 검색 활성화됨", rec,
                            command=cmd, cmd_output=out, evidence=out)
        else:
            self.safe(cid, name, sev, desc, "디렉터리 검색 비활성화됨", rec,
                      command=cmd, cmd_output=out)

    def _i106(self):
        """1.6 로그 디렉터리/파일 권한 설정"""
        cid, name = "I-1.6", "IIS 로그 디렉터리/파일 권한 설정"
        sev = Severity.MEDIUM
        desc = "로그 디렉터리에 Users 또는 Everyone 그룹 존재 시 로그 유출·변조 위험"
        rec = "로그 디렉터리에서 Users, Everyone 그룹 제거 (Administrators, SYSTEM만 허용)"

        # 로그 경로 조회
        rc0, log_dir, _ = self._ps(
            "Import-Module WebAdministration -ErrorAction SilentlyContinue; "
            "try { (Get-WebConfigurationProperty "
            "-Filter 'system.applicationHost/sites/site[@name=\\\"Default Web Site\\\"]/logFile' "
            "-PSPath 'IIS:\\\\' -Name directory -ErrorAction SilentlyContinue).Value } "
            "catch { '%WinDir%\\\\System32\\\\LogFiles' }"
        )
        if rc0 == 0 and log_dir.strip():
            log_dir = log_dir.strip().replace("%WinDir%", r"C:\Windows").replace("%SystemDrive%", "C:")
        else:
            log_dir = r"C:\Windows\System32\LogFiles"

        cmd = f'icacls "{log_dir}"'
        rc, out, _ = self._run_shell(cmd)
        if rc != 0 or not out.strip():
            self.manual(cid, name, sev, desc, f"icacls 조회 실패 (경로: {log_dir})", rec,
                        command=cmd, cmd_output=out)
            return

        out_lower = out.lower()
        issues = []
        if "everyone" in out_lower:
            issues.append("Everyone 그룹 존재")
        if "\\users" in out_lower or " users " in out_lower:
            issues.append("Users 그룹 존재")

        if issues:
            self.vulnerable(cid, name, sev, desc, "; ".join(issues), rec,
                            command=cmd, cmd_output=out, evidence=out[:500])
        else:
            self.safe(cid, name, sev, desc, f"로그 디렉터리 권한 적절 ({log_dir})", rec,
                      command=cmd, cmd_output=out)

    def _i107(self):
        """1.7 로그 포맷 설정"""
        cid, name = "I-1.7", "IIS 로그 포맷(W3C) 및 필수 필드 설정"
        sev = Severity.HIGH
        desc = "로그 형식이 W3C가 아니거나 필수 필드 미설정 시 공격 추적 불가"
        rec = "IIS 로깅 → W3C 형식, 필수 필드(날짜/시간/IP/포트/URI/상태/UserAgent 등) 활성화"
        cmd = "Get-WebConfigurationProperty logFile (logFormat, localTimeRollover, logExtFileFlags)"

        rc, out, _ = self._ps(
            "Import-Module WebAdministration -ErrorAction SilentlyContinue; "
            "$lf = Get-WebConfigurationProperty "
            "-Filter 'system.applicationHost/sites/site[@name=\\\"Default Web Site\\\"]/logFile' "
            "-PSPath 'IIS:\\\\' -Name * -ErrorAction SilentlyContinue; "
            "if ($lf) { 'logFormat=' + $lf.logFormat + "
            "'|localTimeRollover=' + $lf.localTimeRollover + "
            "'|logExtFileFlags=' + $lf.logExtFileFlags }"
        )
        if rc != 0 or not out.strip():
            self.manual(cid, name, sev, desc, "로그 설정 조회 불가 — 수동 점검 필요", rec,
                        command=cmd, cmd_output=out)
            return

        out_lower = out.lower()
        issues = []
        if "logformat=w3c" not in out_lower:
            issues.append("로그 형식이 W3C가 아님")

        # 필수 필드 확인
        _required = ["date", "time", "clientip", "username", "serverport",
                     "uristem", "uriquery", "httpstatus", "bytessent",
                     "bytesrecv", "timetaken", "useragent", "referer"]
        if "logextfileflags=" in out_lower:
            flags_str = out_lower.split("logextfileflags=")[-1]
            missing = [f for f in _required if f not in flags_str]
            if missing:
                issues.append(f"필수 필드 누락: {', '.join(missing)}")

        if issues:
            self.vulnerable(cid, name, sev, desc, "; ".join(issues), rec,
                            command=cmd, cmd_output=out, evidence=out)
        else:
            self.safe(cid, name, sev, desc, "W3C 형식 및 필수 필드 설정됨", rec,
                      command=cmd, cmd_output=out)

    def _i108(self):
        """1.8 로그 저장 주기 (수동점검)"""
        cid, name = "I-1.8", "IIS 로그 저장 주기 준수 여부"
        sev = Severity.HIGH
        desc = ("접속기록 보관 기간 기준: 사용자 접속기록 6개월, "
                "개인정보 처리시스템 접속기록 2년, 권한변경기록 5년 이상")
        rec = "담당자에게 로그 보관 기간 정책 및 정기 백업 현황 확인"
        self.manual(cid, name, sev, desc, "로그 보관 주기는 담당자 인터뷰로만 확인 가능", rec,
                    command="서버 운영 담당자 문의")

    def _i109(self):
        """1.9 헤더 정보 노출 방지"""
        cid, name = "I-1.9", "HTTP 응답 헤더 서버 정보 노출 방지"
        sev = Severity.LOW
        desc = "Server, X-Powered-By 등 헤더를 통해 IIS/ASP.NET 버전 정보 노출 가능"
        rec = "web.config outbound rules로 Server/X-Powered-By/X-AspNet-Version 헤더 제거"

        webroot = self._get_webroot()
        rc, out, _ = self._run_shell(f'type "{webroot}\\web.config" 2>nul')
        has_outbound = ("outboundrules" in out.lower() and "response_server" in out.lower())

        rc2, out2, _ = self._ps(
            "Import-Module WebAdministration -ErrorAction SilentlyContinue; "
            "Get-WebConfigurationProperty "
            "-Filter 'system.webServer/security/requestFiltering' "
            "-PSPath 'IIS:\\\\' -Name removeServerHeader -ErrorAction SilentlyContinue"
        )
        remove_hdr = "true" in out2.lower() if rc2 == 0 else False
        cmd = "type web.config + Get-WebConfigurationProperty removeServerHeader"

        if remove_hdr or has_outbound:
            self.safe(cid, name, sev, desc,
                      f"서버 헤더 제거 설정됨 (removeServerHeader={remove_hdr}, outboundRule={has_outbound})",
                      rec, command=cmd, cmd_output=f"{out2}\n{out[:200]}")
        else:
            self.vulnerable(cid, name, sev, desc,
                            "RemoveServerHeader 미설정, 아웃바운드 규칙 없음 — 헤더 노출 가능",
                            rec, command=cmd,
                            cmd_output=f"{out2}\n{out[:200]}", evidence=out[:300] if out else "")

    def _i110(self):
        """1.10 불필요한 FTP 서비스 제거"""
        cid, name = "I-1.10", "불필요한 FTP 서비스 제거"
        sev = Severity.MEDIUM
        desc = "불필요한 FTP 서비스 운영 시 파일 무단 업로드·다운로드 및 주요 정보 유출 위험"
        rec = "FTP 불필요 시 서비스 중지·제거; 필요 시 익명 인증 비활성화, IP 제한, 로깅 설정"
        cmd = "sc query ftpsvc"

        rc, out, _ = self._run_shell("sc query ftpsvc 2>nul")
        svc_absent = rc != 0 or "does not exist" in out.lower() or "존재하지" in out
        if svc_absent:
            self.safe(cid, name, sev, desc, "FTP 서비스(ftpsvc) 미설치/없음", rec,
                      command=cmd, cmd_output=out)
            return

        if "running" not in out.lower() and "실행 중" not in out:
            self.safe(cid, name, sev, desc, "FTP 서비스 중지됨", rec,
                      command=cmd, cmd_output=out)
            return

        # FTP 실행 중 — 익명 인증 확인
        rc2, out2, _ = self._ps(
            "Import-Module WebAdministration -ErrorAction SilentlyContinue; "
            "Get-WebConfigurationProperty "
            "-Filter 'system.ftpServer/security/authentication/anonymousAuthentication' "
            "-PSPath 'IIS:\\\\' -Name enabled -ErrorAction SilentlyContinue"
        )
        issues = ["FTP 서비스 실행 중"]
        if rc2 == 0 and "true" in out2.lower():
            issues.append("익명 인증 활성화")

        self.vulnerable(cid, name, sev, desc, "; ".join(issues), rec,
                        command=cmd, cmd_output=out, evidence=out)

    def _i111(self):
        """1.11 불필요한 SMTP 서비스 제거"""
        cid, name = "I-1.11", "불필요한 SMTP 서비스 제거"
        sev = Severity.MEDIUM
        desc = "불필요한 SMTP 서비스 운영 시 스팸 릴레이 서버로 악용되거나 서버 침해 발생 가능"
        rec = "SMTP 불필요 시 서비스 중지·제거; 필요 시 릴레이 컴퓨터 명시적 등록, 무제한 릴레이 비활성화"
        cmd = "sc query SMTPSVC"

        rc, out, _ = self._run_shell("sc query SMTPSVC 2>nul")
        svc_absent = rc != 0 or "does not exist" in out.lower() or "존재하지" in out
        if svc_absent:
            self.safe(cid, name, sev, desc, "SMTP 서비스(SMTPSVC) 미설치/없음", rec,
                      command=cmd, cmd_output=out)
            return

        if "running" not in out.lower() and "실행 중" not in out:
            self.safe(cid, name, sev, desc, "SMTP 서비스 중지됨", rec,
                      command=cmd, cmd_output=out)
            return

        self.vulnerable(cid, name, sev, desc,
                        "SMTP 서비스 실행 중 — 릴레이 설정 수동 확인 필요", rec,
                        command=cmd, cmd_output=out, evidence=out)

    def _i112(self):
        """1.12 디버깅 메시지 출력 제한"""
        cid, name = "I-1.12", "ASP 클라이언트 디버깅 비활성화"
        sev = Severity.MEDIUM
        desc = "ASP 클라이언트 디버깅 활성화 시 에러 코드가 브라우저에 노출되어 서버 정보 유출"
        rec = "IIS 관리자 → ASP → 컴파일 → 디버깅 속성 → 클라이언트 쪽 디버깅 사용 → False"
        cmd = "Get-WebConfigurationProperty asp appDebug.clientDebuggingEnabled"

        rc, out, _ = self._ps(
            "Import-Module WebAdministration -ErrorAction SilentlyContinue; "
            "Get-WebConfigurationProperty -Filter 'system.webServer/asp' "
            "-PSPath 'IIS:\\\\' -Name appDebug -ErrorAction SilentlyContinue "
            "| Select-Object -ExpandProperty clientDebuggingEnabled"
        )
        if rc != 0 or not out.strip():
            # 대안: scriptErrorSentToBrowser
            rc2, out2, _ = self._ps(
                "Import-Module WebAdministration -ErrorAction SilentlyContinue; "
                "Get-WebConfigurationProperty -Filter 'system.webServer/asp' "
                "-PSPath 'IIS:\\\\' -Name scriptErrorSentToBrowser -ErrorAction SilentlyContinue"
            )
            if rc2 != 0 or not out2.strip():
                self.manual(cid, name, sev, desc, "ASP 디버깅 설정 조회 불가 — 수동 점검 필요", rec,
                            command=cmd, cmd_output=out)
                return
            if "true" in out2.lower():
                self.vulnerable(cid, name, sev, desc, "scriptErrorSentToBrowser = True", rec,
                                command=cmd, cmd_output=out2, evidence=out2)
            else:
                self.safe(cid, name, sev, desc, "스크립트 오류 브라우저 전송 비활성화됨", rec,
                          command=cmd, cmd_output=out2)
            return

        if "true" in out.lower():
            self.vulnerable(cid, name, sev, desc, "clientDebuggingEnabled = True", rec,
                            command=cmd, cmd_output=out, evidence=out)
        else:
            self.safe(cid, name, sev, desc, "클라이언트 디버깅 비활성화됨 (False)", rec,
                      command=cmd, cmd_output=out)

    def _i113(self):
        """1.13 웹 파티션과 시스템 파티션 분리"""
        cid, name = "I-1.13", "웹 파티션과 시스템 파티션 분리"
        sev = Severity.LOW
        desc = "웹 루트와 OS가 같은 드라이브에 있을 경우 웹 취약점을 통한 시스템 파일 접근 위험"
        rec = "웹 사이트 루트를 OS 드라이브(C:)가 아닌 다른 드라이브(예: D:\\)로 이전"
        cmd = "echo %SystemDrive% + IIS 실제 경로 비교"

        webroot = self._get_webroot()
        rc, out, _ = self._run_shell("echo %SystemDrive%")
        sys_drive = out.strip().rstrip("\\").upper() if rc == 0 and out.strip() else "C:"
        web_drive = (webroot[:2].upper() if len(webroot) >= 2 else "C:")

        if web_drive == sys_drive:
            self.vulnerable(cid, name, sev, desc,
                            f"웹 루트({webroot})가 OS와 동일 드라이브({sys_drive})", rec,
                            command=cmd, cmd_output=out, evidence=webroot)
        else:
            self.safe(cid, name, sev, desc,
                      f"웹 루트({web_drive}:)와 OS({sys_drive}) 분리됨", rec,
                      command=cmd, cmd_output=out)

    def _i114(self):
        """1.14 IIS 링크(심볼릭 링크/바로가기) 사용 금지"""
        cid, name = "I-1.14", "웹 디렉터리 내 심볼릭 링크/바로가기 제거"
        sev = Severity.HIGH
        desc = "웹 디렉터리 내 심볼릭 링크·aliases·바로가기 존재 시 허용되지 않은 경로 접근 가능"
        rec = "홈 디렉터리 내 심볼릭 링크(.lnk, junction, symlink) 전체 제거"

        webroot = self._get_webroot()
        cmd = f"Get-ChildItem {webroot} -Recurse (ReparsePoint/.lnk 검색)"
        rc, out, _ = self._ps(
            f"Get-ChildItem -Path '{webroot}' -Recurse -ErrorAction SilentlyContinue "
            "| Where-Object {{ ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) "
            "-or $_.Extension -eq '.lnk' }} "
            "| Select-Object -ExpandProperty FullName"
        )
        if rc != 0:
            self.manual(cid, name, sev, desc, f"웹 루트 조회 실패 (경로: {webroot})", rec,
                        command=cmd, cmd_output=out)
            return

        links = [l.strip() for l in out.splitlines() if l.strip()]
        if links:
            self.vulnerable(cid, name, sev, desc,
                            f"심볼릭 링크/바로가기 {len(links)}개 발견: {', '.join(links[:5])}",
                            rec, command=cmd, cmd_output=out, evidence=out[:500])
        else:
            self.safe(cid, name, sev, desc, "심볼릭 링크/바로가기 없음", rec,
                      command=cmd, cmd_output=out)

    # ══════════════════════════════════════════════════════════════════════
    # 섹션 2: 솔루션 취약점
    # ══════════════════════════════════════════════════════════════════════

    def _i201(self):
        """2.1 기본 문서명 사용 제한"""
        cid, name = "I-2.1", "기본 문서명 사용 제한"
        sev = Severity.LOW
        desc = "기본 문서명을 디폴트(default.htm, iisstart.htm 등)로 사용 시 서버 종류·버전 유추 가능"
        rec = "기본 문서 비활성화 또는 디폴트 문서명을 임의의 이름으로 변경"
        cmd = "Get-WebConfiguration defaultDocument (enabled + files)"

        _default_docs = {"default.htm", "default.asp", "index.htm", "index.html",
                         "iisstart.htm", "default.aspx", "index.php"}

        rc, out, _ = self._ps(
            "Import-Module WebAdministration -ErrorAction SilentlyContinue; "
            "$dd = Get-WebConfigurationProperty -Filter /system.webServer/defaultDocument "
            "-PSPath 'IIS:\\\\' -Name enabled -ErrorAction SilentlyContinue; "
            "$files = (Get-WebConfiguration /system.webServer/defaultDocument/files "
            "-PSPath 'IIS:\\\\' -ErrorAction SilentlyContinue).Collection "
            "| ForEach-Object { $_.value }; "
            "'enabled=' + $dd + '|files=' + ($files -join ',')"
        )
        if rc != 0 or not out.strip():
            self.manual(cid, name, sev, desc, "기본 문서 설정 조회 불가 — 수동 점검 필요", rec,
                        command=cmd, cmd_output=out)
            return

        out_lower = out.lower()
        enabled = "enabled=true" in out_lower
        files_part = out_lower.split("files=")[-1] if "files=" in out_lower else ""
        current_docs = {d.strip() for d in files_part.split(",") if d.strip()}
        default_used = current_docs & _default_docs

        if not enabled:
            self.safe(cid, name, sev, desc, "기본 문서 기능 비활성화됨", rec,
                      command=cmd, cmd_output=out)
        elif default_used:
            self.vulnerable(cid, name, sev, desc,
                            f"디폴트 문서명 사용 중: {', '.join(default_used)}", rec,
                            command=cmd, cmd_output=out, evidence=out)
        else:
            self.safe(cid, name, sev, desc,
                      f"임의의 기본 문서명 사용 중: {', '.join(current_docs)}", rec,
                      command=cmd, cmd_output=out)

    def _i202(self):
        """2.2 WebDAV 설정 제한 및 TRACE 메서드 차단"""
        cid, name = "I-2.2", "WebDAV 비활성화 및 TRACE 메서드 차단"
        sev = Severity.MEDIUM
        desc = "WebDAV 활성화 시 파일 무단 수정·삭제 위험; TRACE는 XST 공격에 악용됨"
        rec = "WebDAV 비활성화, 요청 필터링 → HTTP 동사 → TRACE 거부 추가"

        # WebDAV 확인
        rc, out_dav, _ = self._ps(
            "Import-Module WebAdministration -ErrorAction SilentlyContinue; "
            "Get-WebConfigurationProperty "
            "-Filter 'system.webServer/webdav/authoring' "
            "-PSPath 'IIS:\\\\' -Name enabled -ErrorAction SilentlyContinue"
        )
        webdav_enabled = "true" in out_dav.lower() if rc == 0 and out_dav.strip() else None

        # TRACE 차단 여부
        rc2, out_verb, _ = self._ps(
            "Import-Module WebAdministration -ErrorAction SilentlyContinue; "
            "(Get-WebConfigurationProperty "
            "-Filter 'system.webServer/security/requestFiltering/verbs' "
            "-PSPath 'IIS:\\\\' -Name . -ErrorAction SilentlyContinue).Collection "
            "| ForEach-Object { $_.verb + '=' + $_.allowed }"
        )
        trace_denied = False
        if rc2 == 0:
            for line in out_verb.splitlines():
                if "trace" in line.lower() and "false" in line.lower():
                    trace_denied = True
                    break

        cmd = "Get-WebConfigurationProperty webdav/authoring + requestFiltering/verbs"
        issues = []
        if webdav_enabled is True:
            issues.append("WebDAV 활성화됨")
        if not trace_denied:
            issues.append("TRACE 메서드 차단 미설정")

        combined = f"{out_dav}\n{out_verb}"
        if issues:
            self.vulnerable(cid, name, sev, desc, "; ".join(issues), rec,
                            command=cmd, cmd_output=combined, evidence=combined[:500])
        else:
            self.safe(cid, name, sev, desc, "WebDAV 비활성화, TRACE 차단됨", rec,
                      command=cmd, cmd_output=combined)

    def _i203(self):
        """2.3 asa/asax 확장자 사용 제한"""
        cid, name = "I-2.3", "asa/asax 확장자 처리기 제거 또는 요청 필터링 적용"
        sev = Severity.HIGH
        desc = "Global.asa/asax에 DB 접속정보 등 민감정보 포함 가능 — 외부 요청 차단 필요"
        rec = "처리기 매핑에서 .asa/.asax 제거 또는 요청 필터링에 .asa/.asax 확장자 거부 추가"

        # 처리기 매핑에 .asa/.asax 존재 여부
        rc, out_hdl, _ = self._ps(
            "Import-Module WebAdministration -ErrorAction SilentlyContinue; "
            "(Get-WebConfiguration system.webServer/handlers "
            "-PSPath 'IIS:\\\\' -ErrorAction SilentlyContinue).Collection "
            "| Where-Object { $_.path -like '*.asa' -or $_.path -like '*.asax' } "
            "| ForEach-Object { $_.path + ' enabled=' + $_.enabled }"
        )
        has_handler = bool(out_hdl.strip()) if rc == 0 else None

        # 요청 필터링에 .asa/.asax 거부 여부
        rc2, out_fe, _ = self._ps(
            "Import-Module WebAdministration -ErrorAction SilentlyContinue; "
            "(Get-WebConfigurationProperty "
            "-Filter 'system.webServer/security/requestFiltering/fileExtensions' "
            "-PSPath 'IIS:\\\\' -Name . -ErrorAction SilentlyContinue).Collection "
            "| ForEach-Object { $_.fileExtension + '=' + $_.allowed }"
        )
        filter_asa = filter_asax = False
        if rc2 == 0:
            for line in out_fe.splitlines():
                ll = line.lower()
                if ".asa=" in ll and "false" in ll:
                    filter_asa = True
                if ".asax=" in ll and "false" in ll:
                    filter_asax = True

        cmd = "Get-WebConfiguration handlers + requestFiltering/fileExtensions"
        combined = f"{out_hdl}\n{out_fe}"

        if has_handler is None:
            self.manual(cid, name, sev, desc, "처리기/필터 조회 불가 — 수동 점검 필요", rec,
                        command=cmd, cmd_output=combined)
        elif not has_handler:
            self.safe(cid, name, sev, desc, ".asa/.asax 처리기 매핑 없음", rec,
                      command=cmd, cmd_output=combined)
        elif filter_asa and filter_asax:
            self.safe(cid, name, sev, desc, ".asa/.asax 요청 필터링으로 차단됨", rec,
                      command=cmd, cmd_output=combined)
        else:
            missing = []
            if not filter_asa:
                missing.append(".asa")
            if not filter_asax:
                missing.append(".asax")
            self.vulnerable(cid, name, sev, desc,
                            f"처리기 매핑에 존재하고 요청 필터링 미적용: {', '.join(missing)}",
                            rec, command=cmd, cmd_output=combined, evidence=combined[:500])

    # ══════════════════════════════════════════════════════════════════════
    # 섹션 3: 보안 패치
    # ══════════════════════════════════════════════════════════════════════

    def _i301(self):
        """3.1 보안 패치 적용 (수동점검)"""
        cid, name = "I-3.1", "IIS 보안 패치 적용 여부"
        sev = Severity.HIGH
        desc = "보안 패치 미적용 시 exploit·제로데이 공격에 의한 서버 침해 발생 가능"
        rec = "http://windowsupdate.microsoft.com 접속하여 IIS 관련 최신 패치 확인 및 적용"
        cmd = r'reg query "HKLM\SOFTWARE\Microsoft\InetStp" /v VersionString'

        rc, out, _ = self._run_shell(f'{cmd} 2>nul')
        version_info = ""
        if rc == 0:
            for line in out.splitlines():
                if "VersionString" in line:
                    version_info = line.strip()
                    break

        self.manual(cid, name, sev, desc,
                    f"IIS 버전: {version_info if version_info else '조회 불가'} — MS 보안 패치 사이트 수동 확인 필요",
                    rec, command=cmd, cmd_output=out)

    # ══════════════════════════════════════════════════════════════════════
    # 섹션 4: 접근 제어
    # ══════════════════════════════════════════════════════════════════════

    def _i401(self):
        """4.1 관리 서비스 접근 통제"""
        cid, name = "I-4.1", "IIS 관리 서비스(wmsvc) 포트/IP 접근 통제"
        sev = Severity.MEDIUM
        desc = "관리 서비스가 기본 포트(8172)로 외부 접근 허용 시 관리자 권한 탈취 위험"
        rec = "관리 서비스 미사용 시 중지; 사용 시 포트 변경(8172→임의), IP 제한 설정"

        rc, out_svc, _ = self._run_shell("sc query wmsvc 2>nul")
        svc_absent = rc != 0 or "does not exist" in out_svc.lower()
        if svc_absent:
            self.safe(cid, name, sev, desc, "IIS 관리 서비스(wmsvc) 미설치/없음", rec,
                      command="sc query wmsvc", cmd_output=out_svc)
            return

        if "running" not in out_svc.lower() and "실행 중" not in out_svc:
            self.safe(cid, name, sev, desc, "IIS 관리 서비스(wmsvc) 중지됨", rec,
                      command="sc query wmsvc", cmd_output=out_svc)
            return

        # 포트 확인
        rc2, out_port, _ = self._run_shell(
            r'reg query "HKLM\SOFTWARE\Microsoft\WebManagement\Server" /v Port 2>nul'
        )
        port: int | None = None
        if rc2 == 0:
            for line in out_port.splitlines():
                if "Port" in line and "REG_DWORD" in line:
                    try:
                        port = int(line.split()[-1], 16)
                    except Exception:
                        pass

        # 원격 연결 활성화 여부
        rc3, out_rem, _ = self._run_shell(
            r'reg query "HKLM\SOFTWARE\Microsoft\WebManagement\Server" /v EnableRemoteManagement 2>nul'
        )
        remote_enabled = False
        if rc3 == 0:
            for line in out_rem.splitlines():
                if "EnableRemoteManagement" in line and "REG_DWORD" in line:
                    try:
                        remote_enabled = int(line.split()[-1], 16) == 1
                    except Exception:
                        pass

        cmd = "sc query wmsvc + reg query WebManagement (Port, EnableRemoteManagement)"
        combined = f"{out_svc}\n{out_port}\n{out_rem}"
        issues = []
        if remote_enabled and port == 8172:
            issues.append("기본 포트(8172) 사용 중")
        if remote_enabled:
            issues.append("원격 연결 활성화 — IP 제한 수동 확인 필요")

        if issues:
            self.vulnerable(cid, name, sev, desc, "; ".join(issues), rec,
                            command=cmd, cmd_output=combined,
                            evidence=f"Port={port}, RemoteEnabled={remote_enabled}")
        else:
            self.safe(cid, name, sev, desc,
                      f"관리 서비스 Port={port}, RemoteEnabled={remote_enabled}", rec,
                      command=cmd, cmd_output=combined)

    def _i402(self):
        """4.2 관리자 default 계정명 변경"""
        cid, name = "I-4.2", "IIS 관리자 계정명 유추 불가 여부"
        sev = Severity.LOW
        desc = "관리 서비스 사용 시 IIS 관리자 계정이 유추하기 쉬운 이름(admin 등)이면 위험"
        rec = "IIS 관리자 계정명을 유추하기 어려운 이름으로 변경"
        cmd = "Get-Content administration.config (userName 항목)"

        _obvious = {"admin", "administrator", "iisadmin", "iisuser", "webadmin", "root"}
        rc, out, _ = self._ps(
            "Get-Content 'C:\\\\Windows\\\\System32\\\\inetsrv\\\\config\\\\administration.config' "
            "-ErrorAction SilentlyContinue | Select-String 'userName'"
        )
        if rc != 0 or not out.strip():
            self.manual(cid, name, sev, desc, "IIS 관리자 설정 파일 조회 불가 — 수동 확인 필요", rec,
                        command=cmd, cmd_output=out)
            return

        found_obvious = [n for n in _obvious if n in out.lower()]
        if found_obvious:
            self.vulnerable(cid, name, sev, desc,
                            f"유추하기 쉬운 계정명 사용: {', '.join(found_obvious)}", rec,
                            command=cmd, cmd_output=out[:300], evidence=out[:300])
        else:
            self.manual(cid, name, sev, desc,
                        f"계정명 확인 요망 (파일 내용): {out.strip()[:200]}", rec,
                        command=cmd, cmd_output=out[:300])

    def _i403(self):
        """4.3 관리자 패스워드 정책 (수동점검)"""
        cid, name = "I-4.3", "IIS 관리자 패스워드 정책 준수 여부"
        sev = Severity.MEDIUM
        desc = ("8자 이상, 2종류 이상 조합, 3개월 주기 변경, 10회 실패 시 잠금 등 "
                "패스워드 정책 미준수 시 비인가 접근 위험")
        rec = "패스워드: 8자 이상/2종류 이상, 변경 주기 3개월, 직전 1개 재사용 금지, 10회 잠금"
        self.manual(cid, name, sev, desc, "IIS 관리자 패스워드 정책은 담당자 인터뷰로만 확인 가능", rec,
                    command="서버 운영 담당자 문의")
