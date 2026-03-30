"""
취약점 진단 결과 데이터 모델
"""
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime
from typing import Optional


class Severity(Enum):
    CRITICAL = "위험"
    HIGH = "높음"
    MEDIUM = "보통"
    LOW = "낮음"
    INFO = "정보"


class Status(Enum):
    VULNERABLE = "취약"
    SAFE = "양호"
    MANUAL = "수동점검"
    ERROR = "오류"
    SKIPPED = "미해당"


@dataclass
class CheckResult:
    check_id: str            # 점검 항목 ID (예: "OS-L-01")
    category: str            # 카테고리 (예: "OS-Linux")
    name: str                # 점검 항목명
    status: Status           # 점검 결과
    severity: Severity       # 취약 시 위험도
    description: str         # 점검 항목 설명
    details: str             # 실제 점검 결과 상세
    recommendation: str      # 조치 방안
    evidence: str = ""       # 근거 (명령어 출력 등)
    checked_at: str = field(default_factory=lambda: datetime.now().strftime("%Y-%m-%d %H:%M:%S"))

    def to_dict(self) -> dict:
        return {
            "check_id": self.check_id,
            "category": self.category,
            "name": self.name,
            "status": self.status.value,
            "severity": self.severity.value,
            "description": self.description,
            "details": self.details,
            "recommendation": self.recommendation,
            "evidence": self.evidence,
            "checked_at": self.checked_at,
        }


@dataclass
class ScanReport:
    target: str                                   # 점검 대상
    scan_type: str                                # 점검 유형
    started_at: str = field(default_factory=lambda: datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    finished_at: Optional[str] = None
    results: list[CheckResult] = field(default_factory=list)

    def add(self, result: CheckResult):
        self.results.append(result)

    def finish(self):
        self.finished_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    @property
    def summary(self) -> dict:
        total = len(self.results)
        counts = {s: 0 for s in Status}
        severity_counts = {s: 0 for s in Severity}
        for r in self.results:
            counts[r.status] += 1
            if r.status == Status.VULNERABLE:
                severity_counts[r.severity] += 1
        return {
            "total": total,
            "vulnerable": counts[Status.VULNERABLE],
            "safe": counts[Status.SAFE],
            "manual": counts[Status.MANUAL],
            "error": counts[Status.ERROR],
            "skipped": counts[Status.SKIPPED],
            "by_severity": {s.value: severity_counts[s] for s in Severity},
        }
