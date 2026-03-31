"""
OS - Windows 취약점 진단 모듈
SK Shieldus 보안가이드라인 기반 (Windows Server 2019, 2022)

항목 구성
  1. 계정관리
     W-1.1  로컬 계정 사용 설정              (중요도: 상)
     W-1.2  계정 잠금 정책 설정              (중요도: 상)
     W-1.3  암호 정책 설정                   (중요도: 상)
     W-1.4  취약한 패스워드 점검             (중요도: 상)
     W-1.5  UAC 설정                         (중요도: 하)
     W-1.6  익명 SID/이름 변환 허용 정책     (중요도: 중)
     W-1.7  콘솔 로그온 빈 암호 사용 제한    (중요도: 중)
     W-1.8  관리자 그룹 최소 사용자 포함     (중요도: 상)
  2. 파일 시스템
     W-2.1  CMD.EXE 파일 권한 설정           (중요도: 중)
     W-2.2  사용자 홈 디렉터리 접근 제한     (중요도: 중)
     W-2.3  공유 폴더 설정                   (중요도: 상)
     W-2.4  SAM 파일 권한 설정               (중요도: 상)
     W-2.5  파일 및 디렉터리 보호            (중요도: 하) → N/A
  3. 네트워크 서비스
     W-3.1  불필요한 서비스 제거             (중요도: 상)
     W-3.2  터미널 서비스 암호화 수준        (중요도: 중)
     W-3.3  NetBIOS 서비스 보안 설정         (중요도: 상)
     W-3.4  터미널 서비스 Time Out 설정      (중요도: 중)
  4. 주요 응용 설정
     W-4.1  Telnet 서비스 보안 설정          (중요도: 중) → N/A
     W-4.2  DNS 보안 설정                    (중요도: 중)
     W-4.3  SNMP 서비스 보안 설정            (중요도: 상)
  5. 시스템 보안 설정
     W-5.1  원격 로그파일 접근 진단          (중요도: 하)
     W-5.2  화면 보호기 설정                 (중요도: 하)
     W-5.3  이벤트 뷰어 설정                 (중요도: 상)
     W-5.4  로그인 경고 메시지 표시          (중요도: 중)
     W-5.5  마지막 로그온 사용자 계정 숨김   (중요도: 중)
     W-5.6  로그온 없이 시스템 종료 방지     (중요도: 중)
     W-5.7  로컬 감사 정책 설정              (중요도: 상)
     W-5.8  가상 메모리 페이지 파일 삭제     (중요도: 하)
     W-5.9  LAN Manager 인증 수준            (중요도: 하)
     W-5.10 Everyone 익명 사용자 적용 안함   (중요도: 하)
     W-5.11 이동식 미디어 admin만 허용       (중요도: 하)
     W-5.12 세션 연결 끊기 전 유휴 시간      (중요도: 하)
     W-5.13 예약된 작업 점검                 (중요도: 중)
     W-5.14 원격 시스템 종료 권한 설정       (중요도: 상)
     W-5.15 보안 감사 로그 불가 시 종료 방지 (중요도: 상)
     W-5.16 보안 채널 데이터 암호화/서명     (중요도: 중)
  6. 바이러스 진단
     W-6.1  백신 프로그램 설치               (중요도: 중)
     W-6.2  최신 엔진 업데이트               (중요도: 중)
  7. 레지스트리 보안 설정
     W-7.1  SAM 보안 감사 설정               (중요도: 하)
     W-7.2  Null Session 설정                (중요도: 상)
     W-7.3  Remote Registry Service 설정     (중요도: 상)
     W-7.4  RDS 제거                         (중요도: 중) → N/A
     W-7.5  AutoLogon 제한 설정              (중요도: 중)
     W-7.6  DOS 방어 레지스트리              (중요도: 중) → N/A
  8. 보안 패치
     W-8.1  최신 서비스 팩 적용              (중요도: 상)
     W-8.2  최신 HOT FIX 적용               (중요도: 상)
  9. 이슈 취약점
     W-9.1  OpenSSL 취약점                   (중요도: 상)

원격 지원: SSH (OpenSSH on Windows) / AWS SSM (AWS-RunPowerShellScript)
"""
import re
from core.base_scanner import BaseScanner
from core.result import ScanReport, Severity

# 불필요한 서비스 목록 (spec 기반)
_UNNECESSARY_SERVICES = {
    "Alerter", "ClipSrv", "Browser", "Messenger",
    "NetDDE", "NetDDEdsdm", "Schedule",
    "SimpTcp", "Spooler", "TlntSvr",
}


