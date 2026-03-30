"""
WebServer - IIS 취약점 진단 모듈
주요 점검 영역: 디렉토리 브라우징, 버전 노출, 불필요한 HTTP 메서드, 로그, SSL
"""
from core.base_scanner import BaseScanner
from core.result import ScanReport, Severity


class IISScanner(BaseScanner):
    CATEGORY = "WebServer-IIS"

    def run(self) -> ScanReport:
        print(f"\n[*] IIS 취약점 진단 시작 → {self.target}")
        self._check_directory_browsing()
        self._check_version_header()
        self._check_http_methods()
        self._check_logging()
        self._check_ssl_tls()
        self._check_request_filtering()
        self._check_default_docs()
        self.report.finish()
        return self.report

    def _run_ps(self, script: str) -> tuple[int, str, str]:
        """PowerShell 명령 실행."""
        return self._run_cmd(f'powershell -NoProfile -NonInteractive -Command "{script}"')

    # ── 점검 항목 ──────────────────────────────────────────────────

    def _check_directory_browsing(self):
        cid, name = "WS-I-01", "디렉토리 브라우징 비활성화"
        desc = "IIS 디렉토리 브라우징이 활성화되면 서버 파일 목록이 노출됩니다."
        rec = "IIS 관리자 → 디렉토리 검색 → 사용 안 함"

        rc, out, _ = self._run_ps(
            "Import-Module WebAdministration; "
            "Get-WebConfigurationProperty -Filter /system.webServer/directoryBrowse "
            "-PSPath 'IIS:\\' -Name enabled"
        )
        if rc != 0:
            self.manual(cid, name, Severity.HIGH, desc,
                        "PowerShell WebAdministration 모듈 필요 — 수동 점검 필요", rec)
            return
        enabled = "true" in out.lower()
        if enabled:
            self.vulnerable(cid, name, Severity.HIGH, desc, "디렉토리 브라우징 활성화됨", rec, out)
        else:
            self.safe(cid, name, Severity.HIGH, desc, "디렉토리 브라우징 비활성화됨", rec)

    def _check_version_header(self):
        cid, name = "WS-I-02", "IIS 버전 정보 노출 방지 (X-Powered-By, Server 헤더)"
        desc = "HTTP 응답 헤더에 IIS 버전 정보가 노출되면 공격자가 취약점을 특정할 수 있습니다."
        rec = "web.config에 customHeaders 설정으로 X-Powered-By 제거, URLScan/IIS 설정으로 Server 헤더 변경"

        rc, out, _ = self._run_ps(
            "Get-WebConfigurationProperty -Filter /system.webServer/httpProtocol/customHeaders "
            "-PSPath 'IIS:\\' -Name . | Select-Object -ExpandProperty Collection"
        )
        # X-Powered-By 헤더 제거 여부는 응답 헤더로도 확인
        rc2, out2, _ = self._run_cmd(f"curl -sI http://{self.target}/ -m 5")
        if "x-powered-by" in out2.lower() or "x-aspnet" in out2.lower():
            self.vulnerable(cid, name, Severity.MEDIUM, desc,
                            "X-Powered-By 또는 ASP.NET 버전 헤더 노출", rec, out2[:300])
        elif rc2 == 0:
            self.safe(cid, name, Severity.MEDIUM, desc, "X-Powered-By 헤더 미노출", rec)
        else:
            self.manual(cid, name, Severity.MEDIUM, desc, "HTTP 응답 확인 불가 — 수동 점검 필요", rec)

    def _check_http_methods(self):
        cid, name = "WS-I-03", "불필요한 HTTP 메서드 제한 (TRACE, DELETE 등)"
        desc = "TRACE, PUT, DELETE 등 불필요한 HTTP 메서드가 허용되면 취약점으로 악용될 수 있습니다."
        rec = "requestFiltering → verbs에 허용 메서드만 명시적으로 설정"

        for method in ["TRACE", "DELETE", "PUT"]:
            rc, out, _ = self._run_cmd(f"curl -s -X {method} http://{self.target}/ -o /dev/null -w '%{{http_code}}' -m 5")
            if rc == 0 and out.strip() not in ("405", "403", "501", "400", "000"):
                self.vulnerable(cid, name, Severity.MEDIUM, desc,
                                f"HTTP {method} 메서드 허용 (응답코드: {out.strip()})", rec)
                return
        self.safe(cid, name, Severity.MEDIUM, desc, "TRACE/DELETE/PUT 메서드 차단됨", rec)

    def _check_logging(self):
        cid, name = "WS-I-04", "IIS 접근 로그 활성화 여부"
        desc = "IIS 로그가 비활성화되어 있으면 보안 사고 추적이 불가능합니다."
        rec = "IIS 관리자 → 로깅 → 사용으로 설정, W3C 형식 권장"

        rc, out, _ = self._run_ps(
            "Get-WebConfigurationProperty -Filter /system.webServer/httpLogging "
            "-PSPath 'IIS:\\' -Name dontLog"
        )
        if rc != 0:
            self.manual(cid, name, Severity.MEDIUM, desc, "PowerShell 조회 실패 — 수동 점검 필요", rec)
            return
        if "true" in out.lower():
            self.vulnerable(cid, name, Severity.MEDIUM, desc, "IIS 로깅 비활성화됨", rec, out)
        else:
            self.safe(cid, name, Severity.MEDIUM, desc, "IIS 로깅 활성화됨", rec)

    def _check_ssl_tls(self):
        cid, name = "WS-I-05", "취약한 SSL/TLS 프로토콜 사용 여부"
        desc = "SSLv3, TLS 1.0/1.1 사용 여부를 레지스트리에서 확인합니다."
        rec = "레지스트리에서 SSLv3/TLS1.0/1.1 비활성화, TLS 1.2/1.3 강제 사용"

        vulnerable_protocols = {
            "SSL 3.0": r"HKLM\SYSTEM\CurrentControlSet\Control\SecurityProviders\SCHANNEL\Protocols\SSL 3.0\Server",
            "TLS 1.0": r"HKLM\SYSTEM\CurrentControlSet\Control\SecurityProviders\SCHANNEL\Protocols\TLS 1.0\Server",
            "TLS 1.1": r"HKLM\SYSTEM\CurrentControlSet\Control\SecurityProviders\SCHANNEL\Protocols\TLS 1.1\Server",
        }
        found_issues = []
        for proto, reg_path in vulnerable_protocols.items():
            rc, out, _ = self._run_cmd(f'reg query "{reg_path}" /v Enabled')
            if rc == 0 and "0x1" in out.lower():
                found_issues.append(proto)

        if found_issues:
            self.vulnerable(cid, name, Severity.HIGH, desc,
                            f"취약 프로토콜 활성화: {', '.join(found_issues)}", rec)
        else:
            self.safe(cid, name, Severity.HIGH, desc,
                      "SSL 3.0 / TLS 1.0 / TLS 1.1 비활성화됨", rec)

    def _check_request_filtering(self):
        cid, name = "WS-I-06", "요청 필터링(Request Filtering) 설정"
        desc = "maxAllowedContentLength, maxUrl, maxQueryString 크기 제한 설정 여부를 확인합니다."
        rec = "requestFiltering에 적절한 크기 제한 설정 (예: maxAllowedContentLength='10485760')"

        rc, out, _ = self._run_ps(
            "Get-WebConfigurationProperty -Filter /system.webServer/security/requestFiltering/requestLimits "
            "-PSPath 'IIS:\\' -Name maxAllowedContentLength"
        )
        if rc != 0:
            self.manual(cid, name, Severity.MEDIUM, desc, "조회 실패 — 수동 점검 필요", rec)
            return
        try:
            size = int(out.strip())
            if size > 30 * 1024 * 1024:  # 30MB
                self.vulnerable(cid, name, Severity.MEDIUM, desc,
                                f"maxAllowedContentLength = {size} bytes (과도하게 큼)", rec, out)
            else:
                self.safe(cid, name, Severity.MEDIUM, desc,
                          f"maxAllowedContentLength = {size} bytes", rec)
        except ValueError:
            self.manual(cid, name, Severity.MEDIUM, desc, f"값 파싱 불가: {out}", rec)

    def _check_default_docs(self):
        cid, name = "WS-I-07", "불필요한 기본 문서(default document) 설정"
        desc = "iisstart.htm 등 IIS 기본 페이지가 노출되면 서버 식별이 가능합니다."
        rec = "기본 문서 목록에서 iisstart.htm, default.htm 등 제거"

        rc, out, _ = self._run_ps(
            "Get-WebConfigurationProperty -Filter /system.webServer/defaultDocument/files "
            "-PSPath 'IIS:\\' -Name . | Select-Object -ExpandProperty Collection | Select-Object value"
        )
        if rc != 0:
            self.manual(cid, name, Severity.LOW, desc, "조회 실패 — 수동 점검 필요", rec)
            return
        risky = [d for d in ["iisstart.htm", "iisstart.aspx"] if d.lower() in out.lower()]
        if risky:
            self.vulnerable(cid, name, Severity.LOW, desc,
                            f"IIS 기본 페이지 존재: {', '.join(risky)}", rec, out)
        else:
            self.safe(cid, name, Severity.LOW, desc, "IIS 기본 문서 정리됨", rec)
