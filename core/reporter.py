"""
진단 결과 리포트 생성기 (JSON / HTML / CSV)
"""
import json
import csv
import os
from datetime import datetime
from core.result import ScanReport, Status, Severity


REPORTS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "reports")


def _ensure_dir():
    os.makedirs(REPORTS_DIR, exist_ok=True)


def _filename(report: ScanReport, ext: str) -> str:
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_type = report.scan_type.replace("/", "_").replace(" ", "_")
    return os.path.join(REPORTS_DIR, f"{safe_type}_{ts}.{ext}")


# ── JSON ────────────────────────────────────────────────────────────

def save_json(report: ScanReport) -> str:
    _ensure_dir()
    path = _filename(report, "json")
    data = {
        "target": report.target,
        "scan_type": report.scan_type,
        "started_at": report.started_at,
        "finished_at": report.finished_at,
        "summary": report.summary,
        "results": [r.to_dict() for r in report.results],
    }
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    return path


# ── CSV ─────────────────────────────────────────────────────────────

def save_csv(report: ScanReport) -> str:
    _ensure_dir()
    path = _filename(report, "csv")
    fields = ["check_id", "category", "name", "status", "severity",
              "description", "details", "recommendation", "evidence", "checked_at"]
    with open(path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        for r in report.results:
            writer.writerow(r.to_dict())
    return path


# ── HTML ─────────────────────────────────────────────────────────────

_STATUS_COLOR = {
    "취약": "#e74c3c",
    "양호": "#27ae60",
    "수동점검": "#f39c12",
    "오류": "#95a5a6",
    "미해당": "#bdc3c7",
}

_SEVERITY_COLOR = {
    "위험": "#c0392b",
    "높음": "#e74c3c",
    "보통": "#e67e22",
    "낮음": "#f1c40f",
    "정보": "#3498db",
}


def save_html(report: ScanReport) -> str:
    _ensure_dir()
    path = _filename(report, "html")
    s = report.summary

    rows = ""
    for r in report.results:
        sc = _STATUS_COLOR.get(r.status.value, "#999")
        sev = _SEVERITY_COLOR.get(r.severity.value, "#999")
        rows += f"""
        <tr>
          <td>{r.check_id}</td>
          <td>{r.name}</td>
          <td><span class="badge" style="background:{sc}">{r.status.value}</span></td>
          <td><span class="badge" style="background:{sev}">{r.severity.value}</span></td>
          <td>{r.details}</td>
          <td>{r.recommendation}</td>
        </tr>"""

    html = f"""<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>취약점 진단 결과 - {report.scan_type}</title>
  <style>
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{ font-family: 'Segoe UI', Arial, sans-serif; background: #f4f6f9; color: #333; }}
    .container {{ max-width: 1200px; margin: 30px auto; padding: 0 20px; }}
    h1 {{ font-size: 1.6rem; margin-bottom: 6px; }}
    .meta {{ color: #666; font-size: 0.85rem; margin-bottom: 24px; }}
    .summary {{ display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 28px; }}
    .card {{ background: #fff; border-radius: 8px; padding: 16px 22px; min-width: 120px;
             box-shadow: 0 1px 4px rgba(0,0,0,.1); text-align: center; }}
    .card .num {{ font-size: 2rem; font-weight: 700; }}
    .card .label {{ font-size: 0.78rem; color: #888; margin-top: 2px; }}
    table {{ width: 100%; border-collapse: collapse; background: #fff;
             border-radius: 8px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,.1); }}
    th {{ background: #2c3e50; color: #fff; padding: 11px 14px; text-align: left;
          font-size: 0.85rem; }}
    td {{ padding: 10px 14px; border-bottom: 1px solid #ecf0f1; font-size: 0.84rem;
          vertical-align: top; }}
    tr:last-child td {{ border-bottom: none; }}
    tr:hover td {{ background: #f8f9fa; }}
    .badge {{ color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 0.78rem;
              white-space: nowrap; }}
  </style>
</head>
<body>
<div class="container">
  <h1>취약점 진단 결과 — {report.scan_type}</h1>
  <p class="meta">대상: {report.target} &nbsp;|&nbsp; 시작: {report.started_at} &nbsp;|&nbsp; 종료: {report.finished_at or '-'}</p>
  <div class="summary">
    <div class="card"><div class="num">{s['total']}</div><div class="label">전체</div></div>
    <div class="card" style="border-top:3px solid #e74c3c"><div class="num" style="color:#e74c3c">{s['vulnerable']}</div><div class="label">취약</div></div>
    <div class="card" style="border-top:3px solid #27ae60"><div class="num" style="color:#27ae60">{s['safe']}</div><div class="label">양호</div></div>
    <div class="card" style="border-top:3px solid #f39c12"><div class="num" style="color:#f39c12">{s['manual']}</div><div class="label">수동점검</div></div>
    <div class="card" style="border-top:3px solid #c0392b"><div class="num" style="color:#c0392b">{s['by_severity']['위험']}</div><div class="label">위험</div></div>
    <div class="card" style="border-top:3px solid #e74c3c"><div class="num" style="color:#e74c3c">{s['by_severity']['높음']}</div><div class="label">높음</div></div>
    <div class="card" style="border-top:3px solid #e67e22"><div class="num" style="color:#e67e22">{s['by_severity']['보통']}</div><div class="label">보통</div></div>
  </div>
  <table>
    <thead>
      <tr>
        <th>ID</th><th>점검 항목</th><th>결과</th><th>위험도</th><th>상세</th><th>조치 방안</th>
      </tr>
    </thead>
    <tbody>{rows}
    </tbody>
  </table>
</div>
</body>
</html>"""

    with open(path, "w", encoding="utf-8") as f:
        f.write(html)
    return path
