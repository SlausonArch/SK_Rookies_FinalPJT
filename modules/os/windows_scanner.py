"""
OS - Windows 취약점 진단 모듈 (stub)
주요 점검 영역: 계정 정책, 레지스트리, 서비스, 네트워크, 감사 정책
"""
from core.base_scanner import BaseScanner
from core.result import ScanReport, Severity


class WindowsScanner(BaseScanner):
    CATEGORY = "OS-Windows"

    def run(self) -> ScanReport:
        print(f"\n[*] Windows 취약점 진단 시작 → {self.target}")
        self._check_guest_account()
        self._check_password_policy()
        self._check_audit_policy()
        self._check_rdp_nla()
        self._check_smb_signing()
        self._check_auto_run()
        self._check_windows_update()
        self.report.finish()
        return self.report

    def _check_guest_account(self):
        cid, name = "OS-W-01", "Guest 계정 비활성화 여부"
        desc = "Guest 계정이 활성화되어 있으면 인증 없이 시스템 접근이 가능합니다."
        rec = "net user guest /active:no 명령으로 Guest 계정 비활성화"

        rc, out, _ = self._run_cmd('net user guest')
        if rc != 0:
            self.error(cid, name, Severity.HIGH, desc, "net user 명령 실패", rec)
            return
        for line in out.splitlines():
            if "Account active" in line or "계정 활성" in line:
                active = "Yes" in line or "예" in line
                if active:
                    self.vulnerable(cid, name, Severity.HIGH, desc, "Guest 계정 활성화됨", rec, line)
                else:
                    self.safe(cid, name, Severity.HIGH, desc, "Guest 계정 비활성화됨", rec, line)
                return
        self.manual(cid, name, Severity.HIGH, desc, "Guest 계정 상태 확인 불가", rec, out)

    def _check_password_policy(self):
        cid, name = "OS-W-02", "패스워드 정책 (최소 길이, 복잡도)"
        desc = "로컬 보안 정책의 패스워드 최소 길이 및 복잡도 요구 설정을 확인합니다."
        rec = "최소 패스워드 길이 8자 이상, 복잡도 요구 사항 사용으로 설정"

        rc, out, _ = self._run_cmd('net accounts')
        if rc != 0:
            self.error(cid, name, Severity.HIGH, desc, "net accounts 명령 실패", rec)
            return
        min_len = None
        for line in out.splitlines():
            if "Minimum password length" in line or "최소 암호 길이" in line:
                parts = line.split(":")
                if len(parts) >= 2:
                    try:
                        min_len = int(parts[1].strip())
                    except ValueError:
                        pass
        if min_len is None:
            self.manual(cid, name, Severity.HIGH, desc, "정책 파싱 실패", rec, out)
        elif min_len < 8:
            self.vulnerable(cid, name, Severity.HIGH, desc,
                            f"최소 패스워드 길이: {min_len} (8 미만)", rec, out)
        else:
            self.safe(cid, name, Severity.HIGH, desc, f"최소 패스워드 길이: {min_len}", rec)

    def _check_audit_policy(self):
        cid, name = "OS-W-03", "감사 정책 (로그인 성공/실패 감사) 설정"
        desc = "로그인 성공 및 실패에 대한 감사 정책이 설정되어 있는지 확인합니다."
        rec = "auditpol /set /subcategory:'Logon' /success:enable /failure:enable"

        rc, out, _ = self._run_cmd('auditpol /get /subcategory:Logon')
        if rc != 0:
            self.manual(cid, name, Severity.MEDIUM, desc,
                        "auditpol 실행 실패 (관리자 권한 필요) — 수동 점검 필요", rec)
            return
        if "Success and Failure" in out or "성공 및 실패" in out:
            self.safe(cid, name, Severity.MEDIUM, desc, "로그인 성공/실패 감사 설정됨", rec, out)
        else:
            self.vulnerable(cid, name, Severity.MEDIUM, desc,
                            "로그인 감사 정책 미설정", rec, out)

    def _check_rdp_nla(self):
        cid, name = "OS-W-04", "RDP 네트워크 수준 인증(NLA) 설정"
        desc = "원격 데스크톱에 네트워크 수준 인증이 적용되어 있는지 확인합니다."
        rec = "레지스트리: UserAuthentication = 1 설정 또는 시스템 속성에서 NLA 활성화"

        rc, out, _ = self._run_cmd(
            r'reg query "HKLM\System\CurrentControlSet\Control\Terminal Server\WinStations\RDP-Tcp" /v UserAuthentication'
        )
        if rc != 0:
            self.manual(cid, name, Severity.HIGH, desc, "레지스트리 조회 실패 — 수동 점검 필요", rec)
            return
        if "0x1" in out or "1" in out:
            self.safe(cid, name, Severity.HIGH, desc, "NLA 활성화됨", rec, out)
        else:
            self.vulnerable(cid, name, Severity.HIGH, desc, "NLA 비활성화됨", rec, out)

    def _check_smb_signing(self):
        cid, name = "OS-W-05", "SMB 서명 설정 (서버)"
        desc = "SMB 서명이 활성화되어 있으면 중간자 공격(NTLM Relay 등)을 방지합니다."
        rec = "레지스트리: RequireSecuritySignature = 1 설정"

        rc, out, _ = self._run_cmd(
            r'reg query "HKLM\System\CurrentControlSet\Services\LanManServer\Parameters" /v RequireSecuritySignature'
        )
        if rc != 0:
            self.manual(cid, name, Severity.MEDIUM, desc, "레지스트리 조회 실패 — 수동 점검 필요", rec)
            return
        if "0x1" in out:
            self.safe(cid, name, Severity.MEDIUM, desc, "SMB 서명 필수 설정됨", rec, out)
        else:
            self.vulnerable(cid, name, Severity.MEDIUM, desc,
                            "SMB 서버 서명 미설정 (NTLM Relay 위험)", rec, out)

    def _check_auto_run(self):
        cid, name = "OS-W-06", "AutoRun/AutoPlay 비활성화 여부"
        desc = "이동식 미디어의 자동 실행 기능이 비활성화되어 있는지 확인합니다."
        rec = "레지스트리: NoDriveTypeAutoRun = 0xFF (255) 설정"

        rc, out, _ = self._run_cmd(
            r'reg query "HKLM\Software\Microsoft\Windows\CurrentVersion\Policies\Explorer" /v NoDriveTypeAutoRun'
        )
        if rc != 0:
            self.vulnerable(cid, name, Severity.MEDIUM, desc,
                            "NoDriveTypeAutoRun 미설정 (AutoRun 활성 가능)", rec)
            return
        if "0xff" in out.lower() or "0x91" in out.lower():
            self.safe(cid, name, Severity.MEDIUM, desc, "AutoRun 비활성화됨", rec, out)
        else:
            self.vulnerable(cid, name, Severity.MEDIUM, desc,
                            f"AutoRun 부분 허용 ({out.strip()})", rec, out)

    def _check_windows_update(self):
        cid, name = "OS-W-07", "Windows Update 자동 업데이트 설정"
        desc = "자동 업데이트가 구성되어 있는지 확인합니다."
        rec = "제어판 → Windows Update → 자동 업데이트 활성화"

        rc, out, _ = self._run_cmd(
            r'reg query "HKLM\Software\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update" /v AUOptions'
        )
        if rc != 0:
            self.manual(cid, name, Severity.MEDIUM, desc, "레지스트리 조회 실패 — 수동 점검 필요", rec)
            return
        # AUOptions: 2=알림만, 3=다운로드 후 알림, 4=자동 설치
        if "0x4" in out:
            self.safe(cid, name, Severity.MEDIUM, desc, "자동 업데이트(자동 설치) 설정됨", rec, out)
        elif "0x3" in out:
            self.safe(cid, name, Severity.MEDIUM, desc, "자동 다운로드 후 설치 알림 설정됨", rec, out)
        else:
            self.vulnerable(cid, name, Severity.MEDIUM, desc,
                            f"자동 업데이트 미흡 (AUOptions={out.strip()})", rec, out)
