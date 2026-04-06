#!/opt/homebrew/bin/python3
"""취약점 진단 자동화 스크립트 - GUI"""
import sys, os, queue, threading, inspect, platform
import tkinter as tk
from tkinter import ttk, filedialog, messagebox

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from core import reporter

_MODULES_SK = {
    "1": {"name": "OS - Linux",           "tag": "LINUX", "desc": "계정/패스워드 · 파일 권한 · SSH · 서비스 · 로그 · 커널  [58개]",
          "loader": lambda: __import__("modules.os.linux_scanner",            fromlist=["LinuxScanner"]).LinuxScanner},
    "2": {"name": "OS - Windows",         "tag": "WIN",   "desc": "계정 정책 · 레지스트리 · 감사 정책 · RDP · SMB",
          "loader": lambda: __import__("modules.os.windows_scanner",          fromlist=["WindowsScanner"]).WindowsScanner},
    "3": {"name": "WebServer - Nginx",    "tag": "NGINX", "desc": "버전 노출 · 디렉토리 리스팅 · SSL/TLS · 보안 헤더",
          "loader": lambda: __import__("modules.webserver.nginx_scanner",     fromlist=["NginxScanner"]).NginxScanner},
    "4": {"name": "WebServer - IIS",      "tag": "IIS",   "desc": "디렉토리 브라우징 · 버전 노출 · HTTP 메서드 · 로그",
          "loader": lambda: __import__("modules.webserver.iis_scanner",       fromlist=["IISScanner"]).IISScanner},
    "5": {"name": "DBMS  MySQL/PG/MSSQL", "tag": "DB",    "desc": "포트 노출 · 기본 계정 · 원격 root · 감사 로그",
          "loader": lambda: __import__("modules.dbms.dbms_scanner",           fromlist=["DBMSScanner"]).DBMSScanner},
    "6": {"name": "Oracle  11g ~ 21c",    "tag": "ORA",   "desc": "계정/권한 · 보안설정 · 환경파일 · 감사 — 서버/Docker/RDS",
          "loader": lambda: __import__("modules.dbms.oracle_scanner",         fromlist=["OracleScanner"]).OracleScanner},
    "7": {"name": "Cloud - AWS",          "tag": "AWS",   "desc": "IAM · 보안그룹 · S3 · RDS · CloudTrail · VPC · 백업",
          "loader": lambda: __import__("modules.cloud.aws_scanner",           fromlist=["AWSScanner"]).AWSScanner},
}

_MODULES_JTK = {
    "1": {"name": "OS - Linux",           "tag": "LINUX", "desc": "계정/패스워드 · 파일 권한 · SSH · 서비스 · 로그 · 커널  [67개, 주통기 2026]",
          "loader": lambda: __import__("modules.os.linux_scanner_jtk",        fromlist=["LinuxScanner"]).LinuxScanner},
    "2": {"name": "OS - Windows",         "tag": "WIN",   "desc": "계정 정책 · 레지스트리 · 감사 정책 · RDP · SMB  [주통기 2026 +6]",
          "loader": lambda: __import__("modules.os.windows_scanner_jtk",      fromlist=["WindowsScanner"]).WindowsScanner},
    "3": {"name": "WebServer - Nginx",    "tag": "NGINX", "desc": "버전 노출 · 디렉토리 리스팅 · SSL/TLS · 보안 헤더",
          "loader": lambda: __import__("modules.webserver.nginx_scanner",     fromlist=["NginxScanner"]).NginxScanner},
    "4": {"name": "WebServer - IIS",      "tag": "IIS",   "desc": "디렉토리 브라우징 · 버전 노출 · HTTP 메서드 · 로그",
          "loader": lambda: __import__("modules.webserver.iis_scanner",       fromlist=["IISScanner"]).IISScanner},
    "5": {"name": "DBMS  MySQL/PG/MSSQL", "tag": "DB",    "desc": "포트 노출 · 기본 계정 · 원격 root · 감사 로그  [주통기 2026 +5]",
          "loader": lambda: __import__("modules.dbms.dbms_scanner_jtk",       fromlist=["DBMSScanner"]).DBMSScanner},
    "6": {"name": "Oracle  11g ~ 21c",    "tag": "ORA",   "desc": "계정/권한 · 보안설정 · 환경파일 · 감사 — 서버/Docker/RDS",
          "loader": lambda: __import__("modules.dbms.oracle_scanner",         fromlist=["OracleScanner"]).OracleScanner},
    "7": {"name": "Cloud - AWS",          "tag": "AWS",   "desc": "IAM · 보안그룹 · S3 · RDS · CloudTrail · VPC · 백업  [주통기 2026 +3]",
          "loader": lambda: __import__("modules.cloud.aws_scanner_jtk",       fromlist=["AWSScanner"]).AWSScanner},
}

MODULES = _MODULES_SK  # 기본값 — 런타임에 교체됨

# ── Binance-style palette ─────────────────────────────────────────────────────
C_BG    = "#0b0e11"
C_CARD  = "#1e2026"
C_DEEP  = "#14171c"
C_LINE  = "#2b2f36"
C_LINE2 = "#383e47"
C_FG    = "#eaecef"
C_SUB   = "#848e9c"
C_MUTE  = "#474d57"
C_GOLD  = "#f0b90b"
C_GOLD2 = "#b8860b"
C_RED   = "#f6465d"
C_GREEN = "#0ecb81"
C_WARN  = "#f7a600"
C_BLUE  = "#3498db"
C_TEAL  = "#00c8b4"

_MONO = ("Menlo"   if platform.system() == "Darwin"  else
         "Consolas" if platform.system() == "Windows" else "monospace")
_UI   = ("SF Pro Display" if platform.system() == "Darwin"  else
         "Segoe UI"        if platform.system() == "Windows" else "Ubuntu")


def _lbl(p, text, bg, fg=C_FG, sz=9, wt="normal", **kw):
    return tk.Label(p, text=text, bg=bg, fg=fg, font=(_UI, sz, wt), **kw)


class ScrollableFrame(tk.Frame):
    def __init__(self, parent, bg=C_CARD, **kw):
        super().__init__(parent, bg=bg, **kw)
        self._c  = tk.Canvas(self, bg=bg, highlightthickness=0, bd=0)
        self._sb = ttk.Scrollbar(self, orient="vertical", command=self._c.yview)
        self.inner = tk.Frame(self._c, bg=bg)
        self.inner.bind("<Configure>",
            lambda e: self._c.configure(scrollregion=self._c.bbox("all")))
        self._win_id = self._c.create_window((0, 0), window=self.inner, anchor="nw")
        self._c.configure(yscrollcommand=self._sb.set)
        self._c.bind("<Configure>", lambda e: self._c.itemconfig(self._win_id, width=e.width))
        self._c.pack(side="left", fill="both", expand=True)
        self._sb.pack(side="right", fill="y")

        # inner가 완전히 구성된 후 자식 위젯에 스크롤 바인딩
        self.inner.bind("<Configure>", self._rebind_children, add="+")

    def _do_scroll(self, e):
        # Entry·Text 위젯에 포커스가 있으면 스크롤 무시 (입력 방해 방지)
        focused = str(self._c.focus_get() or "")
        if "entry" in focused.lower() or "text" in focused.lower():
            return
        if platform.system() == "Darwin":
            self._c.yview_scroll(int(-1 * e.delta), "units")
        elif platform.system() == "Windows":
            self._c.yview_scroll(int(-1 * (e.delta / 120)), "units")
        else:
            self._c.yview_scroll(-1 if e.num == 4 else 1, "units")

    def _bind_widget(self, w):
        """위젯과 모든 자식에 마우스 스크롤 바인딩 (Entry·Text 제외)"""
        try:
            # Entry/Text는 키 입력 이벤트가 막힐 수 있으므로 건너뜀
            if isinstance(w, (tk.Entry, tk.Text, ttk.Entry)):
                for child in w.winfo_children():
                    self._bind_widget(child)
                return
            w.bind("<MouseWheel>", self._do_scroll, add="+")
            w.bind("<Button-4>",   self._do_scroll, add="+")
            w.bind("<Button-5>",   self._do_scroll, add="+")
        except Exception:
            pass
        for child in w.winfo_children():
            self._bind_widget(child)

    def _rebind_children(self, e=None):
        self._bind_widget(self._c)
        self._bind_widget(self.inner)


class StdoutQueue:
    def __init__(self, q): self.q = q
    def write(self, t):
        if t: self.q.put(t)
    def flush(self): pass


class VulnScannerGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("VulnScanner  ─  취약점 진단 자동화")
        self.root.geometry("1380x900")
        self.root.minsize(1060, 680)
        self.root.configure(bg=C_BG)

        self.output_q    = queue.Queue()
        self.scan_thread = None
        self._report     = None
        self._stop_event = threading.Event()

        self._init_vars()
        self._apply_style()
        self._build_ui()
        self._poll_output()
        self.root.after(200, self._rebind_all_scrollframes)

        self.root.bind("<F5>",             lambda e: self._start_scan())
        self.root.bind("<Control-Return>", lambda e: self._start_scan())

    # ── 변수 ─────────────────────────────────────────────────────────────────
    def _init_vars(self):
        self.guide_key  = tk.StringVar(value="sk")   # "sk" | "jtk"
        self.conn_mode  = tk.StringVar(value="1")
        self.ssh_host   = tk.StringVar()
        self.ssh_port   = tk.StringVar(value="22")
        self.ssh_user   = tk.StringVar(value="ec2-user")
        self.ssh_auth   = tk.StringVar(value="key")
        self.ssh_key    = tk.StringVar()
        self.ssh_pass   = tk.StringVar()
        self.ssm_id     = tk.StringVar()
        self.ssm_id.trace_add("write", lambda *_: self._update_rds_cmd())
        self.ssm_region = tk.StringVar(value="ap-northeast-2")
        self.ssm_region.trace_add("write", lambda *_: self._update_rds_cmd())
        self.ssm_cred   = tk.StringVar(value="2")
        self.ssm_ak     = tk.StringVar()
        self.ssm_sk     = tk.StringVar()
        self.ssm_tok    = tk.StringVar()
        self.ssm_os     = tk.StringVar(value="linux")
        self.docker_ctn      = tk.StringVar()   # 로컬 Docker
        self.ssh_docker_ctn  = tk.StringVar()   # SSH → Docker
        self.ssm_docker_ctn  = tk.StringVar()   # SSM → Docker
        self.mod_key    = tk.StringVar(value="1")
        self.target     = tk.StringVar(value="localhost")
        self.nginx_conf = tk.StringVar()
        self.db_type    = tk.StringVar(value="mysql")
        self.db_port    = tk.StringVar(value="3306")
        self.db_user    = tk.StringVar()
        self.db_pass    = tk.StringVar()
        self.ora_deploy     = tk.StringVar(value="server")
        self.ora_host       = tk.StringVar(value="localhost")
        self.ora_host.trace_add("write", lambda *_: self._update_rds_cmd())
        self.ora_port       = tk.StringVar(value="1521")
        self.ora_port.trace_add("write", lambda *_: self._update_rds_cmd())
        self.ora_svc        = tk.StringVar(value="ORCL")
        self.ora_user       = tk.StringVar(value="system")
        self.ora_pass       = tk.StringVar()
        # RDS 전용: SSM 터널 자동화
        self.ora_rds_ep     = tk.StringVar()   # 실제 RDS 엔드포인트
        self.ora_rds_ep.trace_add("write", lambda *_: self._update_rds_cmd())
        self.ora_local_port = tk.StringVar(value="11521")  # 로컬 포워딩 포트
        self.ora_local_port.trace_add("write", lambda *_: self._update_rds_cmd())
        self.ora_tunnel_iid  = tk.StringVar()               # 터널용 EC2 인스턴스 ID (RDS 전용)
        self.ora_tunnel_iid.trace_add("write", lambda *_: self._update_rds_cmd())
        self.ora_auto_tunnel = tk.BooleanVar(value=True)   # 터널 자동 시작 여부
        self._ssm_proc       = None   # 실행 중인 SSM 터널 프로세스
        self._ssm_output     = ""     # SSM 터널 시작 실패 시 진단용 출력
        # AWS Cloud 진단 전용
        self.aws_region  = tk.StringVar(value="ap-northeast-2")
        self.aws_use_ssm = tk.BooleanVar(value=True)   # SSM 자격증명 재사용
        self.aws_ak      = tk.StringVar()
        self.aws_sk      = tk.StringVar()
        self.aws_tok     = tk.StringVar()
        self.rpt_excel  = tk.BooleanVar(value=True)
        self.rpt_md     = tk.BooleanVar(value=False)
        self.status_var = tk.StringVar(value="IDLE")

    # ── 스타일 ────────────────────────────────────────────────────────────────
    def _apply_style(self):
        s = ttk.Style(self.root)
        s.theme_use("clam")
        s.configure(".", background=C_BG, foreground=C_FG, borderwidth=0, font=(_UI, 10))
        s.configure("TFrame",    background=C_BG)
        s.configure("TLabel",    background=C_BG, foreground=C_FG)
        s.configure("TEntry",    fieldbackground=C_LINE, foreground=C_FG,
                    insertcolor=C_FG, bordercolor=C_LINE2, padding=(8, 5), font=(_UI, 9))
        s.map("TEntry", bordercolor=[("focus", C_GOLD)],
                        fieldbackground=[("focus", C_LINE2)])
        s.configure("TButton",   background=C_LINE, foreground=C_FG,
                    bordercolor=C_LINE2, padding=(10, 6), relief="flat")
        s.map("TButton", background=[("active", C_LINE2), ("disabled", C_LINE)],
                         foreground=[("active", C_FG),    ("disabled", C_MUTE)])
        s.configure("Save.TButton", background=C_LINE, foreground=C_TEAL,
                    padding=(10, 5), relief="flat", font=(_UI, 9))
        s.map("Save.TButton", background=[("active", C_LINE2)])
        s.configure("TScrollbar", background=C_LINE, troughcolor=C_DEEP,
                    arrowcolor=C_SUB, borderwidth=0)
        s.map("TScrollbar", background=[("active", C_LINE2)])
        s.configure("TProgressbar", troughcolor=C_LINE, background=C_GOLD,
                    borderwidth=0, thickness=2)
        for w in ("TCheckbutton", "TRadiobutton"):
            s.configure(w, background=C_CARD, foreground=C_SUB,
                        indicatorcolor=C_GOLD, selectcolor=C_CARD)
            s.map(w, background=[("active", C_CARD)], foreground=[("active", C_FG)])

    # ── UI 빌드 ───────────────────────────────────────────────────────────────
    def _build_ui(self):
        self._build_topbar()
        tk.Frame(self.root, bg=C_LINE, height=1).pack(fill=tk.X)

        pw = tk.PanedWindow(self.root, orient=tk.HORIZONTAL,
                            bg=C_LINE, sashwidth=1, relief=tk.FLAT, sashpad=0)
        pw.pack(fill=tk.BOTH, expand=True)

        left = tk.Frame(pw, bg=C_CARD)
        pw.add(left, minsize=380, width=430)
        self._build_left(left)

        right = tk.Frame(pw, bg=C_BG)
        pw.add(right, minsize=580)
        self._build_right(right)

    # ── 상단 바 ───────────────────────────────────────────────────────────────
    def _build_topbar(self):
        bar = tk.Frame(self.root, bg=C_DEEP)
        bar.pack(fill=tk.X)
        inner = tk.Frame(bar, bg=C_DEEP)
        inner.pack(fill=tk.X, padx=20, pady=10)

        tk.Label(inner, text="⚡", bg=C_DEEP, fg=C_GOLD,
                 font=(_UI, 16, "bold")).pack(side=tk.LEFT)
        tk.Label(inner, text=" VulnScanner", bg=C_DEEP, fg=C_FG,
                 font=(_UI, 15, "bold")).pack(side=tk.LEFT)
        tk.Label(inner, text="  취약점 진단 자동화", bg=C_DEEP, fg=C_MUTE,
                 font=(_UI, 9)).pack(side=tk.LEFT, padx=(10, 0))

        rf = tk.Frame(inner, bg=C_DEEP)
        rf.pack(side=tk.RIGHT)
        self.status_badge = tk.Label(rf, textvariable=self.status_var,
            bg=C_LINE, fg=C_GOLD, font=(_UI, 9, "bold"), padx=12, pady=3)
        self.status_badge.pack(side=tk.RIGHT, padx=(8, 0))
        tk.Label(rf, text=f"F5  진단 시작  ·  {platform.system()} {platform.release()}",
                 bg=C_DEEP, fg=C_MUTE, font=(_UI, 8)).pack(side=tk.RIGHT)

    # ── 왼쪽 패널 ────────────────────────────────────────────────────────────
    def _build_left(self, parent):
        sf = ScrollableFrame(parent, bg=C_CARD)
        sf.pack(fill=tk.BOTH, expand=True)
        p = sf.inner

        # ── GUIDE ───────────────────────────────────────────────────────────
        self._shdr(p, "GUIDE")
        gf = tk.Frame(p, bg=C_CARD); gf.pack(fill=tk.X, padx=16, pady=(2, 8))
        self.guide_btns = {}
        guide_defs = [
            ("sk",  "SK Shieldus 표준",      "SK 내부 보안 가이드라인"),
            ("jtk", "주요정보통신기반시설",   "주통기 2026 개정 반영"),
        ]
        for val, label, tooltip in guide_defs:
            b = tk.Button(gf, text=label, bg=C_LINE, fg=C_SUB,
                          relief=tk.FLAT, font=(_UI, 9), padx=10, pady=6,
                          cursor="hand2", command=lambda v=val: self._set_guide(v))
            b.pack(side=tk.LEFT, padx=(0, 4))
            self.guide_btns[val] = b
        self._guide_hint = tk.Label(gf, text="SK 내부 보안 가이드라인",
                                    bg=C_CARD, fg=C_MUTE, font=(_UI, 8))
        self._guide_hint.pack(side=tk.LEFT, padx=(6, 0))
        self._set_guide("sk")   # 초기값 적용

        # ── TARGET ──────────────────────────────────────────────────────────
        tk.Frame(p, bg=C_LINE, height=1).pack(fill=tk.X, pady=(0, 0))
        self._shdr(p, "TARGET")
        self._field(p, "진단 대상 호스트  (리포트 표시용)", self.target)

        # ── MODULE ──────────────────────────────────────────────────────────
        tk.Frame(p, bg=C_LINE, height=1).pack(fill=tk.X, pady=(4, 0))
        self._shdr(p, "MODULE")
        self._build_mod_list(p)

        # ── OPTIONS ─────────────────────────────────────────────────────────
        tk.Frame(p, bg=C_LINE, height=1).pack(fill=tk.X, pady=(4, 0))
        self._shdr(p, "OPTIONS")
        self.opt_box = tk.Frame(p, bg=C_CARD)
        self.opt_box.pack(fill=tk.X)
        self._build_opts()

        # ── REPORT ──────────────────────────────────────────────────────────
        tk.Frame(p, bg=C_LINE, height=1).pack(fill=tk.X, pady=(4, 0))
        self._shdr(p, "REPORT FORMAT")
        rr = tk.Frame(p, bg=C_CARD)
        rr.pack(fill=tk.X, padx=16, pady=(4, 2))
        for var, lbl in [(self.rpt_excel, "Excel (.xlsx)"), (self.rpt_md, "Markdown (.md)")]:
            ttk.Checkbutton(rr, text=lbl, variable=var).pack(side=tk.LEFT, padx=(0, 14))
        _lbl(p, "  ※ 로그(.txt)는 항상 자동 저장", C_CARD, C_MUTE, 8).pack(anchor=tk.W, padx=16, pady=(0, 12))

        # ── RUN BUTTON (fixed bottom) ────────────────────────────────────────
        bot = tk.Frame(parent, bg=C_DEEP)
        bot.pack(fill=tk.X, side=tk.BOTTOM)
        tk.Frame(bot, bg=C_LINE, height=1).pack(fill=tk.X)
        self.run_btn = tk.Button(bot, text="▶  진단 시작  (F5)",
            bg=C_GOLD, fg=C_BG, relief=tk.FLAT, font=(_UI, 12, "bold"),
            pady=13, cursor="hand2",
            activebackground=C_GOLD2, activeforeground=C_BG,
            command=self._start_scan)
        self.run_btn.pack(fill=tk.X)

        self._on_mod()

    # ── Section helpers ───────────────────────────────────────────────────────
    def _shdr(self, parent, text):
        row = tk.Frame(parent, bg=C_CARD)
        row.pack(fill=tk.X, padx=16, pady=(10, 4))
        tk.Label(row, text=text, bg=C_CARD, fg=C_GOLD,
                 font=(_UI, 8, "bold")).pack(side=tk.LEFT)
        tk.Frame(row, bg=C_LINE, height=1).pack(side=tk.LEFT, fill=tk.X,
                                                 expand=True, padx=(8, 0))

    def _field(self, parent, label, var, show=None, bg=C_CARD, w=32):
        tk.Label(parent, text=label, bg=bg, fg=C_SUB,
                 font=(_UI, 8)).pack(anchor=tk.W, padx=16, pady=(4, 1))
        kw = dict(textvariable=var, width=w)
        if show: kw["show"] = show
        ttk.Entry(parent, **kw).pack(fill=tk.X, padx=16, pady=(0, 4))

    # ── Connection frames ────────────────────────────────────────────────────
    def _make_f_local(self):
        f = tk.Frame(self.conn_detail, bg=C_CARD)
        _lbl(f, "  현재 시스템에서 직접 진단합니다.", C_CARD, C_MUTE, 8
             ).pack(anchor=tk.W, padx=16, pady=(2, 8))
        return f

    def _make_f_ssh(self):
        f = tk.Frame(self.conn_detail, bg=C_CARD)
        row = tk.Frame(f, bg=C_CARD); row.pack(fill=tk.X, padx=16, pady=(4, 0))
        hf = tk.Frame(row, bg=C_CARD); hf.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0,6))
        tk.Label(hf, text="호스트 / IP", bg=C_CARD, fg=C_SUB, font=(_UI,8)).pack(anchor=tk.W)
        ttk.Entry(hf, textvariable=self.ssh_host).pack(fill=tk.X)
        pf = tk.Frame(row, bg=C_CARD); pf.pack(side=tk.LEFT, padx=(0,6))
        tk.Label(pf, text="포트", bg=C_CARD, fg=C_SUB, font=(_UI,8)).pack(anchor=tk.W)
        ttk.Entry(pf, textvariable=self.ssh_port, width=7).pack()
        uf = tk.Frame(row, bg=C_CARD); uf.pack(side=tk.LEFT)
        tk.Label(uf, text="사용자명", bg=C_CARD, fg=C_SUB, font=(_UI,8)).pack(anchor=tk.W)
        ttk.Entry(uf, textvariable=self.ssh_user, width=13).pack()

        tk.Label(f, text="인증 방식", bg=C_CARD, fg=C_SUB,
                 font=(_UI,8)).pack(anchor=tk.W, padx=16, pady=(6,2))
        ar = tk.Frame(f, bg=C_CARD); ar.pack(anchor=tk.W, padx=16)
        for v, l in [("key","🔑 PEM 키"), ("pwd","🔒 패스워드")]:
            ttk.Radiobutton(ar, text=l, variable=self.ssh_auth, value=v,
                            command=self._on_auth).pack(side=tk.LEFT, padx=(0,12))

        self.f_pem = tk.Frame(f, bg=C_CARD)
        tk.Label(self.f_pem, text="PEM 키 파일", bg=C_CARD, fg=C_SUB,
                 font=(_UI,8)).pack(anchor=tk.W, padx=16, pady=(4,1))
        pr = tk.Frame(self.f_pem, bg=C_CARD); pr.pack(fill=tk.X, padx=16)
        ttk.Entry(pr, textvariable=self.ssh_key).pack(side=tk.LEFT, fill=tk.X, expand=True)
        ttk.Button(pr, text="찾기", width=5,
                   command=self._browse_pem).pack(side=tk.LEFT, padx=(4,0))

        self.f_spwd = tk.Frame(f, bg=C_CARD)
        self._field(self.f_spwd, "패스워드", self.ssh_pass, show="●", bg=C_CARD)

        # 원격 Docker 옵션
        tk.Frame(f, bg=C_LINE, height=1).pack(fill=tk.X, padx=16, pady=(8, 0))
        tk.Label(f, text="DOCKER  (선택 — EC2 안의 컨테이너 진단 시)", bg=C_CARD,
                 fg=C_GOLD, font=(_UI, 7, "bold")).pack(anchor=tk.W, padx=16, pady=(6, 1))
        self._field(f, "컨테이너 이름 / ID  (비워두면 EC2 직접 진단)", self.ssh_docker_ctn)
        tk.Frame(f, bg=C_CARD, height=4).pack()
        return f

    def _make_f_ssm(self):
        f = tk.Frame(self.conn_detail, bg=C_CARD)
        self._field(f, "EC2 인스턴스 ID", self.ssm_id)
        self._field(f, "AWS 리전", self.ssm_region)
        tk.Label(f, text="자격 증명", bg=C_CARD, fg=C_SUB,
                 font=(_UI,8)).pack(anchor=tk.W, padx=16, pady=(4,2))
        for v, l in [("1","🔑 IAM 키 입력"), ("2","🔄 환경변수 / ~/.aws")]:
            ttk.Radiobutton(f, text=l, variable=self.ssm_cred, value=v,
                            command=self._on_any_cred).pack(anchor=tk.W, padx=16)
        self.f_ssm_key = tk.Frame(f, bg=C_DEEP)
        ki = tk.Frame(self.f_ssm_key, bg=C_DEEP); ki.pack(fill=tk.X, padx=8, pady=4)
        self._field(ki, "Access Key ID",        self.ssm_ak,  bg=C_DEEP)
        self._field(ki, "Secret Access Key",    self.ssm_sk,  show="●", bg=C_DEEP)
        self._field(ki, "Session Token (선택)", self.ssm_tok, show="●", bg=C_DEEP)
        tk.Label(f, text="대상 OS", bg=C_CARD, fg=C_SUB,
                 font=(_UI,8)).pack(anchor=tk.W, padx=16, pady=(6,2))
        or_ = tk.Frame(f, bg=C_CARD); or_.pack(anchor=tk.W, padx=16)
        for v, l in [("linux","🐧 Linux"), ("windows","🪟 Windows")]:
            ttk.Radiobutton(or_, text=l, variable=self.ssm_os,
                            value=v).pack(side=tk.LEFT, padx=(0,10))

        # 원격 Docker 옵션
        tk.Frame(f, bg=C_LINE, height=1).pack(fill=tk.X, padx=16, pady=(8, 0))
        tk.Label(f, text="DOCKER  (선택 — EC2 안의 컨테이너 진단 시)", bg=C_CARD,
                 fg=C_GOLD, font=(_UI, 7, "bold")).pack(anchor=tk.W, padx=16, pady=(6, 1))
        self._field(f, "컨테이너 이름 / ID  (비워두면 EC2 직접 진단)", self.ssm_docker_ctn)
        tk.Frame(f, bg=C_CARD, height=4).pack()
        return f

    def _make_f_docker(self):
        f = tk.Frame(self.conn_detail, bg=C_CARD)
        self._field(f, "컨테이너 이름 또는 ID", self.docker_ctn)
        _lbl(f, "  ※ 로컬에 docker CLI가 실행 중이어야 합니다.", C_CARD, C_MUTE, 8
             ).pack(anchor=tk.W, padx=16, pady=(0, 8))
        return f

    def _set_conn(self, val):
        self.conn_mode.set(val)
        for k, b in self.conn_btns.items():
            if k == val: b.configure(bg=C_GOLD, fg=C_BG, font=(_UI,9,"bold"))
            else:        b.configure(bg=C_LINE, fg=C_SUB, font=(_UI,9,"normal"))
        for f in (self.f_local, self.f_ssh, self.f_ssm, self.f_docker):
            f.pack_forget()
        {"1":self.f_local,"2":self.f_ssh,"3":self.f_ssm,"4":self.f_docker}[val].pack(fill=tk.X)
        if val == "2": self._on_auth()
        if val == "3": self._on_cred()

    def _on_auth(self):
        self.f_pem.pack_forget(); self.f_spwd.pack_forget()
        if self.ssh_auth.get() == "key": self.f_pem.pack(fill=tk.X)
        else: self.f_spwd.pack(fill=tk.X)

    def _on_cred(self):
        if self.ssm_cred.get() == "1": self.f_ssm_key.pack(fill=tk.X, padx=16, pady=4)
        else: self.f_ssm_key.pack_forget()

    # ── Guide selection ───────────────────────────────────────────────────────
    def _set_guide(self, val):
        global MODULES
        self.guide_key.set(val)
        hints = {
            "sk":  "SK 내부 보안 가이드라인",
            "jtk": "주통기 2026 개정 반영",
        }
        active_modules = _MODULES_SK if val == "sk" else _MODULES_JTK
        MODULES = active_modules
        for k, b in self.guide_btns.items():
            if k == val: b.configure(bg=C_GOLD, fg=C_BG, font=(_UI, 9, "bold"))
            else:        b.configure(bg=C_LINE, fg=C_SUB, font=(_UI, 9, "normal"))
        self._guide_hint.config(text=hints.get(val, ""))
        # 모듈 설명 텍스트 업데이트
        if hasattr(self, "mod_rows"):
            for k, (row, bar, inner, top, tl, nl, dl) in self.mod_rows.items():
                if k in active_modules:
                    dl.config(text=active_modules[k]["desc"])

    # ── Module list ───────────────────────────────────────────────────────────
    def _build_mod_list(self, parent):
        self.mod_rows = {}
        for k, info in MODULES.items():
            row   = tk.Frame(parent, bg=C_CARD, cursor="hand2")
            row.pack(fill=tk.X)
            bar   = tk.Frame(row, bg=C_CARD, width=3); bar.pack(side=tk.LEFT, fill=tk.Y)
            inner = tk.Frame(row, bg=C_CARD);           inner.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(10,12), pady=7)
            top   = tk.Frame(inner, bg=C_CARD);         top.pack(fill=tk.X)
            tag_l = tk.Label(top, text=f" {info['tag']} ", bg=C_LINE, fg=C_SUB, font=(_MONO,7,"bold"), padx=2)
            tag_l.pack(side=tk.LEFT, padx=(0,7))
            nam_l = tk.Label(top, text=info["name"], bg=C_CARD, fg=C_FG, font=(_UI,9,"bold"))
            nam_l.pack(side=tk.LEFT)
            des_l = tk.Label(inner, text=info["desc"], bg=C_CARD, fg=C_MUTE,
                             font=(_UI,8), anchor=tk.W, wraplength=310, justify=tk.LEFT)
            des_l.pack(anchor=tk.W)
            tk.Frame(parent, bg=C_LINE, height=1).pack(fill=tk.X)

            widgets = [row, bar, inner, top, tag_l, nam_l, des_l]
            for w in widgets:
                w.bind("<Button-1>", lambda e, v=k: self._sel_mod(v))
                w.bind("<Enter>",    lambda e, r=row,b=bar,i=inner,t=top,tl=tag_l,nl=nam_l,dl=des_l,v=k: self._mod_hi(r,b,i,t,tl,nl,dl,True,v))
                w.bind("<Leave>",    lambda e, r=row,b=bar,i=inner,t=top,tl=tag_l,nl=nam_l,dl=des_l,v=k: self._mod_hi(r,b,i,t,tl,nl,dl,False,v))
            self.mod_rows[k] = (row, bar, inner, top, tag_l, nam_l, des_l)
        self._sel_mod("1")

    def _sel_mod(self, val):
        self.mod_key.set(val)
        for k, (row,bar,inner,top,tl,nl,dl) in self.mod_rows.items():
            if k == val:
                for w,bg in [(row,C_DEEP),(bar,C_CARD),(inner,C_DEEP),(top,C_DEEP),(nl,C_DEEP),(dl,C_DEEP)]: w.config(bg=bg)
                bar.config(bg=C_GOLD, width=3); tl.config(bg=C_GOLD, fg=C_BG)
                nl.config(fg=C_GOLD); dl.config(fg=C_SUB)
            else:
                for w in (row,bar,inner,top,tl,nl,dl): w.config(bg=C_CARD)
                bar.config(width=3); tl.config(bg=C_LINE, fg=C_SUB)
                nl.config(fg=C_FG); dl.config(fg=C_MUTE)
        self._on_mod()

    def _mod_hi(self, row, bar, inner, top, tl, nl, dl, enter, key):
        if key == self.mod_key.get(): return
        bg = C_LINE if enter else C_CARD
        for w in (row, inner, top, nl, dl): w.config(bg=bg)
        tl.config(bg=C_LINE2 if enter else C_LINE)

    # ── Module options ────────────────────────────────────────────────────────
    def _build_opts(self):
        # ── SHARED CONNECTION BLOCK (for modules 1-5 / Oracle server) ──────
        self.conn_block = tk.Frame(self.opt_box, bg=C_CARD)

        conn_hdr = tk.Frame(self.conn_block, bg=C_CARD)
        conn_hdr.pack(fill=tk.X, padx=16, pady=(10, 4))
        tk.Label(conn_hdr, text="연결 방법", bg=C_CARD, fg=C_GOLD,
                 font=(_UI, 8, "bold")).pack(side=tk.LEFT)
        tk.Frame(conn_hdr, bg=C_LINE, height=1).pack(side=tk.LEFT, fill=tk.X,
                                                      expand=True, padx=(8, 0))

        conn_btn_row = tk.Frame(self.conn_block, bg=C_CARD)
        conn_btn_row.pack(fill=tk.X, padx=16, pady=(4, 6))
        self.conn_btns = {}
        for val, label in [("1", "로컬"), ("2", "SSH"), ("3", "AWS SSM"), ("4", "Docker")]:
            b = tk.Button(conn_btn_row, text=label, bg=C_LINE, fg=C_SUB,
                          relief=tk.FLAT, font=(_UI, 9), padx=12, pady=6,
                          cursor="hand2", command=lambda v=val: self._set_conn(v))
            b.pack(side=tk.LEFT, padx=(0, 3))
            self.conn_btns[val] = b

        self.conn_detail = tk.Frame(self.conn_block, bg=C_CARD)
        self.conn_detail.pack(fill=tk.X)
        self.f_local  = self._make_f_local()
        self.f_ssh    = self._make_f_ssh()
        self.f_ssm    = self._make_f_ssm()
        self.f_docker = self._make_f_docker()

        self._set_conn("1")

        self.opt_frames = {}
        for k in ("1","2","4"):
            f = tk.Frame(self.opt_box, bg=C_CARD)
            _lbl(f, "추가 옵션 없음", C_CARD, C_MUTE, 8).pack(anchor=tk.W, padx=16, pady=(4,8))
            self.opt_frames[k] = f

        # Nginx
        f3 = tk.Frame(self.opt_box, bg=C_CARD)
        tk.Label(f3, text="nginx.conf 경로  (비워두면 자동 탐색)", bg=C_CARD, fg=C_SUB,
                 font=(_UI,8)).pack(anchor=tk.W, padx=16, pady=(4,1))
        nr = tk.Frame(f3, bg=C_CARD); nr.pack(fill=tk.X, padx=16, pady=(0,6))
        ttk.Entry(nr, textvariable=self.nginx_conf).pack(side=tk.LEFT, fill=tk.X, expand=True)
        ttk.Button(nr, text="찾기", width=5, command=lambda: self._browse_file(
            self.nginx_conf,"nginx.conf",[("conf","*.conf"),("모든 파일","*.*")]
        )).pack(side=tk.LEFT, padx=(4,0))
        self.opt_frames["3"] = f3

        # DBMS
        f5 = tk.Frame(self.opt_box, bg=C_CARD)
        tk.Label(f5, text="DB 종류", bg=C_CARD, fg=C_SUB, font=(_UI,8)).pack(anchor=tk.W, padx=16, pady=(4,2))
        dr = tk.Frame(f5, bg=C_CARD); dr.pack(anchor=tk.W, padx=16)
        for v, l in [("mysql","MySQL"),("postgresql","PostgreSQL"),("mssql","MSSQL")]:
            ttk.Radiobutton(dr, text=l, variable=self.db_type, value=v,
                            command=self._on_dbtype).pack(side=tk.LEFT, padx=(0,8))
        self._field(f5, "포트",                              self.db_port)
        self._field(f5, "접속 계정  (비워두면 네트워크 점검만)", self.db_user)
        self._field(f5, "패스워드",                           self.db_pass, show="●")
        self.opt_frames["5"] = f5

        # Oracle
        f6 = tk.Frame(self.opt_box, bg=C_CARD)
        tk.Label(f6, text="배포 유형", bg=C_CARD, fg=C_SUB, font=(_UI,8)).pack(anchor=tk.W, padx=16, pady=(4,2))
        dpr = tk.Frame(f6, bg=C_CARD); dpr.pack(anchor=tk.W, padx=16)
        for v, l in [("server","서버"),("docker","Docker"),("rds","AWS RDS")]:
            ttk.Radiobutton(dpr, text=l, variable=self.ora_deploy,
                            value=v, command=self._on_ora_deploy).pack(side=tk.LEFT, padx=(0,8))

        # ── RDS 전용 패널 (RDS 선택 시 표시) ────────────────────────
        self.f_rds_guide = tk.Frame(f6, bg=C_DEEP)
        gi = tk.Frame(self.f_rds_guide, bg=C_DEEP); gi.pack(fill=tk.X, padx=14, pady=8)

        # 제목
        th = tk.Frame(gi, bg=C_DEEP); th.pack(fill=tk.X, pady=(0,4))
        tk.Label(th, text="⚡", bg=C_DEEP, fg=C_GOLD, font=(_UI,11)).pack(side=tk.LEFT)
        tk.Label(th, text="  AWS RDS  ·  SSM 포트 포워딩 자동화", bg=C_DEEP, fg=C_GOLD,
                 font=(_UI,9,"bold")).pack(side=tk.LEFT)

        # ── SSM 터널 접속 설정 ─────────────────────────────────────
        tk.Label(gi, text="SSM 터널 접속 설정", bg=C_DEEP, fg=C_GOLD,
                 font=(_UI, 8, "bold")).pack(anchor=tk.W, pady=(0, 4))
        self._field(gi, "EC2 인스턴스 ID", self.ssm_id, bg=C_DEEP)
        self._field(gi, "AWS 리전", self.ssm_region, bg=C_DEEP)
        tk.Label(gi, text="자격 증명", bg=C_DEEP, fg=C_SUB,
                 font=(_UI, 8)).pack(anchor=tk.W, pady=(4, 2))
        for v2, l2 in [("1", "🔑 IAM 키 입력"), ("2", "🔄 환경변수 / ~/.aws")]:
            ttk.Radiobutton(gi, text=l2, variable=self.ssm_cred, value=v2,
                            command=self._on_any_cred).pack(anchor=tk.W)
        self.f_rds_ssm_key = tk.Frame(gi, bg=C_DEEP)
        rki = tk.Frame(self.f_rds_ssm_key, bg=C_DEEP); rki.pack(fill=tk.X, pady=4)
        self._field(rki, "Access Key ID",        self.ssm_ak,  bg=C_DEEP)
        self._field(rki, "Secret Access Key",    self.ssm_sk,  show="●", bg=C_DEEP)
        self._field(rki, "Session Token (선택)", self.ssm_tok, show="●", bg=C_DEEP)

        tk.Frame(gi, bg=C_LINE2, height=1).pack(fill=tk.X, pady=(8, 0))
        tk.Label(gi, text="RDS Oracle 접속 설정", bg=C_DEEP, fg=C_GOLD,
                 font=(_UI, 8, "bold")).pack(anchor=tk.W, pady=(6, 4))

        # ── 입력 필드 ──────────────────────────────────────────────
        self._field(gi, "RDS 엔드포인트  (실제 RDS 호스트명)", self.ora_rds_ep, bg=C_DEEP)

        pr = tk.Frame(gi, bg=C_DEEP); pr.pack(fill=tk.X)
        lf = tk.Frame(pr, bg=C_DEEP); lf.pack(side=tk.LEFT, padx=(0,8), fill=tk.X, expand=True)
        tk.Label(lf, text="RDS 포트", bg=C_DEEP, fg=C_SUB, font=(_UI,8)).pack(anchor=tk.W, pady=(4,1))
        ttk.Entry(lf, textvariable=self.ora_port, width=9).pack(anchor=tk.W)
        rf2 = tk.Frame(pr, bg=C_DEEP); rf2.pack(side=tk.LEFT, fill=tk.X, expand=True)
        tk.Label(rf2, text="로컬 포워딩 포트", bg=C_DEEP, fg=C_SUB, font=(_UI,8)).pack(anchor=tk.W, pady=(4,1))
        ttk.Entry(rf2, textvariable=self.ora_local_port, width=9).pack(anchor=tk.W)

        self._field(gi, "서비스명 / SID", self.ora_svc, bg=C_DEEP)
        self._field(gi, "접속 계정", self.ora_user, bg=C_DEEP)
        self._field(gi, "DB 패스워드", self.ora_pass, show="●", bg=C_DEEP)

        # ── 자동 터널 옵션 ──────────────────────────────────────────
        tk.Frame(gi, bg=C_LINE2, height=1).pack(fill=tk.X, pady=(8,0))
        ar = tk.Frame(gi, bg=C_DEEP); ar.pack(fill=tk.X, pady=(6,4))
        ttk.Checkbutton(ar, text="진단 시작 시 SSM 터널 자동 시작  (aws cli 필요)",
                        variable=self.ora_auto_tunnel,
                        command=self._on_auto_tunnel).pack(anchor=tk.W)
        self.f_auto_info = tk.Frame(gi, bg=C_DEEP)
        tk.Label(self.f_auto_info,
                 text="  ✓  터널 연결 확인 후 자동으로 DB 진단 시작\n"
                      "  ✓  진단 완료 후 터널 자동 종료",
                 bg=C_DEEP, fg=C_TEAL, font=(_UI,8), justify=tk.LEFT).pack(anchor=tk.W)
        self.f_auto_info.pack(fill=tk.X)

        # ── 명령어 미리보기 ────────────────────────────────────────
        tk.Frame(gi, bg=C_LINE2, height=1).pack(fill=tk.X, pady=(6,0))
        tk.Label(gi, text="생성된 SSM 명령어  (참고용 / 자동 실행됨)",
                 bg=C_DEEP, fg=C_SUB, font=(_UI,7,"bold")).pack(anchor=tk.W, pady=(6,2))
        cmd_box = tk.Frame(gi, bg=C_LINE); cmd_box.pack(fill=tk.X)
        self.rds_cmd_txt = tk.Text(cmd_box, bg=C_LINE, fg=C_SUB,
                                   font=(_MONO,7), height=5,
                                   relief=tk.FLAT, padx=10, pady=6,
                                   state=tk.DISABLED, wrap=tk.NONE)
        self.rds_cmd_txt.pack(fill=tk.X)
        br = tk.Frame(gi, bg=C_DEEP); br.pack(fill=tk.X, pady=(4,0))
        tk.Button(br, text="📋 복사", bg=C_LINE, fg=C_TEAL, relief=tk.FLAT,
                  font=(_UI,8), padx=8, pady=3, cursor="hand2",
                  activebackground=C_LINE2, command=self._copy_rds_cmd).pack(side=tk.LEFT)
        self.tunnel_status_lbl = tk.Label(br, text="", bg=C_DEEP, fg=C_MUTE, font=(_UI,8))
        self.tunnel_status_lbl.pack(side=tk.LEFT, padx=(10,0))

        self._update_rds_cmd()

        # ── 비-RDS 공통 DB 접속 필드 (server/docker용) ───────────
        self.f_nonrds = tk.Frame(f6, bg=C_CARD)
        self._field(self.f_nonrds, "DB 호스트 / IP", self.ora_host, bg=C_CARD)
        ph = tk.Frame(self.f_nonrds, bg=C_CARD); ph.pack(fill=tk.X, padx=16)
        pf2 = tk.Frame(ph, bg=C_CARD); pf2.pack(side=tk.LEFT, padx=(0,8))
        tk.Label(pf2, text="포트", bg=C_CARD, fg=C_SUB, font=(_UI,8)).pack(anchor=tk.W, pady=(4,1))
        ttk.Entry(pf2, textvariable=self.ora_port, width=9).pack()
        sf2 = tk.Frame(ph, bg=C_CARD); sf2.pack(side=tk.LEFT)
        tk.Label(sf2, text="서비스명/SID", bg=C_CARD, fg=C_SUB, font=(_UI,8)).pack(anchor=tk.W, pady=(4,1))
        ttk.Entry(sf2, textvariable=self.ora_svc, width=16).pack()
        self._field(self.f_nonrds, "접속 계정",  self.ora_user, bg=C_CARD)
        self._field(self.f_nonrds, "DB 패스워드", self.ora_pass, show="●", bg=C_CARD)

        self.opt_frames["6"] = f6

        # AWS Cloud
        f7 = tk.Frame(self.opt_box, bg=C_CARD)
        self._field(f7, "AWS 리전", self.aws_region)

        tk.Label(f7, text="자격 증명", bg=C_CARD, fg=C_SUB,
                 font=(_UI, 8)).pack(anchor=tk.W, padx=16, pady=(6, 2))
        for v7, l7 in [(False, "🔑 IAM 키 직접 입력"), (True, "🔄 환경변수 / ~/.aws 사용")]:
            ttk.Radiobutton(f7, text=l7, variable=self.aws_use_ssm, value=v7,
                            command=self._on_aws_cred).pack(anchor=tk.W, padx=16)

        self.f_aws_key = tk.Frame(f7, bg=C_DEEP)
        ki7 = tk.Frame(self.f_aws_key, bg=C_DEEP); ki7.pack(fill=tk.X, padx=8, pady=4)
        self._field(ki7, "Access Key ID",        self.aws_ak,  bg=C_DEEP)
        self._field(ki7, "Secret Access Key",    self.aws_sk,  show="●", bg=C_DEEP)
        self._field(ki7, "Session Token (선택)", self.aws_tok, show="●", bg=C_DEEP)

        self.opt_frames["7"] = f7
        self._on_aws_cred()

    def _on_aws_cred(self):
        if not hasattr(self, "f_aws_key"): return
        if self.aws_use_ssm.get():
            self.f_aws_key.pack_forget()
        else:
            self.f_aws_key.pack(fill=tk.X, padx=16, pady=4)

    def _on_any_cred(self):
        """SSM 자격증명 변경 시 모든 관련 키 패널 갱신"""
        self._on_cred()
        self._on_rds_cred()

    def _on_rds_cred(self):
        """RDS 패널 내 SSM 키 필드 표시/숨김"""
        if not hasattr(self, "f_rds_ssm_key"): return
        if self.ssm_cred.get() == "1":
            self.f_rds_ssm_key.pack(fill=tk.X, pady=4)
        else:
            self.f_rds_ssm_key.pack_forget()

    def _on_mod(self):
        if not hasattr(self, "opt_frames"): return
        k = self.mod_key.get()
        for f in self.opt_frames.values(): f.pack_forget()
        if hasattr(self, "conn_block"):
            if k in ("1", "2", "3", "4", "5"):
                self.conn_block.pack(fill=tk.X)
            else:
                self.conn_block.pack_forget()
        if k in self.opt_frames: self.opt_frames[k].pack(fill=tk.X)
        if k == "6": self._on_ora_deploy()
        self.root.after(50, self._rebind_all_scrollframes)

    def _on_ora_deploy(self):
        if not hasattr(self, "f_rds_guide"): return
        deploy    = self.ora_deploy.get()
        is_rds    = deploy == "rds"
        is_server = deploy == "server"
        # 서버 모드: 연결 방법 블록 표시 (SSH/SSM/로컬 선택 필요)
        if hasattr(self, "conn_block"):
            if is_server:
                self.conn_block.pack(fill=tk.X, before=self.opt_frames["6"])
            else:
                self.conn_block.pack_forget()
        if is_rds:
            self._update_rds_cmd()
            self._on_rds_cred()
            self.f_rds_guide.pack(fill=tk.X, pady=(4, 0))
            self.f_nonrds.pack_forget()
        else:
            self.f_rds_guide.pack_forget()
            self.f_nonrds.pack(fill=tk.X)
        self.root.after(50, self._rebind_all_scrollframes)

    def _on_auto_tunnel(self):
        if not hasattr(self, "f_auto_info"): return
        if self.ora_auto_tunnel.get():
            self.f_auto_info.pack(fill=tk.X)
        else:
            self.f_auto_info.pack_forget()

    def _update_rds_cmd(self):
        if not hasattr(self, "rds_cmd_txt"): return
        iid    = self.ssm_id.get().strip()        or "i-xxxxxxxxxxxxxxxxx"
        region = self.ssm_region.get().strip()    or "ap-northeast-2"
        ep     = self.ora_rds_ep.get().strip()    or "your-rds.rds.amazonaws.com"
        port   = self.ora_port.get().strip()      or "1521"
        local  = self.ora_local_port.get().strip() or "11521"
        cmd = (
            f"aws ssm start-session \\\n"
            f"    --region {region} \\\n"
            f"    --target {iid} \\\n"
            f"    --document-name AWS-StartPortForwardingSessionToRemoteHost \\\n"
            f"    --parameters "
            f"'{{\"host\":[\"{ep}\"],"
            f"\"portNumber\":[\"{port}\"],"
            f"\"localPortNumber\":[\"{local}\"]}}'")
        self.rds_cmd_txt.config(state=tk.NORMAL)
        self.rds_cmd_txt.delete("1.0", tk.END)
        self.rds_cmd_txt.insert("1.0", cmd)
        self.rds_cmd_txt.config(state=tk.DISABLED)

    def _copy_rds_cmd(self):
        cmd = self.rds_cmd_txt.get("1.0", tk.END).strip()
        self.root.clipboard_clear()
        self.root.clipboard_append(cmd)
        messagebox.showinfo("복사 완료", "명령어가 클립보드에 복사되었습니다.")

    def _rebind_all_scrollframes(self):
        """모든 ScrollableFrame의 스크롤 바인딩을 갱신"""
        def find_sf(w):
            if isinstance(w, ScrollableFrame):
                w._rebind_children()
            for c in w.winfo_children():
                find_sf(c)
        find_sf(self.root)

    def _on_dbtype(self):
        self.db_port.set({"mysql":"3306","postgresql":"5432","mssql":"1433"}.get(
            self.db_type.get(), "3306"))

    # ── 오른쪽 패널 ───────────────────────────────────────────────────────────
    def _build_right(self, parent):
        tb = tk.Frame(parent, bg=C_DEEP); tb.pack(fill=tk.X)
        _lbl(tb, "  SCAN OUTPUT", C_DEEP, C_GOLD, 9, "bold").pack(side=tk.LEFT, pady=8)
        self.progress = ttk.Progressbar(tb, mode="indeterminate", length=100)
        tk.Button(tb, text="CLEAR", bg=C_DEEP, fg=C_MUTE, relief=tk.FLAT,
                  padx=10, pady=4, cursor="hand2", font=(_UI,8,"bold"),
                  activebackground=C_LINE, activeforeground=C_FG,
                  command=self._clear).pack(side=tk.RIGHT, padx=(0,8))
        self.stop_btn = tk.Button(tb, text="⏹  중단", bg=C_DEEP, fg=C_RED,
                  relief=tk.FLAT, padx=10, pady=4, cursor="hand2",
                  font=(_UI,8,"bold"), state=tk.DISABLED,
                  activebackground=C_LINE, activeforeground=C_RED,
                  command=self._request_stop)
        self.stop_btn.pack(side=tk.RIGHT)
        tk.Frame(parent, bg=C_LINE, height=1).pack(fill=tk.X)

        tf = tk.Frame(parent, bg=C_BG); tf.pack(fill=tk.BOTH, expand=True)
        self.txt = tk.Text(tf, wrap=tk.NONE, font=(_MONO, 10),
                           bg=C_BG, fg=C_FG, insertbackground=C_FG,
                           selectbackground=C_LINE2, selectforeground=C_FG,
                           state=tk.DISABLED, relief=tk.FLAT,
                           padx=16, pady=12, spacing1=1, spacing3=1)
        vsb = ttk.Scrollbar(tf, orient=tk.VERTICAL,   command=self.txt.yview)
        hsb = ttk.Scrollbar(tf, orient=tk.HORIZONTAL, command=self.txt.xview)
        self.txt.configure(yscrollcommand=vsb.set, xscrollcommand=hsb.set)
        vsb.pack(side=tk.RIGHT,  fill=tk.Y)
        hsb.pack(side=tk.BOTTOM, fill=tk.X)
        self.txt.pack(fill=tk.BOTH, expand=True)

        self.txt.tag_config("vuln",   foreground=C_RED)
        self.txt.tag_config("safe",   foreground=C_GREEN)
        self.txt.tag_config("warn",   foreground=C_WARN)
        self.txt.tag_config("info",   foreground=C_BLUE)
        self.txt.tag_config("gold",   foreground=C_GOLD)
        self.txt.tag_config("teal",   foreground=C_TEAL)
        self.txt.tag_config("mute",   foreground=C_MUTE)
        self.txt.tag_config("normal", foreground=C_FG)

        self._build_summary(parent)

    def _build_summary(self, parent):
        bar = tk.Frame(parent, bg=C_DEEP); bar.pack(fill=tk.X, side=tk.BOTTOM)
        tk.Frame(bar, bg=C_LINE, height=1).pack(fill=tk.X)
        inner = tk.Frame(bar, bg=C_DEEP); inner.pack(fill=tk.X, padx=14, pady=8)

        self.stat_lbl = {}
        for key, label, color in [
            ("total","TOTAL",C_FG), ("vuln","VULN",C_RED),
            ("safe","SAFE",C_GREEN), ("review","REVIEW",C_WARN), ("na","N/A",C_MUTE),
        ]:
            sf = tk.Frame(inner, bg=C_DEEP); sf.pack(side=tk.LEFT, padx=(0,22))
            _lbl(sf, label, C_DEEP, C_MUTE, 7, "bold").pack()
            v = _lbl(sf, "—", C_DEEP, color, 15, "bold"); v.pack()
            self.stat_lbl[key] = v

        self.save_frame = tk.Frame(inner, bg=C_DEEP)
        for lbl, fmt in [("📊 Excel","excel"),("📝 Markdown","md"),("📋 Log","log")]:
            ttk.Button(self.save_frame, text=lbl, style="Save.TButton",
                       command=lambda f=fmt: self._save(f)).pack(side=tk.LEFT, padx=2)

        self.sev_lbl = _lbl(inner, "", C_DEEP, C_MUTE, 8)
        self.sev_lbl.pack(side=tk.RIGHT)

    # ── Output polling ────────────────────────────────────────────────────────
    def _poll_output(self):
        try:
            while True: self._append(self.output_q.get_nowait())
        except queue.Empty: pass
        self.root.after(40, self._poll_output)

    def _append(self, text):
        self.txt.config(state=tk.NORMAL)
        tl = text.lower()
        if   "[취약]"  in text:                              tag = "vuln"
        elif "[양호]"  in text:                              tag = "safe"
        elif "[검토]"  in text or "[ n/a]" in tl:           tag = "warn"
        elif text.strip().startswith(("✓","✔")):             tag = "teal"
        elif text.strip().startswith(("✗","[오류]")):        tag = "vuln"
        elif "─"*8 in text or "═"*8 in text:                tag = "mute"
        elif text.lstrip().startswith(("[*]","[!]","  →")): tag = "gold"
        else:                                                 tag = "normal"
        self.txt.insert(tk.END, text, tag)
        self.txt.see(tk.END)
        self.txt.config(state=tk.DISABLED)

    def _clear(self):
        self.txt.config(state=tk.NORMAL)
        self.txt.delete("1.0", tk.END)
        self.txt.config(state=tk.DISABLED)
        for l in self.stat_lbl.values(): l.config(text="—")
        self.save_frame.pack_forget()
        self.sev_lbl.config(text="")

    # ── Scan ──────────────────────────────────────────────────────────────────
    def _start_scan(self):
        if self.scan_thread and self.scan_thread.is_alive():
            messagebox.showwarning("진행 중", "이미 진단이 실행 중입니다."); return
        self._stop_event.clear()
        self.run_btn.config(state=tk.DISABLED, bg=C_MUTE)
        self.stop_btn.config(state=tk.NORMAL)
        self.status_var.set("SCANNING")
        self.status_badge.config(bg=C_GOLD, fg=C_BG)
        self.save_frame.pack_forget()
        self._clear()
        self._report = None
        self.progress.pack(side=tk.LEFT, padx=(8,0), pady=6)
        self.progress.start(10)
        self.scan_thread = threading.Thread(target=self._worker, daemon=True)
        self.scan_thread.start()

    def _request_stop(self):
        if messagebox.askyesno("진단 중단", "진단을 중단하시겠습니까?"):
            self._stop_event.set()
            self.stop_btn.config(state=tk.DISABLED)
            self.status_var.set("STOPPING")
            self.status_badge.config(bg=C_WARN, fg=C_BG)
            print("\n  [!] 중단 요청 — 현재 항목 완료 후 종료됩니다...")

    def _worker(self):
        old = sys.stdout; sys.stdout = StdoutQueue(self.output_q); executor = None
        try:
            executor = self._make_executor()
            # RDS + 자동 터널 시작
            if (self.mod_key.get() == "6" and
                    self.ora_deploy.get() == "rds" and
                    self.ora_auto_tunnel.get()):
                self._start_ssm_tunnel()
            opts     = self._make_opts(executor)
            k        = self.mod_key.get()
            active_mods = _MODULES_JTK if self.guide_key.get() == "jtk" else _MODULES_SK
            Cls      = active_mods[k]["loader"]()
            valid    = set(inspect.signature(Cls.__init__).parameters) - {"self"}
            scanner  = Cls(**{p: v for p, v in opts.items() if p in valid})
            scanner._stop_event = self._stop_event   # 중단 신호 주입
            report   = scanner.run()
            self._report = report

            saved = [f"로그: {reporter.save_log(report)}"]
            if self.rpt_excel.get(): saved.append(f"Excel: {reporter.save_excel(report)}")
            if self.rpt_md.get():    saved.append(f"Markdown: {reporter.save_markdown(report)}")
            print("\n" + "─"*60)
            print("  완료")
            for s in saved: print(f"  ✓ {s}")
            print("─"*60)
            self.root.after(0, lambda: self._on_done(report))
        except Exception as e:
            from core.base_scanner import StopScan
            if isinstance(e, StopScan):
                print("\n  ─── 진단 중단됨 ───")
                self.root.after(0, lambda: self._on_done(scanner.report
                    if 'scanner' in dir() else self._report or __import__('core.result', fromlist=['ScanReport']).ScanReport()))
            else:
                import traceback
                print(f"\n[오류] {e}\n{traceback.format_exc()}")
                self.root.after(0, lambda m=str(e): self._on_error(m))
        finally:
            sys.stdout = old
            if executor:
                try: executor.close()
                except: pass
            self._stop_ssm_tunnel()

    def _make_executor(self):
        m = self.conn_mode.get()
        if m == "1": return None
        if m == "2":
            h = self.ssh_host.get().strip()
            if not h: raise ValueError("SSH 호스트를 입력하세요.")
            port = int(self.ssh_port.get() or 22)
            user = self.ssh_user.get().strip() or "ec2-user"
            kp = pw = None
            if self.ssh_auth.get() == "key":
                k = self.ssh_key.get().strip()
                kp = os.path.expanduser(k) if k else None
            else:
                pw = self.ssh_pass.get() or None
            print(f"\n  → SSH 연결 중 ({user}@{h}:{port})...")
            from core.remote import SSHExecutor, RemoteDockerExecutor
            ex = SSHExecutor(h, port, user, kp, pw)
            print("  ✓ SSH 연결 성공")
            ctn = self.ssh_docker_ctn.get().strip()
            if ctn:
                rc, out, err = ex.run_shell(f"docker exec {ctn} echo OK", timeout=15)
                if rc != 0 or "OK" not in out:
                    raise RuntimeError(f"Docker 컨테이너 접근 실패: {err or '응답 없음'}\n"
                                       f"  → docker ps 로 컨테이너 상태 확인")
                ex = RemoteDockerExecutor(ex, ctn)
                print(f"  ✓ Docker 컨테이너 연결 성공  ({ctn})")
            print()
            return ex
        if m == "3":
            iid = self.ssm_id.get().strip()
            if not iid: raise ValueError("EC2 인스턴스 ID를 입력하세요.")
            region = self.ssm_region.get().strip() or "ap-northeast-2"
            ak = sk = tok = None
            if self.ssm_cred.get() == "1":
                ak  = self.ssm_ak.get().strip() or None
                sk  = self.ssm_sk.get() or None
                tok = self.ssm_tok.get() or None
            ost  = self.ssm_os.get()
            ping = "echo ssm_ok" if ost == "linux" else "Write-Output ssm_ok"
            print(f"\n  → SSM 연결 확인 중 ({iid} / {region} / {ost})...")
            from core.remote import SSMExecutor
            ex = SSMExecutor(iid, region, ak, sk, tok, platform=ost)
            try:
                rc, out, err = ex.run_shell(ping, timeout=60)
            except Exception as e:
                msg = str(e)
                if "InvalidInstanceId" in msg:
                    raise RuntimeError(
                        "SSM 연결 실패: 인스턴스를 찾을 수 없습니다.\n\n"
                        "  1) 인스턴스가 running 상태인지 확인\n"
                        "  2) SSM Agent 설치·실행 여부 확인\n"
                        "  3) IAM 역할에 AmazonSSMManagedInstanceCore 정책 부여\n"
                        f"  원본 오류: {msg}")
                raise RuntimeError(f"SSM 오류: {msg}")
            if rc != 0:
                # stdout/stderr 모두 비어 있으면 SSM Agent 지연 가능성 → 경고만
                if not out and not err:
                    print(f"  [경고] SSM 연결 테스트 실패 ({err}) — 계속 진행합니다.")
                else:
                    raise RuntimeError(
                        f"SSM 명령 실패 (exit {rc})\n"
                        f"  stdout: {out!r}\n"
                        f"  stderr: {err!r}\n\n"
                        "  → SSM Agent 상태, IAM 정책, 인스턴스 상태를 확인하세요.")
            else:
                print(f"  ✓ SSM 응답: {out!r}")
            print("  ✓ SSM 연결 성공")
            ctn = self.ssm_docker_ctn.get().strip()
            if ctn:
                rc2, out2, err2 = ex.run_shell(f"docker exec {ctn} echo OK", timeout=30)
                if rc2 != 0 or "OK" not in out2:
                    raise RuntimeError(f"Docker 컨테이너 접근 실패: {err2 or '응답 없음'}\n"
                                       f"  → docker ps 로 컨테이너 상태 확인")
                from core.remote import RemoteDockerExecutor
                ex = RemoteDockerExecutor(ex, ctn)
                print(f"  ✓ Docker 컨테이너 연결 성공  ({ctn})")
            print()
            return ex
        if m == "4":
            ctn = self.docker_ctn.get().strip()
            if not ctn: raise ValueError("컨테이너 이름 또는 ID를 입력하세요.")
            print(f"\n  → Docker 컨테이너 확인 중 ({ctn})...")
            from core.remote import DockerExecutor
            ex = DockerExecutor(ctn)
            rc, out, err = ex.run_shell("echo OK", timeout=10)
            if rc != 0 or "OK" not in out:
                raise RuntimeError(
                    f"Docker 컨테이너 접근 실패: {err or '응답 없음'}\n\n"
                    "  1) 컨테이너가 실행 중인지 확인  (docker ps)\n"
                    "  2) 컨테이너 이름/ID가 올바른지 확인")
            print("  ✓ Docker 연결 성공\n"); return ex
        return None

    def _make_opts(self, executor) -> dict:
        t = self.target.get().strip() or "localhost"
        opts = {"target": t, "verbose": True}
        if executor: opts["executor"] = executor
        k = self.mod_key.get()
        if k == "3":
            c = self.nginx_conf.get().strip()
            if c: opts["conf_path"] = c
        elif k == "5":
            opts["db_type"] = self.db_type.get()
            opts["port"]    = int(self.db_port.get() or 3306)
            opts["user"]    = self.db_user.get().strip()
            if opts["user"]: opts["password"] = self.db_pass.get()
        elif k == "6":
            deploy = self.ora_deploy.get()
            if deploy == "rds":
                # RDS: 터널 통해 127.0.0.1:localPort 로 접속
                db_host = "127.0.0.1"
                db_port = int(self.ora_local_port.get() or 11521)
                rds_ep  = self.ora_rds_ep.get().strip()  # 실제 RDS 엔드포인트 (서비스명 후보)
            else:
                db_host = self.ora_host.get().strip() or t
                db_port = int(self.ora_port.get() or 1521)
                rds_ep  = ""
            opts.update(deploy_type=deploy,
                        db_host=db_host,
                        db_port=db_port,
                        service_name=self.ora_svc.get().strip() or "ORCL",
                        db_user=self.ora_user.get().strip() or "system",
                        db_password=self.ora_pass.get(),
                        rds_endpoint=rds_ep)
        elif k == "7":
            region = self.aws_region.get().strip() or "ap-northeast-2"
            if self.aws_use_ssm.get():
                # 환경변수 / ~/.aws 사용 — 빈 자격증명 전달
                ak = sk = tok = ""
            else:
                ak  = self.aws_ak.get().strip()
                sk  = self.aws_sk.get()
                tok = self.aws_tok.get()
            opts.update(region=region,
                        aws_access_key_id=ak,
                        aws_secret_access_key=sk,
                        aws_session_token=tok)
            # AWS 진단은 executor 불필요
            opts.pop("executor", None)
        return opts

    @staticmethod
    def _find_aws_cli() -> str:
        """aws CLI 실행 파일 경로를 반환. 없으면 빈 문자열."""
        import shutil
        exe = "aws.cmd" if platform.system() == "Windows" else "aws"
        found = shutil.which(exe) or shutil.which("aws")
        if found:
            return found
        if platform.system() == "Windows":
            candidates = [
                r"C:\Program Files\Amazon\AWSCLIV2\aws.exe",
                r"C:\Program Files (x86)\Amazon\AWSCLIV2\aws.exe",
                os.path.expanduser(r"~\AppData\Local\Programs\Python\aws.exe"),
            ]
        else:
            candidates = [
                "/usr/local/bin/aws",
                "/opt/homebrew/bin/aws",
                "/usr/bin/aws",
                "/home/linuxbrew/.linuxbrew/bin/aws",
                os.path.expanduser("~/.local/bin/aws"),
            ]
        for p in candidates:
            if os.path.isfile(p) and os.access(p, os.X_OK):
                return p
        return ""

    @staticmethod
    def _find_session_manager_plugin() -> str:
        """session-manager-plugin 실행 파일 경로를 반환. 없으면 빈 문자열."""
        import shutil
        found = shutil.which("session-manager-plugin")
        if found:
            return found
        if platform.system() == "Windows":
            candidates = [
                r"C:\Program Files\Amazon\SessionManagerPlugin\bin\session-manager-plugin.exe",
                r"C:\Program Files (x86)\Amazon\SessionManagerPlugin\bin\session-manager-plugin.exe",
            ]
        else:
            candidates = [
                "/usr/local/bin/session-manager-plugin",
                "/opt/homebrew/bin/session-manager-plugin",
                "/usr/bin/session-manager-plugin",
                os.path.expanduser("~/.local/bin/session-manager-plugin"),
            ]
        for p in candidates:
            if os.path.isfile(p) and os.access(p, os.X_OK):
                return p
        return ""

    def _start_ssm_tunnel(self):
        import subprocess, socket, time, threading
        iid    = self.ssm_id.get().strip()
        region = self.ssm_region.get().strip() or "ap-northeast-2"
        ep     = self.ora_rds_ep.get().strip()
        port   = self.ora_port.get().strip()       or "1521"
        local  = self.ora_local_port.get().strip() or "11521"

        if not iid:
            raise ValueError("SSM 인스턴스 ID를 입력하세요.")
        if not ep:
            raise ValueError("RDS 엔드포인트를 입력하세요.")

        params = (f'{{"host":["{ep}"],'
                  f'"portNumber":["{port}"],'
                  f'"localPortNumber":["{local}"]}}')

        aws_bin = self._find_aws_cli()
        if not aws_bin:
            install_hint = ("  choco install awscli  또는  https://aws.amazon.com/cli/"
                            if platform.system() == "Windows"
                            else "  brew install awscli  또는  https://aws.amazon.com/cli/")
            raise RuntimeError(f"aws CLI를 찾을 수 없습니다.\n\n{install_hint}")

        cmd = [aws_bin, "ssm", "start-session",
               "--region", region,
               "--target", iid,
               "--document-name", "AWS-StartPortForwardingSessionToRemoteHost",
               "--parameters", params]

        env = os.environ.copy()
        if self.ssm_cred.get() == "1":
            if self.ssm_ak.get():  env["AWS_ACCESS_KEY_ID"]     = self.ssm_ak.get()
            if self.ssm_sk.get():  env["AWS_SECRET_ACCESS_KEY"]  = self.ssm_sk.get()
            if self.ssm_tok.get(): env["AWS_SESSION_TOKEN"]      = self.ssm_tok.get()
        smp_bin = self._find_session_manager_plugin()
        if smp_bin:
            env["PATH"] = os.pathsep.join([os.path.dirname(smp_bin), env.get("PATH", "")])

        self._ssm_output = ""
        local_port = int(local)
        requested_local = local_port
        local_port = self._pick_available_local_port(local_port)
        if local_port != requested_local:
            local = str(local_port)
            self.ora_local_port.set(local)
            print(f"  [!] 로컬 포트 {requested_local} 사용 불가 → {local} 로 자동 변경")

        print(f"  → SSM 터널 시작 중... (127.0.0.1:{local} → {ep}:{port})")
        self.root.after(0, lambda: self.tunnel_status_lbl.config(
            text="🔄 터널 연결 중...", fg=C_WARN))

        # Windows: CREATE_NO_WINDOW 플래그로 콘솔 창 숨김
        popen_kwargs: dict = dict(
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            stdin=subprocess.DEVNULL,
        )
        if platform.system() == "Windows":
            popen_kwargs["creationflags"] = subprocess.CREATE_NO_WINDOW  # type: ignore[attr-defined]
        else:
            popen_kwargs["close_fds"] = True

        self._ssm_proc = subprocess.Popen(cmd, **popen_kwargs)

        # 출력을 백그라운드 스레드로 읽어 _ssm_output 에 축적
        output_buf: list[str] = []
        def _reader():
            for line in self._ssm_proc.stdout:
                output_buf.append(line.decode(errors="replace"))
        threading.Thread(target=_reader, daemon=True).start()

        # 포트가 열릴 때까지 최대 30초 대기
        for i in range(30):
            time.sleep(1)
            if self._ssm_proc.poll() is not None:
                self._ssm_output = "".join(output_buf).strip()
                self._ssm_proc = None
                raise RuntimeError(self._format_ssm_tunnel_error(
                    ep=ep, port=port, local=local, region=region, iid=iid))
            try:
                with socket.create_connection(("127.0.0.1", local_port), timeout=1):
                    self._ssm_output = "".join(output_buf).strip()
                    break
            except OSError:
                if i % 5 == 4:
                    print(f"  → 터널 대기 중... ({i+1}s)")
        else:
            if self._ssm_proc and self._ssm_proc.poll() is None:
                self._ssm_proc.terminate()
                try:
                    self._ssm_proc.wait(timeout=3)
                except Exception:
                    pass
            self._ssm_output = "".join(output_buf).strip()
            self._ssm_proc = None
            raise RuntimeError(self._format_ssm_tunnel_error(
                ep=ep, port=port, local=local, region=region, iid=iid, timeout=True))

        time.sleep(3)
        print(f"  ✓ SSM 터널 연결 완료 (127.0.0.1:{local})")
        self.root.after(0, lambda: self.tunnel_status_lbl.config(
            text=f"✓ 터널 열림  127.0.0.1:{local}", fg=C_GREEN))

    @staticmethod
    def _is_local_port_open(port: int) -> bool:
        import socket
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=0.5):
                return True
        except OSError:
            return False

    def _pick_available_local_port(self, preferred_port: int) -> int:
        if not self._is_local_port_open(preferred_port):
            return preferred_port
        for candidate in range(preferred_port + 1, preferred_port + 100):
            if not self._is_local_port_open(candidate):
                return candidate
        raise RuntimeError(
            f"로컬 포트 {preferred_port} 부근에서 사용 가능한 포트를 찾지 못했습니다.\n\n"
            "  → Docker/기존 터널 프로세스를 종료하거나 다른 포트를 직접 지정하세요.")

    def _format_ssm_tunnel_error(self, ep: str, port: str, local: str,
                                 region: str, iid: str, timeout: bool = False) -> str:
        msg = "SSM 터널 연결 시간 초과 (30s)" if timeout else "SSM 터널 시작 실패"
        details = (self._ssm_output or "").strip()
        hints = [
            f"대상: 127.0.0.1:{local} -> {ep}:{port}",
            f"리전/인스턴스: {region} / {iid}",
            "1) 터미널에서 aws ssm start-session 명령이 직접 성공하는지 확인",
            "2) EC2 인스턴스에 SSM Agent 와 AmazonSSMManagedInstanceCore 권한이 있는지 확인",
            "3) EC2 에서 RDS 엔드포인트:1521 로 접속 가능한지 보안그룹/NACL 확인",
            "4) session-manager-plugin 이 설치되어 있는지 확인",
        ]
        if details:
            hints.append(f"원본 출력: {details.splitlines()[0][:240]}")
        return msg + "\n\n" + "\n".join(f"  {line}" for line in hints)

    def _stop_ssm_tunnel(self):
        if self._ssm_proc and self._ssm_proc.poll() is None:
            self._ssm_proc.terminate()
            print("  ✓ SSM 터널 종료")
        self._ssm_proc = None
        self._ssm_output = ""
        self.root.after(0, lambda: (
            hasattr(self, "tunnel_status_lbl") and
            self.tunnel_status_lbl.config(text="", fg=C_MUTE)))

    def _on_done(self, report):
        self.run_btn.config(state=tk.NORMAL, bg=C_GOLD)
        self.stop_btn.config(state=tk.DISABLED)
        self.status_var.set("ABORTED" if self._stop_event.is_set() else "DONE")
        self.status_badge.config(bg=C_GREEN, fg=C_BG)
        self.progress.stop(); self.progress.pack_forget()
        s  = report.summary; sv = s["by_severity"]; rv = s["manual"] + s["error"]
        self.stat_lbl["total"].config(text=str(s["total"]))
        self.stat_lbl["vuln"].config(text=str(s["vulnerable"]))
        self.stat_lbl["safe"].config(text=str(s["safe"]))
        self.stat_lbl["review"].config(text=str(rv))
        self.stat_lbl["na"].config(text=str(s["skipped"]))
        self.sev_lbl.config(
            text=f"위험 {sv['위험']}  높음 {sv['높음']}  보통 {sv['보통']}  낮음 {sv['낮음']}")
        self.save_frame.pack(side=tk.RIGHT)

    def _on_error(self, msg):
        self.run_btn.config(state=tk.NORMAL, bg=C_GOLD)
        self.stop_btn.config(state=tk.DISABLED)
        self.status_var.set("ERROR")
        self.status_badge.config(bg=C_RED, fg=C_FG)
        self.progress.stop(); self.progress.pack_forget()
        messagebox.showerror("진단 오류", msg)

    def _save(self, fmt):
        if not self._report:
            messagebox.showwarning("알림", "저장할 리포트가 없습니다."); return
        try:
            p = (reporter.save_excel(self._report)   if fmt == "excel" else
                 reporter.save_markdown(self._report) if fmt == "md"    else
                 reporter.save_log(self._report))
            messagebox.showinfo("저장 완료", f"저장되었습니다:\n{p}")
        except Exception as e:
            messagebox.showerror("저장 오류", str(e))

    def _browse_pem(self):
        p = filedialog.askopenfilename(title="PEM 키 선택",
                                       filetypes=[("PEM","*.pem"),("모든 파일","*.*")])
        if p: self.ssh_key.set(p)

    def _browse_file(self, var, title, filetypes):
        p = filedialog.askopenfilename(title=title, filetypes=filetypes)
        if p: var.set(p)


def main():
    root = tk.Tk()
    try: root.iconbitmap("icon.ico")
    except: pass
    VulnScannerGUI(root)
    root.mainloop()


if __name__ == "__main__":
    main()
