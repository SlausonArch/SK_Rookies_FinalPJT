"""
모든 진단 모듈이 상속하는 기반 스캐너 클래스
"""
import subprocess
import shlex
from abc import ABC, abstractmethod
from typing import Optional
from core.result import CheckResult, ScanReport, Status, Severity


class BaseScanner(ABC):
    """진단 모듈 기반 클래스. 각 모듈은 이 클래스를 상속하여 구현."""

    CATEGORY: str = ""   # 서브클래스에서 정의 (예: "OS-Linux")

    def __init__(self, target: str = "localhost", verbose: bool = False):
        self.target = target
        self.verbose = verbose
        self.report = ScanReport(target=target, scan_type=self.CATEGORY)

    @abstractmethod
    def run(self) -> ScanReport:
        """모든 점검 항목을 실행하고 ScanReport를 반환."""
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
        evidence: str = "",
    ) -> CheckResult:
        result = CheckResult(
            check_id=check_id,
            category=self.CATEGORY,
            name=name,
            status=status,
            severity=severity,
            description=description,
            details=details,
            recommendation=recommendation,
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

    def vulnerable(self, check_id, name, severity, description, details, recommendation, evidence=""):
        return self._add(check_id, name, Status.VULNERABLE, severity, description, details, recommendation, evidence)

    def safe(self, check_id, name, severity, description, details, recommendation, evidence=""):
        return self._add(check_id, name, Status.SAFE, severity, description, details, recommendation, evidence)

    def manual(self, check_id, name, severity, description, details, recommendation, evidence=""):
        return self._add(check_id, name, Status.MANUAL, severity, description, details, recommendation, evidence)

    def skipped(self, check_id, name, severity, description, details, recommendation, evidence=""):
        return self._add(check_id, name, Status.SKIPPED, severity, description, details, recommendation, evidence)

    def error(self, check_id, name, severity, description, details, recommendation, evidence=""):
        return self._add(check_id, name, Status.ERROR, severity, description, details, recommendation, evidence)

    # ── 명령어 실행 헬퍼 ────────────────────────────────────────────

    def _run_cmd(self, cmd: str, timeout: int = 10) -> tuple[int, str, str]:
        """
        쉘 명령어를 실행하고 (returncode, stdout, stderr) 반환.
        실패해도 예외를 던지지 않음.
        """
        try:
            proc = subprocess.run(
                shlex.split(cmd),
                capture_output=True,
                text=True,
                timeout=timeout,
            )
            return proc.returncode, proc.stdout.strip(), proc.stderr.strip()
        except subprocess.TimeoutExpired:
            return -1, "", f"timeout after {timeout}s"
        except FileNotFoundError as e:
            return -1, "", str(e)
        except Exception as e:
            return -1, "", str(e)

    def _read_file(self, path: str) -> Optional[str]:
        """파일 읽기. 없거나 권한 없으면 None 반환."""
        try:
            with open(path, "r", errors="replace") as f:
                return f.read()
        except Exception:
            return None
