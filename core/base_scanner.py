"""
모든 진단 모듈이 상속하는 기반 스캐너 클래스
"""
import subprocess
import shlex
import threading
from abc import ABC, abstractmethod
from typing import Optional
from core.result import CheckResult, ScanReport, Status, Severity


class StopScan(Exception):
    """진단 중단 요청 시 발생하는 예외"""


class BaseScanner(ABC):
    """진단 모듈 기반 클래스. 각 모듈은 이 클래스를 상속하여 구현."""

    CATEGORY: str = ""

    def __init__(self, target: str = "localhost", verbose: bool = False,
                 executor=None):
        self.target = target
        self.verbose = verbose
        self.executor = executor   # SSHExecutor | SSMExecutor | None
        self.report = ScanReport(target=target, scan_type=self.CATEGORY)
        self._stop_event: threading.Event | None = None   # GUI에서 주입

    def _check_stop(self):
        """중단 요청이 있으면 StopScan 예외 발생"""
        if self._stop_event and self._stop_event.is_set():
            raise StopScan("사용자가 진단을 중단했습니다.")

    @abstractmethod
    def run(self) -> ScanReport:
        ...

    # ── 결과 기록 헬퍼 ──────────────────────────────────────────────

    def _add(
        self,
        check_id: str,
        name: str,
        status: Status,
        severity: Severity,
        description: str,
        details: str,
        recommendation: str,
        command: str = "",
        cmd_output: str = "",
        evidence: str = "",
    ) -> CheckResult:
        self._check_stop()   # 항목 기록 직전에 중단 체크
        result = CheckResult(
            check_id=check_id,
            category=self.CATEGORY,
            name=name,
            status=status,
            severity=severity,
            description=description,
            details=details,
            recommendation=recommendation,
            command=command,
            cmd_output=cmd_output,
            evidence=evidence,
        )
        self.report.add(result)
        if self.verbose:
            label = {
                "취약":    "[취약]",
                "양호":    "[양호]",
                "수동점검": "[검토]",
                "오류":    "[검토]",
                "미해당":  "[ N/A]",
            }.get(status.value, "[    ]")
            print(f"  {label} [{check_id}] {name}")
        return result

    def vulnerable(self, check_id, name, severity, description, details,
                   recommendation, command="", cmd_output="", evidence=""):
        return self._add(check_id, name, Status.VULNERABLE, severity,
                         description, details, recommendation,
                         command, cmd_output, evidence)

    def safe(self, check_id, name, severity, description, details,
             recommendation, command="", cmd_output="", evidence=""):
        return self._add(check_id, name, Status.SAFE, severity,
                         description, details, recommendation,
                         command, cmd_output, evidence)

    def manual(self, check_id, name, severity, description, details,
               recommendation, command="", cmd_output="", evidence=""):
        return self._add(check_id, name, Status.MANUAL, severity,
                         description, details, recommendation,
                         command, cmd_output, evidence)

    def skipped(self, check_id, name, severity, description, details,
                recommendation, command="", cmd_output="", evidence=""):
        return self._add(check_id, name, Status.SKIPPED, severity,
                         description, details, recommendation,
                         command, cmd_output, evidence)

    def error(self, check_id, name, severity, description, details,
              recommendation, command="", cmd_output="", evidence=""):
        return self._add(check_id, name, Status.ERROR, severity,
                         description, details, recommendation,
                         command, cmd_output, evidence)

    # ── 명령어 실행 헬퍼 ────────────────────────────────────────────

    def _run_cmd(self, cmd: str, timeout: int = 10) -> tuple[int, str, str]:
        """인수 리스트 방식으로 실행 (파이프 불가). 실패해도 예외 미발생."""
        if self.executor:
            return self.executor.run_cmd(cmd, timeout)
        try:
            proc = subprocess.run(
                shlex.split(cmd),
                capture_output=True, text=True, timeout=timeout,
            )
            return proc.returncode, proc.stdout.strip(), proc.stderr.strip()
        except subprocess.TimeoutExpired:
            return -1, "", f"timeout after {timeout}s"
        except FileNotFoundError as e:
            return -1, "", str(e)
        except Exception as e:
            return -1, "", str(e)

    def _run_shell(self, cmd: str, timeout: int = 10) -> tuple[int, str, str]:
        """shell=True로 실행 (파이프·리다이렉트·복합 명령 가능). 실패해도 예외 미발생."""
        if self.executor:
            return self.executor.run_shell(cmd, timeout)
        try:
            proc = subprocess.run(
                cmd, shell=True,
                capture_output=True, text=True, timeout=timeout,
            )
            return proc.returncode, proc.stdout.strip(), proc.stderr.strip()
        except subprocess.TimeoutExpired:
            return -1, "", f"timeout after {timeout}s"
        except Exception as e:
            return -1, "", str(e)

    def _read_file(self, path: str) -> Optional[str]:
        """파일 읽기. 없거나 권한 없으면 None 반환."""
        if self.executor:
            return self.executor.read_file(path)
        try:
            with open(path, "r", errors="replace") as f:
                return f.read()
        except Exception:
            return None