class WindowsScanner(BaseScanner):
    CATEGORY = "OS-Windows"

    def __init__(self, target: str = "localhost", verbose: bool = False,
                 executor=None):
        super().__init__(target, verbose, executor)

    # ── PowerShell 실행 헬퍼 ─────────────────────────────────────

    def _ps(self, ps_cmd: str, timeout: int = 15) -> tuple[int, str, str]:
        """
        PowerShell 명령 실행.
        SSH(cmd.exe)/로컬 모두: powershell -Command "..." 래핑
        SSM Windows(AWS-RunPowerShellScript): 중첩 호출이지만 무해하게 동작
        """
        safe = ps_cmd.replace('"', '\\"')
        cmd = f'powershell -NoProfile -NonInteractive -Command "{safe}"'
        return self._run_shell(cmd, timeout)

    def _reg(self, key: str, value: str = "", timeout: int = 10) -> tuple[int, str, str]:
        """reg query 간편 래퍼"""
        qv = f" /v {value}" if value else ""
        return self._run_shell(f'reg query "{key}"{qv}', timeout)

    @staticmethod
    def _reg_val(output: str) -> str | None:
        """reg query 출력에서 값 파싱 (0x… or 숫자 or 문자열)"""
        for line in output.splitlines():
            parts = line.split()
            if len(parts) >= 3 and parts[1] in ("REG_DWORD", "REG_SZ", "REG_EXPAND_SZ"):
                return parts[-1].strip()
        return None

    # ── run ───────────────────────────────────────────────────────

    def run(self) -> ScanReport:
        print(f"\n[*] Windows 취약점 진단 시작 → {self.target}")
        print()

        print("  ─── 1. 계정관리 ─────────────────────────────────────")
        self._w11_local_accounts()
        self._w12_lockout_policy()
        self._w13_password_policy()
        self._w14_weak_password()
        self._w15_uac()
        self._w16_anon_sid()
        self._w17_blank_password_limit()
        self._w18_admin_group()

        print()
        print("  ─── 2. 파일 시스템 ──────────────────────────────────")
        self._w21_cmd_perm()
        self._w22_home_dir()
        self._w23_shared_folder()
        self._w24_sam_perm()
        self._w25_file_protect()

        print()
        print("  ─── 3. 네트워크 서비스 ──────────────────────────────")
        self._w31_unnecessary_services()
        self._w32_rdp_encrypt()
        self._w33_netbios()
        self._w34_rdp_timeout()

        print()
        print("  ─── 4. 주요 응용 설정 ───────────────────────────────")
        self._w41_telnet()
        self._w42_dns()
        self._w43_snmp()

        print()
        print("  ─── 5. 시스템 보안 설정 ─────────────────────────────")
        self._w51_remote_logfile()
        self._w52_screensaver()
        self._w53_eventlog()
        self._w54_logon_banner()
        self._w55_last_user_hide()
        self._w56_shutdown_without_logon()
        self._w57_audit_policy()
        self._w58_pagefile_clear()
        self._w59_lm_auth_level()
        self._w510_everyone_anon()
        self._w511_removable_media()
        self._w512_smb_idle()
        self._w513_scheduled_tasks()
        self._w514_remote_shutdown()
        self._w515_audit_crash()
        self._w516_secure_channel()

        print()
        print("  ─── 6. 바이러스 진단 ────────────────────────────────")
        self._w61_antivirus()
        self._w62_av_update()

        print()
        print("  ─── 7. 레지스트리 보안 설정 ─────────────────────────")
        self._w71_sam_audit()
        self._w72_null_session()
        self._w73_remote_registry()
        self._w74_rds()
        self._w75_autologon()
        self._w76_dos_registry()

        print()
        print("  ─── 8. 보안 패치 ────────────────────────────────────")
        self._w81_service_pack()
        self._w82_hotfix()

        print()
        print("  ─── 9. 이슈 취약점 ──────────────────────────────────")
        self._w91_openssl()

        self.report.finish()
        return self.report

    # ══════════════════════════════════════════════════════════════
    # 1. 계정관리
    # ══════════════════════════════════════════════════════════════

    def _w11_local_accounts(self):
        """1.1 로컬 계정 사용 설정"""
        cid, name = "W-1.1", "로컬 계정 사용 설정"
        desc = ("Administrator 이름 변경 여부, Guest 계정 비활성화, "
                "불필요한 계정 존재 여부 점검.")
        rec  = ("Administrator 계정명 변경, Guest 비활성화 "
                "(net user guest /active:no), 미사용 계정 삭제")

        cmd1 = "net user"
        _, out1, _ = self._run_shell(cmd1)

        cmd2 = "net user Administrator 2>nul"
        _, out2, _ = self._run_shell(cmd2)

        cmd3 = "net user guest 2>nul"
        _, out3, _ = self._run_shell(cmd3)

        cmd_str = f"{cmd1}\n{cmd2}\n{cmd3}"
        cmd_out  = f"[net user]\n{out1}\n\n[net user Administrator]\n{out2}\n\n[net user guest]\n{out3}"

        issues = []

        # Administrator 계정 이름 변경 여부 — "net user" 목록에 "Administrator" 존재 시 미변경
        users_lower = out1.lower()
        if "administrator" in users_lower:
            issues.append("Administrator 계정명 미변경 (기본 이름 그대로 사용)")

        # Guest 활성화 여부
        for line in out3.splitlines():
            if "account active" in line.lower() or "계정 활성" in line.lower():
                if "yes" in line.lower() or "예" in line.lower():
                    issues.append("Guest 계정 활성화됨")
                break

        if issues:
            self.vulnerable(cid, name, Severity.HIGH, desc,
                            "\n".join(issues), rec,
                            command=cmd_str, cmd_output=cmd_out,
                            evidence="\n".join(issues))
        else:
            self.safe(cid, name, Severity.HIGH, desc,
                      "Administrator 이름 변경됨, Guest 비활성화됨",
                      rec, command=cmd_str, cmd_output=cmd_out)

    def _w12_lockout_policy(self):
        """1.2 계정 잠금 정책 설정"""
        cid, name = "W-1.2", "계정 잠금 정책 설정"
        desc = ("계정 잠금 기간 30분 이상, 잠금 임계값 1~5번, "
                "잠금 카운터 재설정 시간 30분 이상 설정 여부 점검.")
        rec  = ("제어판 > 관리 도구 > 로컬 보안 정책 > 계정 잠금 정책 > "
                "잠금 기간 30분, 임계값 5번, 카운터 재설정 30분 설정")

        cmd = "net accounts"
        _, out, _ = self._run_shell(cmd)

        issues = []
        lockout_duration    = None
        lockout_threshold   = None
        lockout_observation = None

        for line in out.splitlines():
            ll = line.lower()
            if "lockout duration" in ll or "잠금 기간" in ll:
                m = re.search(r"(\d+)", line)
                if m:
                    lockout_duration = int(m.group(1))
            elif "lockout threshold" in ll or "잠금 임계" in ll:
                m = re.search(r"(\d+)", line)
                if m:
                    lockout_threshold = int(m.group(1))
            elif ("lockout observation" in ll or "잠금 카운터" in ll
                  or "재설정" in ll):
                m = re.search(r"(\d+)", line)
                if m:
                    lockout_observation = int(m.group(1))

        if lockout_duration is None:
            issues.append("계정 잠금 기간 파싱 불가")
        elif lockout_duration < 30:
            issues.append(f"계정 잠금 기간 {lockout_duration}분 (30분 미만)")

        if lockout_threshold is None:
            issues.append("계정 잠금 임계값 파싱 불가")
        elif lockout_threshold == 0 or lockout_threshold > 5:
            issues.append(f"계정 잠금 임계값 {lockout_threshold} (1~5 벗어남)")

        if lockout_observation is None:
            issues.append("잠금 카운터 재설정 시간 파싱 불가")
        elif lockout_observation < 30:
            issues.append(f"잠금 카운터 재설정 시간 {lockout_observation}분 (30분 미만)")

        if issues:
            self.vulnerable(cid, name, Severity.HIGH, desc,
                            "\n".join(issues), rec,
                            command=cmd, cmd_output=out, evidence=out)
        else:
            self.safe(cid, name, Severity.HIGH, desc,
                      f"잠금 기간={lockout_duration}분, 임계값={lockout_threshold}, "
                      f"재설정={lockout_observation}분",
                      rec, command=cmd, cmd_output=out)

    def _w13_password_policy(self):
        """1.3 암호 정책 설정"""
        cid, name = "W-1.3", "암호 정책 설정"
        desc = ("최소 암호 길이 8자↑, 최대 사용 기간 1~60일, 최소 사용 기간 7일↑, "
                "암호 기억 12개↑, 복잡성 사용, 해독 가능 암호화 사용 안 함.")
        rec  = ("로컬 보안 정책 > 계정 정책 > 암호 정책 설정 참고")

        cmd = "net accounts"
        _, out, _ = self._run_shell(cmd)

        issues = []
        min_len     = None
        max_age     = None
        min_age     = None
        history     = None

        for line in out.splitlines():
            ll = line.lower()
            if "minimum password length" in ll or "최소 암호 길이" in ll:
                m = re.search(r"(\d+)", line)
                if m:
                    min_len = int(m.group(1))
            elif "maximum password age" in ll or "최대 암호 사용 기간" in ll:
                m = re.search(r"(\d+)", line)
                if m:
                    max_age = int(m.group(1))
            elif "minimum password age" in ll or "최소 암호 사용 기간" in ll:
                m = re.search(r"(\d+)", line)
                if m:
                    min_age = int(m.group(1))
            elif "password uniqueness" in ll or "암호 기억" in ll or "uniqueness" in ll:
                m = re.search(r"(\d+)", line)
                if m:
                    history = int(m.group(1))

        if min_len is None:
            issues.append("최소 암호 길이 파싱 불가")
        elif min_len < 8:
            issues.append(f"최소 암호 길이 {min_len}자 (8자 미만)")

        if max_age is not None:
            if max_age == 0 or max_age > 60:
                issues.append(f"최대 암호 사용 기간 {max_age}일 (1~60일 벗어남)")
        else:
            issues.append("최대 암호 사용 기간 파싱 불가")

        if min_age is not None and min_age < 7:
            issues.append(f"최소 암호 사용 기간 {min_age}일 (7일 미만)")

        if history is not None and history < 12:
            issues.append(f"최근 암호 기억 {history}개 (12개 미만)")

        # 복잡성 및 해독 가능 암호화 — secedit export로 확인
        cmd2 = (r'cmd /c "secedit /export /cfg C:\Windows\Temp\wss.cfg /quiet'
                r' && type C:\Windows\Temp\wss.cfg"')
        _, out2, _ = self._run_shell(cmd2, timeout=20)

        complexity = None
        reversible = None
        for line in out2.splitlines():
            ll = line.strip().lower()
            if "passwordcomplexity" in ll:
                m = re.search(r"=\s*(\d+)", line)
                if m:
                    complexity = int(m.group(1))
            elif "cleartext" in ll or "reversibleencryption" in ll:
                m = re.search(r"=\s*(\d+)", line)
                if m:
                    reversible = int(m.group(1))

        if complexity == 0:
            issues.append("암호 복잡성 요구 사용 안 함 (사용으로 설정 필요)")
        if reversible == 1:
            issues.append("해독 가능한 암호화로 암호 저장 사용 중 (사용 안 함으로 설정 필요)")

        cmd_str = f"{cmd}\n{cmd2}"
        cmd_out  = f"[net accounts]\n{out}\n\n[secedit]\n{out2[:500]}"

        if issues:
            self.vulnerable(cid, name, Severity.HIGH, desc,
                            "\n".join(issues), rec,
                            command=cmd_str, cmd_output=cmd_out, evidence=cmd_out)
        else:
            self.safe(cid, name, Severity.HIGH, desc,
                      f"최소 길이={min_len}자, 최대 기간={max_age}일, "
                      f"복잡성=사용, 해독 가능 암호화=사용 안 함",
                      rec, command=cmd_str, cmd_output=cmd_out)

    def _w14_weak_password(self):
        """1.4 취약한 패스워드 점검"""
        cid, name = "W-1.4", "취약한 패스워드 점검"
        desc = ("계정과 유사하지 않은 8자 이상 영문/숫자/특수문자 조합 암호 "
                "설정 여부 점검.")
        rec  = ("영문/숫자/특수문자 2종 이상 조합 8자↑ 또는 조합 없이 10자↑. "
                "Null·계정명 동일·연속 문자 사용 금지.")

        self.manual(cid, name, Severity.HIGH, desc,
                    "계정별 암호 복잡성은 자동 점검 불가 — 계정 담당자 인터뷰 필요", rec)

    def _w15_uac(self):
        """1.5 사용자 계정 컨트롤(UAC) 설정"""
        cid, name = "W-1.5", "UAC(사용자 계정 컨트롤) 설정"
        desc = "UAC 활성화로 악성 소프트웨어의 권한 없는 시스템 변경을 방지."
        rec  = "제어판 > 사용자 계정 > UAC 설정 변경 > '앱에서 알림' 이상으로 설정"

        cmd = (r'reg query "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion'
               r'\Policies\System" /v EnableLUA')
        _, out, _ = self._run_shell(cmd)
        val = self._reg_val(out)

        if val is None:
            self.manual(cid, name, Severity.LOW, desc,
                        "EnableLUA 레지스트리 조회 실패 — 수동 점검 필요",
                        rec, command=cmd, cmd_output=out)
            return

        if val in ("0x1", "1"):
            self.safe(cid, name, Severity.LOW, desc,
                      "UAC 활성화됨 (EnableLUA=1)",
                      rec, command=cmd, cmd_output=out)
        else:
            self.vulnerable(cid, name, Severity.LOW, desc,
                            f"UAC 비활성화됨 (EnableLUA={val})",
                            rec, command=cmd, cmd_output=out,
                            evidence=f"EnableLUA={val}")

    def _w16_anon_sid(self):
        """1.6 익명 SID/이름 변환 허용 정책"""
        cid, name = "W-1.6", "익명 SID/이름 변환 허용 정책"
        desc = ("익명 SID/이름 변환 허용 시 공격자가 Administrator SID를 이용해 "
                "실제 이름을 알아내고 암호 추측 공격 가능.")
        rec  = ("SECPOL.MSC > 로컬 정책 > 보안 옵션 > "
                "'네트워크 액세스: 익명 SID/이름 변환 허용' → 사용 안 함")

        cmd = (r'reg query "HKLM\SYSTEM\CurrentControlSet\Control\Lsa" '
               r'/v LSAAnonymousNameLookup')
        _, out, _ = self._run_shell(cmd)
        val = self._reg_val(out)

        if val is None:
            # 값 없음 = 기본값 사용 안 함 → 양호
            self.safe(cid, name, Severity.MEDIUM, desc,
                      "LSAAnonymousNameLookup 미설정 (기본값: 사용 안 함)",
                      rec, command=cmd, cmd_output=out)
            return

        if val in ("0x0", "0"):
            self.safe(cid, name, Severity.MEDIUM, desc,
                      "익명 SID/이름 변환 사용 안 함 (LSAAnonymousNameLookup=0)",
                      rec, command=cmd, cmd_output=out)
        else:
            self.vulnerable(cid, name, Severity.MEDIUM, desc,
                            f"익명 SID/이름 변환 허용 (LSAAnonymousNameLookup={val})",
                            rec, command=cmd, cmd_output=out,
                            evidence=f"LSAAnonymousNameLookup={val}")

    def _w17_blank_password_limit(self):
        """1.7 콘솔 로그온 시 로컬 계정에서 빈 암호 사용 제한"""
        cid, name = "W-1.7", "콘솔 로그온 빈 암호 사용 제한"
        desc = ("빈 암호 사용 제한이 비활성화되면 암호 없는 로컬 계정으로 "
                "터미널 서비스 등 원격 로그온 가능.")
        rec  = ("SECPOL.MSC > 보안 옵션 > "
                "'콘솔 로그온 시 로컬 계정에서 빈 암호 사용 제한' → 사용")

        cmd = (r'reg query "HKLM\SYSTEM\CurrentControlSet\Control\Lsa" '
               r'/v LimitBlankPasswordUse')
        _, out, _ = self._run_shell(cmd)
        val = self._reg_val(out)

        if val is None:
            self.manual(cid, name, Severity.MEDIUM, desc,
                        "LimitBlankPasswordUse 조회 실패 — 수동 점검 필요",
                        rec, command=cmd, cmd_output=out)
            return

        if val in ("0x1", "1"):
            self.safe(cid, name, Severity.MEDIUM, desc,
                      "빈 암호 원격 로그온 제한 설정됨 (LimitBlankPasswordUse=1)",
                      rec, command=cmd, cmd_output=out)
        else:
            self.vulnerable(cid, name, Severity.MEDIUM, desc,
                            f"빈 암호 원격 로그온 제한 미설정 (LimitBlankPasswordUse={val})",
                            rec, command=cmd, cmd_output=out,
                            evidence=f"LimitBlankPasswordUse={val}")

    def _w18_admin_group(self):
        """1.8 관리자 그룹에 최소한의 사용자 포함"""
        cid, name = "W-1.8", "관리자 그룹 최소 사용자 포함"
        desc = ("Administrators 그룹에 불필요한 계정 포함 시 "
                "과도한 관리 권한 부여 위험.")
        rec  = ("net localgroup administrators [계정명] /del 로 "
                "불필요한 계정 제거")

        cmd = "net localgroup administrators"
        _, out, _ = self._run_shell(cmd)

        # 멤버 파싱 (헤더/푸터 제외)
        members = []
        in_members = False
        for line in out.splitlines():
            s = line.strip()
            if "---" in s:
                in_members = True
                continue
            if in_members and s and "명령" not in s and "command" not in s.lower():
                members.extend(s.split())

        if not out.strip():
            self.error(cid, name, Severity.HIGH, desc,
                       "net localgroup 명령 실패 — 관리자 권한 필요",
                       rec, command=cmd, cmd_output=out)
            return

        count = len(members)
        if count > 2:
            self.vulnerable(cid, name, Severity.HIGH, desc,
                            f"Administrators 그룹 구성원 {count}명: {', '.join(members)}",
                            rec, command=cmd, cmd_output=out,
                            evidence=f"구성원: {', '.join(members)}")
        else:
            self.safe(cid, name, Severity.HIGH, desc,
                      f"Administrators 그룹 구성원 {count}명: {', '.join(members)}",
                      rec, command=cmd, cmd_output=out)

    # ══════════════════════════════════════════════════════════════
    # 2. 파일 시스템
    # ══════════════════════════════════════════════════════════════

    def _w21_cmd_perm(self):
        """2.1 CMD.EXE 파일 권한 설정"""
        cid, name = "W-2.1", "CMD.EXE 파일 권한 설정"
        desc = ("IIS 실행 중이며 CMD.EXE에 Administrators·System·TrustedInstaller 외 "
                "실행 권한이 설정된 경우 공격자가 임의 명령 실행 가능.")
        rec  = ("icacls C:\\Windows\\System32\\cmd.exe /reset 후 "
                "Administrators, SYSTEM, TrustedInstaller 권한만 허용")

        cmd1 = "sc query W3SVC"
        _, out1, _ = self._run_shell(cmd1)
        iis_running = "RUNNING" in out1.upper()

        cmd2 = r"icacls C:\Windows\System32\cmd.exe"
        _, out2, _ = self._run_shell(cmd2)

        cmd_str = f"{cmd1}\n{cmd2}"
        cmd_out  = f"[IIS 상태]\n{out1}\n\n[cmd.exe ACL]\n{out2}"

        if not iis_running:
            self.safe(cid, name, Severity.MEDIUM, desc,
                      "IIS 서비스 미실행 — N/A",
                      rec, command=cmd_str, cmd_output=cmd_out)
            return

        # 허용 계정 외 권한 존재 여부
        allowed = {"nt service\\trustedinstaller", "nt authority\\system",
                   "builtin\\administrators", "administrators",
                   "trustedinstaller", "system"}
        extra = []
        for line in out2.splitlines():
            if not line.strip() or "성공적으로" in line or "successfully" in line.lower():
                continue
            # icacls 출력 형식: C:\path ACCOUNT:(perm)
            m = re.search(r"([\w\\ ]+):\(([^)]+)\)", line)
            if m:
                acct = m.group(1).strip().lower()
                perm = m.group(2)
                if "x" in perm.lower() and acct not in allowed:
                    extra.append(f"{acct}:({perm})")

        if extra:
            self.vulnerable(cid, name, Severity.MEDIUM, desc,
                            f"IIS 실행 중, CMD.EXE 추가 실행 권한: {', '.join(extra)}",
                            rec, command=cmd_str, cmd_output=cmd_out,
                            evidence=", ".join(extra))
        else:
            self.safe(cid, name, Severity.MEDIUM, desc,
                      "IIS 실행 중이나 CMD.EXE 권한 양호",
                      rec, command=cmd_str, cmd_output=cmd_out)

    def _w22_home_dir(self):
        """2.2 사용자 홈 디렉터리 접근 제한"""
        cid, name = "W-2.2", "사용자 홈 디렉터리 접근 제한"
        desc = "홈 디렉터리 권한 중 Users:F 또는 Everyone:F 존재 시 임의 접근 가능."
        rec  = "icacls C:\\Users\\[계정명] 에서 Users:F / Everyone:F 제거"

        cmd = r"icacls C:\Users"
        _, out, _ = self._run_shell(cmd)

        issues = []
        for line in out.splitlines():
            ll = line.lower()
            if ("users:(f)" in ll or "everyone:(f)" in ll
                    or "users:(oi)(ci)(f)" in ll or "everyone:(oi)(ci)(f)" in ll):
                issues.append(line.strip())

        if issues:
            self.vulnerable(cid, name, Severity.MEDIUM, desc,
                            f"Users/Everyone Full Control 발견:\n" + "\n".join(issues),
                            rec, command=cmd, cmd_output=out,
                            evidence="\n".join(issues))
        else:
            self.safe(cid, name, Severity.MEDIUM, desc,
                      "Users/Everyone Full Control 없음",
                      rec, command=cmd, cmd_output=out)

    def _w23_shared_folder(self):
        """2.3 공유 폴더 설정"""
        cid, name = "W-2.3", "공유 폴더 설정"
        desc = ("기본 공유(C$, Admin$, IPC$ 등) 또는 일반 공유에 "
                "Everyone 접근 허용 시 익명 자원 접근 위험.")
        rec  = ("net share [공유명] /delete 로 불필요 공유 제거, "
                "AutoShareServer=0 설정, 공유 폴더 사용 시 Everyone 제거")

        cmd1 = "net share"
        _, out1, _ = self._run_shell(cmd1)

        cmd2 = (r'reg query "HKLM\SYSTEM\CurrentControlSet\Services\LanmanServer\Parameters"'
                r' /v AutoShareServer')
        _, out2, _ = self._run_shell(cmd2)

        cmd_str = f"{cmd1}\n{cmd2}"
        cmd_out  = f"[net share]\n{out1}\n\n[AutoShareServer]\n{out2}"

        issues = []

        # AutoShareServer 확인
        val = self._reg_val(out2)
        if val not in ("0x0", "0"):
            issues.append(f"AutoShareServer={val or '미설정'} (0으로 설정 필요)")

        # Everyone 공유 권한 확인 (각 공유별 icacls)
        share_names = []
        for line in out1.splitlines():
            parts = line.split()
            if parts and not any(h in line for h in ("공유 이름", "Share name", "---", "명령이")):
                share_names.append(parts[0])

        for share in share_names[:5]:  # 성능상 5개만
            _, acl_out, _ = self._run_shell(f"net share {share}", timeout=5)
            if "everyone" in acl_out.lower() and "full" in acl_out.lower():
                issues.append(f"공유 '{share}'에 Everyone Full Access 설정")

        if issues:
            self.vulnerable(cid, name, Severity.HIGH, desc,
                            "\n".join(issues), rec,
                            command=cmd_str, cmd_output=cmd_out,
                            evidence="\n".join(issues))
        else:
            self.safe(cid, name, Severity.HIGH, desc,
                      "공유 폴더 설정 양호 (AutoShareServer=0, Everyone 없음)",
                      rec, command=cmd_str, cmd_output=cmd_out)

    def _w24_sam_perm(self):
        """2.4 SAM 파일 권한 설정"""
        cid, name = "W-2.4", "SAM 파일 권한 설정"
        desc = ("SAM 파일에 Administrators/SYSTEM 외 그룹 접근 권한 존재 시 "
                "패스워드 데이터베이스 노출 위험.")
        rec  = ("icacls C:\\Windows\\System32\\config\\SAM 에서 "
                "Administrators, SYSTEM 외 모든 권한 제거")

        cmd = r"icacls C:\Windows\System32\config\SAM"
        _, out, _ = self._run_shell(cmd)

        if not out.strip():
            self.error(cid, name, Severity.HIGH, desc,
                       "SAM 파일 ACL 조회 실패 — 관리자 권한 필요",
                       rec, command=cmd, cmd_output=out)
            return

        allowed = {"nt authority\\system", "builtin\\administrators",
                   "system", "administrators"}
        extra = []
        for line in out.splitlines():
            if not line.strip() or "성공" in line or "successfully" in line.lower():
                continue
            m = re.search(r"([\w\\ ]+):\(([^)]+)\)", line)
            if m:
                acct = m.group(1).strip().lower()
                if acct not in allowed:
                    extra.append(f"{acct}:({m.group(2)})")

        if extra:
            self.vulnerable(cid, name, Severity.HIGH, desc,
                            f"SAM 파일에 비인가 권한: {', '.join(extra)}",
                            rec, command=cmd, cmd_output=out,
                            evidence=", ".join(extra))
        else:
            self.safe(cid, name, Severity.HIGH, desc,
                      "SAM 파일 접근 권한 양호 (Administrators, SYSTEM만 허용)",
                      rec, command=cmd, cmd_output=out)

    def _w25_file_protect(self):
        """2.5 파일 및 디렉터리 보호"""
        cid, name = "W-2.5", "파일 및 디렉터리 보호"
        desc = "NTFS 파일 시스템 사용 여부 점검."
        rec  = "해당 OS는 체크리스트에 포함하지 않음"
        self.skipped(cid, name, Severity.LOW, desc,
                     "N/A — 해당 OS는 체크리스트에 포함하지 않음", rec)

    # ══════════════════════════════════════════════════════════════
    # 3. 네트워크 서비스
    # ══════════════════════════════════════════════════════════════

    def _w31_unnecessary_services(self):
        """3.1 불필요한 서비스 제거"""
        cid, name = "W-3.1", "불필요한 서비스 제거"
        desc = "불필요한 서비스 실행 시 해킹 침입 경로 및 자원 낭비 발생."
        rec  = "제어판 > 관리 도구 > 서비스 > 불필요 서비스 중지 및 '사용 안 함' 설정"

        cmd = "sc query type= all state= all"
        _, out, _ = self._run_shell(cmd)

        found = []
        current_svc = None
        for line in out.splitlines():
            if line.startswith("SERVICE_NAME:"):
                current_svc = line.split(":", 1)[1].strip()
            if current_svc and "STATE" in line and "RUNNING" in line:
                if current_svc in _UNNECESSARY_SERVICES:
                    found.append(current_svc)
                current_svc = None

        if found:
            self.vulnerable(cid, name, Severity.HIGH, desc,
                            f"불필요 서비스 실행 중: {', '.join(found)}",
                            rec, command=cmd, cmd_output=out[:500],
                            evidence=", ".join(found))
        else:
            self.safe(cid, name, Severity.HIGH, desc,
                      "불필요 서비스 미실행",
                      rec, command=cmd, cmd_output=out[:300])

    def _w32_rdp_encrypt(self):
        """3.2 터미널 서비스 암호화 수준 설정"""
        cid, name = "W-3.2", "터미널 서비스 암호화 수준 설정"
        desc = ("RDP 암호화 수준이 낮음(1)으로 설정된 경우 "
                "네트워크 스니핑에 취약.")
        rec  = ("gpedit.msc > 원격 데스크톱 세션 호스트 > 보안 > "
                "클라이언트 연결 암호화 수준 → '클라이언트 호환 가능' 이상")

        cmd = (r'reg query "HKLM\SYSTEM\CurrentControlSet\Control\Terminal Server'
               r'\WinStations\RDP-Tcp" /v MinEncryptionLevel')
        _, out, _ = self._run_shell(cmd)

        val = self._reg_val(out)

        if val is None:
            self.safe(cid, name, Severity.MEDIUM, desc,
                      "MinEncryptionLevel 미설정 (기본값 이상)",
                      rec, command=cmd, cmd_output=out)
            return

        try:
            level = int(val, 16) if val.startswith("0x") else int(val)
        except ValueError:
            self.manual(cid, name, Severity.MEDIUM, desc,
                        f"값 파싱 실패: {val}", rec, command=cmd, cmd_output=out)
            return

        labels = {1: "낮음", 2: "클라이언트 호환", 3: "높음", 4: "FIPS 규격"}
        label = labels.get(level, str(level))

        if level == 1:
            self.vulnerable(cid, name, Severity.MEDIUM, desc,
                            f"터미널 서비스 암호화 수준 = {label}(1) — 취약",
                            rec, command=cmd, cmd_output=out,
                            evidence=f"MinEncryptionLevel={level}")
        else:
            self.safe(cid, name, Severity.MEDIUM, desc,
                      f"터미널 서비스 암호화 수준 = {label}({level})",
                      rec, command=cmd, cmd_output=out)

    def _w33_netbios(self):
        """3.3 NetBIOS 서비스 보안 설정"""
        cid, name = "W-3.3", "NetBIOS 서비스 보안 설정"
        desc = ("NetBIOS over TCP/IP 활성화 시 파일 공유 등을 통해 "
                "공격자가 파일시스템 접근 가능.")
        rec  = ("네트워크 어댑터 속성 > TCP/IP > 고급 > WINS 탭 > "
                "'TCP/IP에서 NetBIOS 사용 안 함' 선택")

        cmd = (r'reg query "HKLM\SYSTEM\CurrentControlSet\Services\NetBT\Parameters" '
               r'/v NetbiosOptions')
        _, out, _ = self._run_shell(cmd)
        val = self._reg_val(out)

        # 0x2 = 사용 안 함(disabled)
        if val in ("0x2", "2"):
            self.safe(cid, name, Severity.HIGH, desc,
                      "NetBIOS over TCP/IP 사용 안 함 (NetbiosOptions=2)",
                      rec, command=cmd, cmd_output=out)
        elif val in ("0x1", "1"):
            self.safe(cid, name, Severity.HIGH, desc,
                      "NetBIOS over TCP/IP 활성화(DHCP 옵션 사용) — 환경 확인 필요",
                      rec, command=cmd, cmd_output=out)
        else:
            self.vulnerable(cid, name, Severity.HIGH, desc,
                            f"NetBIOS over TCP/IP 활성화 (NetbiosOptions={val or '0/기본값'})",
                            rec, command=cmd, cmd_output=out,
                            evidence=f"NetbiosOptions={val or '0(기본값 활성화)'}")

    def _w34_rdp_timeout(self):
        """3.4 터미널 서비스 Time Out 설정"""
        cid, name = "W-3.4", "터미널 서비스 Time Out 설정"
        desc = ("유휴 터미널 세션 타임아웃 미설정 시 비인가 접근 위험.")
        rec  = ("gpedit.msc > 원격 데스크톱 세션 호스트 > 세션 시간 제한 > "
                "활성 유휴 세션 시간 제한 → 5분(300000ms)")

        cmd = (r'reg query "HKLM\SOFTWARE\Policies\Microsoft\Windows NT'
               r'\Terminal Services" /v MaxIdleTime')
        _, out, _ = self._run_shell(cmd)
        val = self._reg_val(out)

        if val is None:
            self.vulnerable(cid, name, Severity.MEDIUM, desc,
                            "MaxIdleTime 미설정 — 유휴 세션 타임아웃 없음",
                            rec, command=cmd, cmd_output=out)
            return

        try:
            ms = int(val, 16) if val.startswith("0x") else int(val)
        except ValueError:
            self.manual(cid, name, Severity.MEDIUM, desc,
                        f"값 파싱 실패: {val}", rec, command=cmd, cmd_output=out)
            return

        minutes = ms // 60000
        if ms == 0:
            self.vulnerable(cid, name, Severity.MEDIUM, desc,
                            "MaxIdleTime=0 — 타임아웃 없음",
                            rec, command=cmd, cmd_output=out,
                            evidence="MaxIdleTime=0(무제한)")
        elif minutes <= 5:
            self.safe(cid, name, Severity.MEDIUM, desc,
                      f"유휴 세션 타임아웃 {minutes}분 (5분 이하)",
                      rec, command=cmd, cmd_output=out)
        else:
            self.vulnerable(cid, name, Severity.MEDIUM, desc,
                            f"유휴 세션 타임아웃 {minutes}분 (5분 초과)",
                            rec, command=cmd, cmd_output=out,
                            evidence=f"MaxIdleTime={ms}ms({minutes}분)")

    # ══════════════════════════════════════════════════════════════
    # 4. 주요 응용 설정
    # ══════════════════════════════════════════════════════════════

    def _w41_telnet(self):
        """4.1 Telnet 서비스 보안 설정"""
        cid, name = "W-4.1", "Telnet 서비스 보안 설정"
        self.skipped(cid, name, Severity.MEDIUM,
                     "Telnet 서비스 보안 설정.",
                     "N/A — 해당 OS는 체크리스트에 포함하지 않음",
                     "해당 OS는 체크리스트에 포함하지 않음")

    def _w42_dns(self):
        """4.2 DNS 보안 설정"""
        cid, name = "W-4.2", "DNS 보안 설정"
        desc = ("DNS 영역 전송을 아무 서버에나 허용하면 "
                "도메인 정보 유출 위험.")
        rec  = ("DNS 관리자 > 영역 전송 탭 > '특정 서버로만' 설정 또는 DNS 서비스 중지")

        cmd = "sc query DNS"
        _, out, _ = self._run_shell(cmd)

        if "RUNNING" not in out.upper():
            self.safe(cid, name, Severity.MEDIUM, desc,
                      "DNS 서비스 미실행",
                      rec, command=cmd, cmd_output=out)
            return

        self.manual(cid, name, Severity.MEDIUM, desc,
                    "DNS 서비스 실행 중 — DNS 관리자에서 영역 전송 설정 수동 확인 필요",
                    rec, command=cmd, cmd_output=out)

    def _w43_snmp(self):
        """4.3 SNMP 서비스 보안 설정"""
        cid, name = "W-4.3", "SNMP 서비스 보안 설정"
        desc = ("SNMP Community String이 public/private 기본값이면 "
                "비인가 사용자가 시스템 정보 획득 가능.")
        rec  = ("SNMP Service > 속성 > 보안 탭 > Community 이름을 "
                "8자↑ 숫자·문자·기호 혼합 강력 패스워드로 변경. 불필요 시 서비스 제거.")

        cmd1 = "sc query SNMP"
        _, out1, _ = self._run_shell(cmd1)

        if "RUNNING" not in out1.upper():
            self.safe(cid, name, Severity.HIGH, desc,
                      "SNMP 서비스 미실행",
                      rec, command=cmd1, cmd_output=out1)
            return

        cmd2 = (r'reg query "HKLM\SYSTEM\CurrentControlSet\Services\SNMP'
                r'\Parameters\ValidCommunities"')
        _, out2, _ = self._run_shell(cmd2)

        cmd_str = f"{cmd1}\n{cmd2}"
        cmd_out  = f"[SNMP 서비스]\n{out1}\n\n[Community Strings]\n{out2}"

        communities = []
        for line in out2.splitlines():
            parts = line.split()
            if len(parts) >= 3 and parts[1] == "REG_DWORD":
                communities.append(parts[0].strip())

        weak = [c for c in communities if c.lower() in ("public", "private")]

        if weak:
            self.vulnerable(cid, name, Severity.HIGH, desc,
                            f"취약 Community String 사용: {', '.join(weak)}",
                            rec, command=cmd_str, cmd_output=cmd_out,
                            evidence=", ".join(weak))
        else:
            self.safe(cid, name, Severity.HIGH, desc,
                      f"SNMP Community String 양호: {', '.join(communities) or '(없음)'}",
                      rec, command=cmd_str, cmd_output=cmd_out)

    # ══════════════════════════════════════════════════════════════
    # 5. 시스템 보안 설정
    # ══════════════════════════════════════════════════════════════

    def _w51_remote_logfile(self):
        """5.1 원격 로그파일 접근 진단"""
        cid, name = "W-5.1", "원격 로그파일 접근 진단"
        desc = ("시스템/앱 로그 디렉터리에 Users/Everyone 수정·쓰기 권한 존재 시 "
                "보안 감사 정보 변조·삭제·유출 위험.")
        rec  = (r"icacls C:\Windows\System32\config 에서 "
                "Users/Everyone 수정·쓰기 권한 제거")

        paths = [r"C:\Windows\System32\config",
                 r"C:\Windows\System32\LogFiles"]
        issues = []
        cmd_parts = []
        out_parts = []

        for path in paths:
            cmd = f'icacls "{path}"'
            cmd_parts.append(cmd)
            _, out, _ = self._run_shell(cmd)
            out_parts.append(f"[{path}]\n{out}")
            for line in out.splitlines():
                ll = line.lower()
                if ("users:" in ll or "everyone:" in ll) and any(
                        p in ll for p in ("(m)", "(w)", "(f)", "(oi)(ci)(m)", "(oi)(ci)(f)")):
                    issues.append(line.strip())

        cmd_str = "\n".join(cmd_parts)
        cmd_out  = "\n\n".join(out_parts)

        if issues:
            self.vulnerable(cid, name, Severity.LOW, desc,
                            "Users/Everyone 쓰기 권한 발견:\n" + "\n".join(issues),
                            rec, command=cmd_str, cmd_output=cmd_out,
                            evidence="\n".join(issues))
        else:
            self.safe(cid, name, Severity.LOW, desc,
                      "로그 디렉터리 Users/Everyone 쓰기 권한 없음",
                      rec, command=cmd_str, cmd_output=cmd_out)

    def _w52_screensaver(self):
        """5.2 화면 보호기 설정"""
        cid, name = "W-5.2", "화면 보호기 설정"
        desc = ("화면 보호기 미설정 시 자리 이탈 중 정보 유출 가능.")
        rec  = ("설정 > 개인 설정 > 잠금 화면 > 화면 보호기 설정 > "
                "화면 보호기 사용, 암호 사용, 대기 5분 설정")

        cmd = r'reg query "HKCU\Control Panel\Desktop" /v ScreenSaveActive'
        _, out1, _ = self._run_shell(cmd)

        cmd2 = r'reg query "HKCU\Control Panel\Desktop" /v ScreenSaverIsSecure'
        _, out2, _ = self._run_shell(cmd2)

        cmd3 = r'reg query "HKCU\Control Panel\Desktop" /v ScreenSaveTimeOut'
        _, out3, _ = self._run_shell(cmd3)

        cmd_str = f"{cmd}\n{cmd2}\n{cmd3}"
        cmd_out  = f"{out1}\n{out2}\n{out3}"

        active  = self._reg_val(out1)
        secure  = self._reg_val(out2)
        timeout = self._reg_val(out3)

        issues = []
        if active not in ("1", "0x1"):
            issues.append(f"화면 보호기 미활성화 (ScreenSaveActive={active})")
        if secure not in ("1", "0x1"):
            issues.append(f"암호 보호 미설정 (ScreenSaverIsSecure={secure})")
        if timeout:
            try:
                secs = int(timeout, 16) if timeout.startswith("0x") else int(timeout)
                if secs > 300:
                    issues.append(f"대기 시간 {secs//60}분 (5분 초과)")
            except ValueError:
                pass

        if issues:
            self.vulnerable(cid, name, Severity.LOW, desc,
                            "\n".join(issues), rec,
                            command=cmd_str, cmd_output=cmd_out,
                            evidence="\n".join(issues))
        else:
            self.safe(cid, name, Severity.LOW, desc,
                      "화면 보호기 활성화, 암호 보호 설정, 대기 5분 이하",
                      rec, command=cmd_str, cmd_output=cmd_out)

    def _w53_eventlog(self):
        """5.3 이벤트 뷰어 설정"""
        cid, name = "W-5.3", "이벤트 뷰어 설정"
        desc = ("이벤트 로그 최대 크기 10240KB 이상, "
                "'필요한 경우 이벤트 덮어쓰기' 설정 여부 점검.")
        rec  = ("wevtutil sl Application /ms:10485760 /rt:false && "
                "wevtutil sl Security /ms:10485760 /rt:false && "
                "wevtutil sl System /ms:10485760 /rt:false")

        issues = []
        logs = ["Application", "Security", "System"]
        out_parts = []
        cmd_parts = []

        for log in logs:
            cmd = f"wevtutil gl {log}"
            cmd_parts.append(cmd)
            _, out, _ = self._run_shell(cmd)
            out_parts.append(f"[{log}]\n{out}")

            max_size = None
            retention = None
            for line in out.splitlines():
                ll = line.strip().lower()
                if "maxsize:" in ll or "maximumkilobytes" in ll:
                    m = re.search(r":\s*(\d+)", line)
                    if m:
                        max_size = int(m.group(1))
                if "retentiondays:" in ll or "retention:" in ll:
                    retention = line.split(":", 1)[-1].strip().lower()

            if max_size is not None and max_size < 10240 * 1024:
                issues.append(f"{log}: 최대 크기 {max_size//1024}KB (10240KB 미만)")
            if retention and "true" in retention:
                issues.append(f"{log}: 이벤트 덮어쓰기 비활성화됨")

        cmd_str = "\n".join(cmd_parts)
        cmd_out  = "\n\n".join(out_parts)

        if issues:
            self.vulnerable(cid, name, Severity.HIGH, desc,
                            "\n".join(issues), rec,
                            command=cmd_str, cmd_output=cmd_out,
                            evidence="\n".join(issues))
        else:
            self.safe(cid, name, Severity.HIGH, desc,
                      "이벤트 로그 크기·덮어쓰기 설정 양호",
                      rec, command=cmd_str, cmd_output=cmd_out)

    def _w54_logon_banner(self):
        """5.4 로그인 시 경고 메시지 표시 설정"""
        cid, name = "W-5.4", "로그인 경고 메시지 표시 설정"
        desc = "로그인 경고 메시지 미설정 시 불법 사용 억제 효과 없음."
        rec  = (r"reg add HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System "
                r'/v LegalNoticeCaption /t REG_SZ /d "경고"')

        key = r"HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System"
        cmd = f'reg query "{key}" /v LegalNoticeCaption'
        _, out, _ = self._run_shell(cmd)
        val = self._reg_val(out)

        if val and val.strip():
            self.safe(cid, name, Severity.MEDIUM, desc,
                      f"로그인 경고 메시지 제목 설정됨: {val}",
                      rec, command=cmd, cmd_output=out)
        else:
            self.vulnerable(cid, name, Severity.MEDIUM, desc,
                            "LegalNoticeCaption 미설정 — 로그인 경고 메시지 없음",
                            rec, command=cmd, cmd_output=out,
                            evidence="LegalNoticeCaption 값 없음")

    def _w55_last_user_hide(self):
        """5.5 마지막 로그온 사용자 계정 숨김"""
        cid, name = "W-5.5", "마지막 로그온 사용자 계정 숨김"
        desc = "로그인 화면에 마지막 로그온 계정 표시 시 공격자가 계정명 확인 가능."
        rec  = (r"reg add HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System "
                r"/v DontDisplayLastUserName /t REG_DWORD /d 1")

        key = r"HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System"
        cmd = f'reg query "{key}" /v DontDisplayLastUserName'
        _, out, _ = self._run_shell(cmd)
        val = self._reg_val(out)

        if val in ("0x1", "1"):
            self.safe(cid, name, Severity.MEDIUM, desc,
                      "DontDisplayLastUserName=1 — 마지막 계정 숨김",
                      rec, command=cmd, cmd_output=out)
        else:
            self.vulnerable(cid, name, Severity.MEDIUM, desc,
                            f"DontDisplayLastUserName={val or '미설정'} — 마지막 계정 표시됨",
                            rec, command=cmd, cmd_output=out,
                            evidence=f"DontDisplayLastUserName={val or '미설정(0)'}")

    def _w56_shutdown_without_logon(self):
        """5.6 로그온 하지 않은 사용자 시스템 종료 방지"""
        cid, name = "W-5.6", "로그온 없이 시스템 종료 방지"
        desc = "로그온 화면에서 시스템 종료 버튼 활성화 시 비인가 시스템 다운 가능."
        rec  = (r"reg add HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System "
                r"/v ShutdownWithoutLogon /t REG_DWORD /d 0")

        key = r"HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System"
        cmd = f'reg query "{key}" /v ShutdownWithoutLogon'
        _, out, _ = self._run_shell(cmd)
        val = self._reg_val(out)

        if val in ("0x0", "0"):
            self.safe(cid, name, Severity.MEDIUM, desc,
                      "ShutdownWithoutLogon=0 — 비인가 종료 불가",
                      rec, command=cmd, cmd_output=out)
        else:
            self.vulnerable(cid, name, Severity.MEDIUM, desc,
                            f"ShutdownWithoutLogon={val or '미설정(1)'} — 로그온 없이 종료 가능",
                            rec, command=cmd, cmd_output=out,
                            evidence=f"ShutdownWithoutLogon={val or '미설정'}")

    def _w57_audit_policy(self):
        """5.7 로컬 감사 정책 설정"""
        cid, name = "W-5.7", "로컬 감사 정책 설정"
        desc = ("개체 액세스, 계정 관리, 계정 로그온 이벤트, "
                "권한 사용, 로그온 이벤트 감사 성공|실패 설정 여부 점검.")
        rec  = ("auditpol /set /subcategory:'Logon' /success:enable /failure:enable "
                "등 필수 감사 항목 모두 '성공 및 실패' 설정")

        cmd = "auditpol /get /category:*"
        _, out, _ = self._run_shell(cmd)

        if not out.strip():
            self.manual(cid, name, Severity.HIGH, desc,
                        "auditpol 실행 실패 — 관리자 권한 필요, 수동 점검 필요",
                        rec, command=cmd, cmd_output=out)
            return

        required = {
            "object access": False,
            "account management": False,
            "account logon": False,
            "privilege use": False,
            "logon": False,
        }
        for line in out.splitlines():
            ll = line.lower()
            for key in required:
                if key in ll and ("success and failure" in ll
                                  or "성공 및 실패" in ll):
                    required[key] = True

        missing = [k for k, v in required.items() if not v]

        if missing:
            self.vulnerable(cid, name, Severity.HIGH, desc,
                            f"'성공|실패' 미설정 감사 항목: {', '.join(missing)}",
                            rec, command=cmd, cmd_output=out[:500],
                            evidence=", ".join(missing))
        else:
            self.safe(cid, name, Severity.HIGH, desc,
                      "필수 감사 항목 모두 '성공 및 실패' 설정됨",
                      rec, command=cmd, cmd_output=out[:300])

    def _w58_pagefile_clear(self):
        """5.8 가상 메모리 페이지 파일 삭제 설정"""
        cid, name = "W-5.8", "가상 메모리 페이지 파일 삭제 설정"
        desc = ("종료 시 페이지 파일(Pagefile) 미삭제 시 "
                "암호 등 민감 정보 노출 위험.")
        rec  = (r"reg add HKLM\SYSTEM\CurrentControlSet\Control\Session Manager"
                r"\Memory Management /v ClearPageFileAtShutdown /t REG_DWORD /d 1")

        cmd = (r'reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager'
               r'\Memory Management" /v ClearPageFileAtShutdown')
        _, out, _ = self._run_shell(cmd)
        val = self._reg_val(out)

        if val in ("0x1", "1"):
            self.safe(cid, name, Severity.LOW, desc,
                      "ClearPageFileAtShutdown=1 — 종료 시 페이지 파일 삭제",
                      rec, command=cmd, cmd_output=out)
        else:
            self.vulnerable(cid, name, Severity.LOW, desc,
                            f"ClearPageFileAtShutdown={val or '미설정(0)'} — 페이지 파일 유지",
                            rec, command=cmd, cmd_output=out,
                            evidence=f"ClearPageFileAtShutdown={val or '0'}")

    def _w59_lm_auth_level(self):
        """5.9 LAN Manager 인증 수준"""
        cid, name = "W-5.9", "LAN Manager 인증 수준"
        desc = "LM/NTLM 인증 허용 시 해시 캡처 공격에 취약. NTLMv2 전용 설정 필요."
        rec  = (r"SECPOL.MSC > 네트워크 보안: LAN Manager 인증 수준 > "
                "'NTLMv2 응답만 보냄' 설정")

        cmd = (r'reg query "HKLM\SYSTEM\CurrentControlSet\Control\Lsa" '
               r'/v LmCompatibilityLevel')
        _, out, _ = self._run_shell(cmd)
        val = self._reg_val(out)

        level = None
        if val:
            try:
                level = int(val, 16) if val.startswith("0x") else int(val)
            except ValueError:
                pass

        labels = {0: "LM·NTLM", 1: "LM·NTLM(NTLMv2 협상)", 2: "NTLM만",
                  3: "NTLMv2만", 4: "NTLMv2(DC거부 LM)", 5: "NTLMv2(DC거부 LM·NTLM)"}

        if level is None:
            self.manual(cid, name, Severity.LOW, desc,
                        f"LmCompatibilityLevel 파싱 실패: {val or '미설정'}",
                        rec, command=cmd, cmd_output=out)
            return

        if level >= 5:
            self.safe(cid, name, Severity.LOW, desc,
                      f"LmCompatibilityLevel={level} ({labels.get(level, 'NTLMv2 전용')})",
                      rec, command=cmd, cmd_output=out)
        else:
            self.vulnerable(cid, name, Severity.LOW, desc,
                            f"LmCompatibilityLevel={level} ({labels.get(level, '취약')}) — NTLMv2 전용 설정 필요",
                            rec, command=cmd, cmd_output=out,
                            evidence=f"LmCompatibilityLevel={level}")

    def _w510_everyone_anon(self):
        """5.10 Everyone 사용 권한을 익명 사용자에게 적용 안 함"""
        cid, name = "W-5.10", "Everyone 익명 사용자 적용 안 함"
        desc = ("EveryoneIncludesAnonymous=1 설정 시 익명 사용자가 "
                "Everyone 권한 리소스 모두 접근 가능.")
        rec  = (r"SECPOL.MSC > 네트워크 액세스: Everyone 사용 권한을 "
                "익명 사용자에게 적용 → '사용 안 함'")

        cmd = (r'reg query "HKLM\SYSTEM\CurrentControlSet\Control\Lsa" '
               r'/v EveryoneIncludesAnonymous')
        _, out, _ = self._run_shell(cmd)
        val = self._reg_val(out)

        if val in ("0x0", "0", None):
            self.safe(cid, name, Severity.LOW, desc,
                      f"EveryoneIncludesAnonymous={val or '미설정(0)'} — 익명 적용 안 함",
                      rec, command=cmd, cmd_output=out)
        else:
            self.vulnerable(cid, name, Severity.LOW, desc,
                            f"EveryoneIncludesAnonymous={val} — 익명 사용자에게 Everyone 권한 적용",
                            rec, command=cmd, cmd_output=out,
                            evidence=f"EveryoneIncludesAnonymous={val}")

    def _w511_removable_media(self):
        """5.11 이동식 미디어 포맷 및 꺼내기 admin만 허용"""
        cid, name = "W-5.11", "이동식 미디어 admin만 허용"
        desc = "이동식 미디어 포맷·꺼내기 권한을 Administrators로 제한해야 함."
        rec  = (r"SECPOL.MSC > 장치: 이동식 미디어 포맷 및 꺼내기 허용 → 'Administrators'")

        cmd = (r'reg query "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon" '
               r'/v AllocateDASD')
        _, out, _ = self._run_shell(cmd)
        val = self._reg_val(out)

        # 0 = Administrators만
        if val in ("0x0", "0", "0"):
            self.safe(cid, name, Severity.LOW, desc,
                      "AllocateDASD=0 — Administrators만 허용",
                      rec, command=cmd, cmd_output=out)
        elif val is None:
            self.safe(cid, name, Severity.LOW, desc,
                      "AllocateDASD 미설정 (기본값: Administrators만)",
                      rec, command=cmd, cmd_output=out)
        else:
            self.vulnerable(cid, name, Severity.LOW, desc,
                            f"AllocateDASD={val} — Administrators 외 사용자 허용",
                            rec, command=cmd, cmd_output=out,
                            evidence=f"AllocateDASD={val}")

    def _w512_smb_idle(self):
        """5.12 세션 연결 끊기 전 유휴 시간 설정"""
        cid, name = "W-5.12", "SMB 세션 유휴 시간 설정"
        desc = ("SMB 세션 유휴 시간 제한 미설정 시 null 세션 축적으로 "
                "서비스 거부 공격 위험.")
        rec  = (r"SECPOL.MSC > Microsoft 네트워크 서버: 세션 연결 끊기 전 "
                "유휴 시간 → 15분")

        cmd = (r'reg query "HKLM\SYSTEM\CurrentControlSet\Services\LanmanServer\Parameters" '
               r'/v AutoDisconnect')
        _, out, _ = self._run_shell(cmd)
        val = self._reg_val(out)

        if val is None:
            self.safe(cid, name, Severity.LOW, desc,
                      "AutoDisconnect 미설정 (기본값 15분)",
                      rec, command=cmd, cmd_output=out)
            return

        try:
            minutes = int(val, 16) if val.startswith("0x") else int(val)
        except ValueError:
            self.manual(cid, name, Severity.LOW, desc,
                        f"값 파싱 실패: {val}", rec, command=cmd, cmd_output=out)
            return

        # 0xffffffff = 사용 안 함 (무제한)
        if minutes == 0xffffffff or minutes == 4294967295:
            self.vulnerable(cid, name, Severity.LOW, desc,
                            "AutoDisconnect=무제한 — 유휴 세션 연결 유지됨",
                            rec, command=cmd, cmd_output=out,
                            evidence="AutoDisconnect=0xffffffff(무제한)")
        elif minutes <= 15:
            self.safe(cid, name, Severity.LOW, desc,
                      f"AutoDisconnect={minutes}분 (15분 이하)",
                      rec, command=cmd, cmd_output=out)
        else:
            self.vulnerable(cid, name, Severity.LOW, desc,
                            f"AutoDisconnect={minutes}분 (15분 초과)",
                            rec, command=cmd, cmd_output=out,
                            evidence=f"AutoDisconnect={minutes}분")

    def _w513_scheduled_tasks(self):
        """5.13 예약된 작업 의심스런 명령어 점검"""
        cid, name = "W-5.13", "예약된 작업 점검"
        desc = ("예약된 작업이 해킹·트로이목마·백도어 설치 경로로 이용될 수 있으므로 "
                "주기적 점검 필요.")
        rec  = "schtasks.exe 로 목록 확인 후 불필요한 작업 삭제"

        cmd = "schtasks /query /fo LIST 2>nul"
        _, out, _ = self._run_shell(cmd)

        self.manual(cid, name, Severity.MEDIUM, desc,
                    f"예약 작업 목록 수동 검토 필요 (총 {len(out.splitlines())}줄 출력됨)",
                    rec, command=cmd, cmd_output=out[:500])

    def _w514_remote_shutdown(self):
        """5.14 원격 시스템 종료 권한 설정"""
        cid, name = "W-5.14", "원격 시스템 종료 권한 설정"
        desc = ("원격 시스템 종료 권한이 Administrators 외 계정에 부여되면 "
                "서비스 거부 공격 악용 가능.")
        rec  = ("SECPOL.MSC > 사용자 권한 할당 > "
                "'원격 시스템에서 강제로 시스템 종료' → Administrators만")

        cmd = (r'cmd /c "secedit /export /cfg C:\Windows\Temp\wss2.cfg /quiet'
               r' && type C:\Windows\Temp\wss2.cfg"')
        _, out, _ = self._run_shell(cmd, timeout=20)

        for line in out.splitlines():
            if "SeRemoteShutdownPrivilege" in line:
                val = line.split("=", 1)[-1].strip()
                if val.replace("*", "").replace("S-1-5-32-544", "").strip() in ("", ","):
                    # S-1-5-32-544 = Administrators
                    self.safe(cid, name, Severity.HIGH, desc,
                              "SeRemoteShutdownPrivilege = Administrators만",
                              rec, command=cmd, cmd_output=out[:300])
                else:
                    self.vulnerable(cid, name, Severity.HIGH, desc,
                                    f"SeRemoteShutdownPrivilege = {val} (Administrators 외 존재)",
                                    rec, command=cmd, cmd_output=out[:300],
                                    evidence=f"SeRemoteShutdownPrivilege={val}")
                return

        self.manual(cid, name, Severity.HIGH, desc,
                    "secedit 출력에서 SeRemoteShutdownPrivilege 파싱 실패 — 수동 점검 필요",
                    rec, command=cmd, cmd_output=out[:300])

    def _w515_audit_crash(self):
        """5.15 보안 감사를 로그 할 수 없는 경우 즉시 시스템 종료 방지"""
        cid, name = "W-5.15", "보안 감사 로그 불가 시 종료 방지"
        desc = ("CrashOnAuditFail=1 설정 시 보안 이벤트 기록 불가 시 "
                "즉시 시스템 종료 → 서비스 거부 공격 악용 가능.")
        rec  = (r"reg add HKLM\SYSTEM\CurrentControlSet\Control\Lsa "
                r"/v CrashOnAuditFail /t REG_DWORD /d 0")

        cmd = (r'reg query "HKLM\SYSTEM\CurrentControlSet\Control\Lsa" '
               r'/v CrashOnAuditFail')
        _, out, _ = self._run_shell(cmd)
        val = self._reg_val(out)

        if val in ("0x0", "0", None):
            self.safe(cid, name, Severity.HIGH, desc,
                      f"CrashOnAuditFail={val or '미설정(0)'} — 즉시 종료 방지",
                      rec, command=cmd, cmd_output=out)
        else:
            self.vulnerable(cid, name, Severity.HIGH, desc,
                            f"CrashOnAuditFail={val} — 감사 로그 불가 시 즉시 종료 설정",
                            rec, command=cmd, cmd_output=out,
                            evidence=f"CrashOnAuditFail={val}")

    def _w516_secure_channel(self):
        """5.16 보안 채널 데이터 디지털 암호화 또는 서명 설정"""
        cid, name = "W-5.16", "보안 채널 데이터 암호화/서명 설정"
        desc = ("보안 채널 암호화·서명 미설정 시 인증 트래픽 끼어들기, "
                "반복 공격 등 네트워크 공격에 노출.")
        rec  = (r"SECPOL.MSC > 보안 옵션 > '도메인 구성원: 보안 채널 데이터 디지털 "
                "서명(가능한 경우)' 및 암호화, 항상 서명 → 모두 사용")

        base = r"HKLM\SYSTEM\CurrentControlSet\Services\Netlogon\Parameters"
        checks = {
            "RequireSignOrSeal": ("0x1", "보안 채널 항상 암호화·서명"),
            "SealSecureChannel": ("0x1", "보안 채널 데이터 암호화(가능한 경우)"),
            "SignSecureChannel": ("0x1", "보안 채널 데이터 서명(가능한 경우)"),
        }

        issues = []
        out_parts = []
        cmd_parts = []

        for reg_val, (expected, label) in checks.items():
            cmd = f'reg query "{base}" /v {reg_val}'
            cmd_parts.append(cmd)
            _, out, _ = self._run_shell(cmd)
            out_parts.append(f"[{reg_val}]\n{out}")
            val = self._reg_val(out)
            if val not in (expected, expected.lstrip("0x"), "1"):
                issues.append(f"{label} 미설정 ({reg_val}={val or '미설정'})")

        cmd_str = "\n".join(cmd_parts)
        cmd_out  = "\n".join(out_parts)

        if issues:
            self.vulnerable(cid, name, Severity.MEDIUM, desc,
                            "\n".join(issues), rec,
                            command=cmd_str, cmd_output=cmd_out,
                            evidence="\n".join(issues))
        else:
            self.safe(cid, name, Severity.MEDIUM, desc,
                      "보안 채널 암호화·서명 모두 설정됨",
                      rec, command=cmd_str, cmd_output=cmd_out)

    # ══════════════════════════════════════════════════════════════
    # 6. 바이러스 진단
    # ══════════════════════════════════════════════════════════════

    def _w61_antivirus(self):
        """6.1 백신 프로그램 설치"""
        cid, name = "W-6.1", "백신 프로그램 설치"
        desc = "바이러스·악성코드 감염 피해 최소화를 위해 백신 필수 설치."
        rec  = "백신 프로그램 설치 및 실시간 보호 활성화"

        cmd = ('powershell -NoProfile -NonInteractive -Command '
               '"Get-MpComputerStatus | Select-Object AMRunningMode,'
               'AntivirusEnabled,RealTimeProtectionEnabled"')
        _, out, _ = self._run_shell(cmd, timeout=20)

        if not out.strip():
            # Windows Defender가 없으면 서드파티 백신 확인
            cmd2 = ('powershell -NoProfile -NonInteractive -Command '
                    '"Get-CimInstance -Namespace root/SecurityCenter2 '
                    '-ClassName AntiVirusProduct | Select-Object displayName,productState"')
            _, out2, _ = self._run_shell(cmd2, timeout=20)

            if "displayname" in out2.lower() or out2.strip():
                self.safe(cid, name, Severity.MEDIUM, desc,
                          f"서드파티 백신 탐지됨:\n{out2[:200]}",
                          rec, command=cmd2, cmd_output=out2)
            else:
                self.vulnerable(cid, name, Severity.MEDIUM, desc,
                                "백신 프로그램 탐지 불가 — 설치 여부 수동 확인 필요",
                                rec, command=cmd, cmd_output=out)
            return

        av_enabled = "true" in out.lower() or "enabled" in out.lower()
        if av_enabled:
            self.safe(cid, name, Severity.MEDIUM, desc,
                      f"Windows Defender 또는 백신 활성화됨",
                      rec, command=cmd, cmd_output=out)
        else:
            self.vulnerable(cid, name, Severity.MEDIUM, desc,
                            "백신 비활성화 또는 미설치",
                            rec, command=cmd, cmd_output=out,
                            evidence=out[:200])

    def _w62_av_update(self):
        """6.2 최신 엔진 업데이트"""
        cid, name = "W-6.2", "최신 엔진 업데이트"
        desc = "백신 엔진을 최신 버전으로 유지해야 신종 바이러스 대응 가능."
        rec  = "백신 자동 업데이트 활성화 및 주기적 수동 업데이트 확인"

        cmd = ('powershell -NoProfile -NonInteractive -Command '
               '"Get-MpComputerStatus | Select-Object AntivirusSignatureLastUpdated,'
               'AntivirusSignatureVersion"')
        _, out, _ = self._run_shell(cmd, timeout=20)

        self.manual(cid, name, Severity.MEDIUM, desc,
                    f"백신 엔진 업데이트 날짜 수동 확인 필요:\n{out[:300]}",
                    rec, command=cmd, cmd_output=out)

    # ══════════════════════════════════════════════════════════════
    # 7. 레지스트리 보안 설정
    # ══════════════════════════════════════════════════════════════

    def _w71_sam_audit(self):
        """7.1 SAM 보안 감사 설정"""
        cid, name = "W-7.1", "SAM 보안 감사 설정"
        desc = "SAM 레지스트리 키에 Everyone 감사 설정으로 계정 인증 성공·실패 감시."
        rec  = ("regedit > HKLM\\SAM > 편집 > 사용 권한 > 고급 > 감사 탭 > "
                "Everyone 추가, 개체 액세스 모든 옵션 감사 설정")

        self.manual(cid, name, Severity.LOW, desc,
                    "SAM 레지스트리 감사 설정은 GUI/regedit 수동 확인 필요", rec)

    def _w72_null_session(self):
        """7.2 Null Session 설정"""
        cid, name = "W-7.2", "Null Session 설정"
        desc = ("Null Session을 통한 비인가 서버 접근 차단을 위해 "
                "RestrictAnonymous=2 설정 필요.")
        rec  = (r"reg add HKLM\SYSTEM\CurrentControlSet\Control\Lsa "
                r"/v RestrictAnonymous /t REG_DWORD /d 2")

        cmd = (r'reg query "HKLM\SYSTEM\CurrentControlSet\Control\Lsa" '
               r'/v RestrictAnonymous')
        _, out, _ = self._run_shell(cmd)
        val = self._reg_val(out)

        if val in ("0x2", "2"):
            self.safe(cid, name, Severity.HIGH, desc,
                      "RestrictAnonymous=2 — Null Session 차단",
                      rec, command=cmd, cmd_output=out)
        else:
            self.vulnerable(cid, name, Severity.HIGH, desc,
                            f"RestrictAnonymous={val or '미설정(0)'} — Null Session 허용",
                            rec, command=cmd, cmd_output=out,
                            evidence=f"RestrictAnonymous={val or '0'}")

    def _w73_remote_registry(self):
        """7.3 Remote Registry Service 설정"""
        cid, name = "W-7.3", "Remote Registry Service 설정"
        desc = ("원격 레지스트리 서비스 실행 시 네트워크를 통한 "
                "레지스트리 무단 접근 가능.")
        rec  = ("제어판 > 관리 도구 > 서비스 > RemoteRegistry 중지 및 '사용 안 함' 설정")

        cmd = "sc query RemoteRegistry"
        _, out, _ = self._run_shell(cmd)

        if "RUNNING" in out.upper():
            self.vulnerable(cid, name, Severity.HIGH, desc,
                            "RemoteRegistry 서비스 실행 중",
                            rec, command=cmd, cmd_output=out,
                            evidence="RemoteRegistry: RUNNING")
        else:
            self.safe(cid, name, Severity.HIGH, desc,
                      "RemoteRegistry 서비스 중지됨",
                      rec, command=cmd, cmd_output=out)

    def _w74_rds(self):
        """7.4 RDS 제거"""
        cid, name = "W-7.4", "RDS(Remote Data Service) 제거"
        self.skipped(cid, name, Severity.MEDIUM,
                     "RDS 제거 점검.",
                     "N/A — 해당 OS는 체크리스트에 포함하지 않음",
                     "해당 OS는 체크리스트에 포함하지 않음")

    def _w75_autologon(self):
        """7.5 AutoLogon 제한 설정"""
        cid, name = "W-7.5", "AutoLogon 제한 설정"
        desc = ("AutoLogon 활성화 시 레지스트리에서 로그인 계정·암호 노출 위험.")
        rec  = (r"reg add HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon "
                r"/v AutoAdminLogon /t REG_SZ /d 0")

        cmd = (r'reg query "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon" '
               r'/v AutoAdminLogon')
        _, out, _ = self._run_shell(cmd)
        val = self._reg_val(out)

        if val in ("0x1", "1"):
            self.vulnerable(cid, name, Severity.MEDIUM, desc,
                            "AutoAdminLogon=1 — 자동 로그온 활성화됨",
                            rec, command=cmd, cmd_output=out,
                            evidence="AutoAdminLogon=1")
        else:
            self.safe(cid, name, Severity.MEDIUM, desc,
                      f"AutoAdminLogon={val or '미설정(0)'} — 자동 로그온 비활성화",
                      rec, command=cmd, cmd_output=out)

    def _w76_dos_registry(self):
        """7.6 DOS 공격에 대한 방어 레지스트리 설정"""
        cid, name = "W-7.6", "DOS 공격 방어 레지스트리 설정"
        self.skipped(cid, name, Severity.MEDIUM,
                     "DOS 방어 레지스트리 설정.",
                     "N/A — 해당 OS는 체크리스트에 포함하지 않음",
                     "해당 OS는 체크리스트에 포함하지 않음")

    # ══════════════════════════════════════════════════════════════
    # 8. 보안 패치
    # ══════════════════════════════════════════════════════════════

    def _w81_service_pack(self):
        """8.1 최신 서비스 팩 적용"""
        cid, name = "W-8.1", "최신 서비스 팩 적용"
        desc = "최신 서비스 팩 미적용 시 알려진 취약점을 통한 서버 침해 발생 가능."
        rec  = "Windows Update 또는 Microsoft 다운로드 센터에서 최신 패치 적용"

        cmd = ('powershell -NoProfile -NonInteractive -Command '
               '"Get-ComputerInfo | Select-Object WindowsVersion,'
               'OsArchitecture,WindowsBuildLabEx"')
        _, out, _ = self._run_shell(cmd, timeout=20)

        if not out.strip():
            cmd2 = "wmic os get Caption,Version,ServicePackMajorVersion /value"
            _, out2, _ = self._run_shell(cmd2, timeout=15)
            self.manual(cid, name, Severity.HIGH, desc,
                        f"OS 버전 수동 확인 필요:\n{out2[:300]}",
                        rec, command=cmd2, cmd_output=out2)
            return

        self.manual(cid, name, Severity.HIGH, desc,
                    f"OS 버전 수동 확인 필요:\n{out[:300]}",
                    rec, command=cmd, cmd_output=out)

    def _w82_hotfix(self):
        """8.2 최신 HOT FIX 적용"""
        cid, name = "W-8.2", "최신 HOT FIX 적용"
        desc = "최신 HOT FIX 미적용 시 알려진 취약점을 통한 서버 침해 발생 가능."
        rec  = ("Windows Update 자동 업데이트 활성화. "
                "참고: http://technet.microsoft.com/ko-kr/security/bulletin/")

        cmd = ('powershell -NoProfile -NonInteractive -Command '
               '"Get-HotFix | Sort-Object InstalledOn -Descending'
               ' | Select-Object -First 10 | Format-Table HotFixID,InstalledOn -AutoSize"')
        _, out, _ = self._run_shell(cmd, timeout=20)

        self.manual(cid, name, Severity.HIGH, desc,
                    f"최근 설치된 HOT FIX 수동 확인 필요:\n{out[:400]}",
                    rec, command=cmd, cmd_output=out)

    # ══════════════════════════════════════════════════════════════
    # 9. 이슈 취약점
    # ══════════════════════════════════════════════════════════════

    def _w91_openssl(self):
        """9.1 OpenSSL 취약점"""
        cid, name = "W-9.1", "OpenSSL 취약점"
        desc = ("HeartBleed(CVE-2014-0610), FREAK, DROWN 등 OpenSSL 취약점 "
                "영향 여부 점검.")
        rec  = "OpenSSL 최신 버전 업그레이드 또는 불필요 시 제거"

        cmd = ('powershell -NoProfile -NonInteractive -Command '
               r'"Get-ChildItem -Path C:\ -Filter openssl.exe -Recurse '
               r'-ErrorAction SilentlyContinue | Select-Object FullName"')
        _, out1, _ = self._run_shell(cmd, timeout=20)

        cmd2 = "openssl version 2>nul"
        _, out2, _ = self._run_shell(cmd2, timeout=10)

        cmd_str = f"{cmd}\n{cmd2}"
        cmd_out  = f"[openssl.exe 탐색]\n{out1}\n\n[openssl version]\n{out2}"

        if out2.strip() and "openssl" in out2.lower():
            # 버전 파싱
            m = re.search(r"OpenSSL\s+(\d+\.\d+\.\d+\w*)", out2, re.IGNORECASE)
            if m:
                version = m.group(1)
                self.manual(cid, name, Severity.HIGH, desc,
                            f"OpenSSL {version} 설치됨 — CVE 해당 여부 수동 확인 필요",
                            rec, command=cmd_str, cmd_output=cmd_out)
            else:
                self.manual(cid, name, Severity.HIGH, desc,
                            f"OpenSSL 설치됨 (버전 파싱 실패): {out2[:100]}",
                            rec, command=cmd_str, cmd_output=cmd_out)
        elif out1.strip():
            self.manual(cid, name, Severity.HIGH, desc,
                        f"openssl.exe 파일 발견 — 버전 및 취약점 수동 확인 필요:\n{out1[:300]}",
                        rec, command=cmd_str, cmd_output=cmd_out)
        else:
            self.safe(cid, name, Severity.HIGH, desc,
                      "OpenSSL 미탐지 (시스템 경로에 openssl.exe 없음)",
                      rec, command=cmd_str, cmd_output=cmd_out)
