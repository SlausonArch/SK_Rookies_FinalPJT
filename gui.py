#!/opt/homebrew/bin/python3
"""
취약점 진단 자동화 스크립트 - GUI
사용법: python gui.py
"""
import sys
import os
import queue
import threading
import inspect
import platform
import tkinter as tk
from tkinter import ttk, filedialog, messagebox

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from core import reporter

# ── 모듈 정의 ─────────────────────────────────────────────────────────────────
MODULES = {
    "1": {"name": "OS - Linux",            "icon": "🐧",
          "desc": "계정/패스워드, 파일 권한, SSH, 서비스, 로그, 커널",
          "loader": lambda: __import__("modules.os.linux_scanner",        fromlist=["LinuxScanner"]).LinuxScanner},
    "2": {"name": "OS - Windows",          "icon": "🪟",
          "desc": "계정 정책, 레지스트리, 감사 정책, RDP, SMB",
          "loader": lambda: __import__("modules.os.windows_scanner",      fromlist=["WindowsScanner"]).WindowsScanner},
    "3": {"name": "WebServer - Nginx",     "icon": "🌐",
          "desc": "버전 노출, 디렉토리 리스팅, SSL/TLS, 보안 헤더, 설정 권한",
          "loader": lambda: __import__("modules.webserver.nginx_scanner", fromlist=["NginxScanner"]).NginxScanner},
    "4": {"name": "WebServer - IIS",       "icon": "🌐",
          "desc": "디렉토리 브라우징, 버전 노출, HTTP 메서드, 로그, SSL",
          "loader": lambda: __import__("modules.webserver.iis_scanner",   fromlist=["IISScanner"]).IISScanner},
    "5": {"name": "DBMS (MySQL/PG/MSSQL)", "icon": "🗄",
          "desc": "포트 노출, 기본 계정, 원격 root, 감사 로그, 데이터 디렉토리",
          "loader": lambda: __import__("modules.dbms.dbms_scanner",       fromlist=["DBMSScanner"]).DBMSScanner},
    "6": {"name": "Oracle DB (11g~21c)",   "icon": "🔶",
          "desc": "계정/권한/보안설정/환경파일/감사 — 서버·Docker·AWS RDS 지원",
          "loader": lambda: __import__("modules.dbms.oracle_scanner",     fromlist=["OracleScanner"]).OracleScanner},
}

# ── 색상 (Catppuccin Mocha) ───────────────────────────────────────────────────
C_BASE    = "#1e1e2e"
C_MANTLE  = "#181825"
C_CRUST   = "#11111b"
C_SURF0   = "#313244"
C_SURF1   = "#45475a"
C_OVER0   = "#6c7086"
C_FG      = "#cdd6f4"
C_SUB1    = "#a6adc8"
C_ACCENT  = "#89b4fa"   # blue
C_MAUVE   = "#cba6f7"
C_RED     = "#f38ba8"
C_GREEN   = "#a6e3a1"
C_YELLOW  = "#f9e2af"
C_TEAL    = "#94e2d5"

_MONO = "Menlo" if platform.system() == "Darwin" else (
        "Consolas" if platform.system() == "Windows" else "monospace")
_UI = ("SF Pro Display" if platform.system() == "Darwin" else
       "Segoe UI"       if platform.system() == "Windows" else "Ubuntu")


def _f(size, weight="normal"):
    return (_UI, size, weight)


def _lbl(parent, text, bg, fg=C_FG, size=9, weight="normal", **kw):
    return tk.Label(parent, text=text, bg=bg, fg=fg,
                    font=(_UI, size, weight), **kw)


# ── 스크롤 가능한 프레임 ──────────────────────────────────────────────────────
class ScrollableFrame(tk.Frame):
    def __init__(self, parent, bg=C_MANTLE, **kw):
        super().__init__(parent, bg=bg, **kw)
        self._canvas = tk.Canvas(self, bg=bg, highlightthickness=0, bd=0)
        self._sb = ttk.Scrollbar(self, orient="vertical", command=self._canvas.yview)
        self.inner = tk.Frame(self._canvas, bg=bg)

        self.inner.bind("<Configure>",
            lambda e: self._canvas.configure(scrollregion=self._canvas.bbox("all")))
        self._win = self._canvas.create_window((0, 0), window=self.inner, anchor="nw")
        self._canvas.configure(yscrollcommand=self._sb.set)
        self._canvas.bind("<Configure>",
            lambda e: self._canvas.itemconfig(self._win, width=e.width))

        self._canvas.bind("<Enter>", lambda e: self._canvas.bind_all("<MouseWheel>", self._scroll))
        self._canvas.bind("<Leave>", lambda e: self._canvas.unbind_all("<MouseWheel>"))

        self._canvas.pack(side="left", fill="both", expand=True)
        self._sb.pack(side="right", fill="y")

    def _scroll(self, event):
        self._canvas.yview_scroll(int(-1 * (event.delta / 120)), "units")


# ── stdout → Queue ────────────────────────────────────────────────────────────
class StdoutQueue:
    def __init__(self, q):
        self.q = q
    def write(self, text):
        if text: self.q.put(text)
    def flush(self): pass


# ── 메인 GUI ─────────────────────────────────────────────────────────────────
class VulnScannerGUI:
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title("취약점 진단 자동화 스크립트")
        self.root.geometry("1320x900")
        self.root.minsize(1040, 680)
        self.root.configure(bg=C_BASE)

        self.output_q: queue.Queue = queue.Queue()
        self.scan_thread = None
        self._report = None

        self._init_vars()
        self._apply_style()
        self._build_ui()
        self._poll_output()

        self.root.bind("<F5>", lambda e: self._start_scan())
        self.root.bind("<Control-Return>", lambda e: self._start_scan())

    # ── 변수 ─────────────────────────────────────────────────────────────────
    def _init_vars(self):
        self.conn_mode  = tk.StringVar(value="1")
        self.ssh_host   = tk.StringVar()
        self.ssh_port   = tk.StringVar(value="22")
        self.ssh_user   = tk.StringVar(value="ec2-user")
        self.ssh_auth   = tk.StringVar(value="key")
        self.ssh_key    = tk.StringVar()
        self.ssh_pass   = tk.StringVar()
        self.ssm_id     = tk.StringVar()
        self.ssm_region = tk.StringVar(value="ap-northeast-2")
        self.ssm_cred   = tk.StringVar(value="2")
        self.ssm_ak     = tk.StringVar()
        self.ssm_sk     = tk.StringVar()
        self.ssm_tok    = tk.StringVar()
        self.ssm_os     = tk.StringVar(value="linux")
        self.mod_key    = tk.StringVar(value="1")
        self.target     = tk.StringVar(value="localhost")
        self.nginx_conf = tk.StringVar()
        self.db_type    = tk.StringVar(value="mysql")
        self.db_port    = tk.StringVar(value="3306")
        self.db_user    = tk.StringVar()
        self.db_pass    = tk.StringVar()
        self.ora_deploy = tk.StringVar(value="server")
        self.ora_host   = tk.StringVar(value="localhost")
        self.ora_port   = tk.StringVar(value="1521")
        self.ora_svc    = tk.StringVar(value="ORCL")
        self.ora_user   = tk.StringVar(value="system")
        self.ora_pass   = tk.StringVar()
        self.rpt_excel  = tk.BooleanVar(value=True)
        self.rpt_md     = tk.BooleanVar(value=False)
        self.status_var = tk.StringVar(value="대기 중")

    # ── 스타일 ────────────────────────────────────────────────────────────────
    def _apply_style(self):
        s = ttk.Style(self.root)
        s.theme_use("clam")

        s.configure(".", background=C_BASE, foreground=C_FG, borderwidth=0,
                    font=(_UI, 10))
        s.configure("TFrame",    background=C_BASE)
        s.configure("TLabel",    background=C_BASE, foreground=C_FG)
        s.configure("TSeparator", background=C_SURF0)

        # LabelFrame
        s.configure("TLabelframe", background=C_MANTLE, foreground=C_ACCENT,
                    bordercolor=C_SURF0, relief="solid", borderwidth=1)
        s.configure("TLabelframe.Label", background=C_MANTLE, foreground=C_ACCENT,
                    font=(_UI, 10, "bold"))

        # Radio / Check
        for w in ("TRadiobutton", "TCheckbutton"):
            s.configure(w, background=C_MANTLE, foreground=C_FG,
                        indicatorcolor=C_ACCENT, selectcolor=C_MANTLE)
            s.map(w, background=[("active", C_MANTLE)],
                     foreground=[("active", C_ACCENT)])

        # Entry
        s.configure("TEntry", fieldbackground=C_SURF0, foreground=C_FG,
                    insertcolor=C_FG, bordercolor=C_SURF1, padding=(6, 4))
        s.map("TEntry", bordercolor=[("focus", C_ACCENT)],
                        fieldbackground=[("focus", C_SURF1)])

        # Button
        s.configure("TButton", background=C_SURF0, foreground=C_FG,
                    bordercolor=C_SURF1, focuscolor=C_ACCENT,
                    padding=(8, 5), relief="flat")
        s.map("TButton", background=[("active", C_SURF1), ("disabled", C_SURF0)],
                         foreground=[("active", C_FG),   ("disabled", C_OVER0)])

        # Run
        s.configure("Run.TButton", background=C_ACCENT, foreground=C_CRUST,
                    font=(_UI, 12, "bold"), padding=(20, 9), relief="flat")
        s.map("Run.TButton", background=[("active", C_MAUVE), ("disabled", C_SURF1)],
                             foreground=[("active", C_CRUST), ("disabled", C_OVER0)])

        # Save
        s.configure("Save.TButton", background=C_SURF0, foreground=C_TEAL,
                    font=(_UI, 9), padding=(8, 4), relief="flat")
        s.map("Save.TButton", background=[("active", C_SURF1)],
                              foreground=[("active", C_TEAL)])

        # Notebook
        s.configure("TNotebook", background=C_BASE, borderwidth=0, tabmargins=[0,0,0,0])
        s.configure("TNotebook.Tab", background=C_MANTLE, foreground=C_OVER0,
                    padding=[16, 7], borderwidth=0)
        s.map("TNotebook.Tab",
              background=[("selected", C_BASE),   ("active", C_SURF0)],
              foreground=[("selected", C_ACCENT), ("active", C_FG)])

        # Progressbar
        s.configure("TProgressbar", troughcolor=C_SURF0, background=C_ACCENT,
                    borderwidth=0, thickness=3)

        # Scrollbar
        s.configure("TScrollbar", background=C_SURF0, troughcolor=C_MANTLE,
                    arrowcolor=C_OVER0, borderwidth=0)
        s.map("TScrollbar", background=[("active", C_SURF1)])

    # ── UI 빌드 ───────────────────────────────────────────────────────────────
    def _build_ui(self):
        self._build_header()

        pw = tk.PanedWindow(self.root, orient=tk.HORIZONTAL,
                            bg=C_CRUST, sashwidth=4, relief=tk.FLAT)
        pw.pack(fill=tk.BOTH, expand=True)

        left = tk.Frame(pw, bg=C_BASE)
        pw.add(left, minsize=400, width=440)
        self._build_left(left)

        right = tk.Frame(pw, bg=C_BASE)
        pw.add(right, minsize=520)
        self._build_right(right)

        self._build_statusbar()

    def _build_header(self):
        hdr = tk.Frame(self.root, bg=C_MANTLE)
        hdr.pack(fill=tk.X)
        inner = tk.Frame(hdr, bg=C_MANTLE)
        inner.pack(fill=tk.X, padx=16, pady=10)

        _lbl(inner, "⚡", C_MANTLE, C_ACCENT, 18).pack(side=tk.LEFT)
        tf = tk.Frame(inner, bg=C_MANTLE); tf.pack(side=tk.LEFT, padx=(8, 0))
        _lbl(tf, "취약점 진단 자동화 스크립트", C_MANTLE, C_FG, 14, "bold").pack(anchor=tk.W)
        _lbl(tf, "SK Shieldus 보안 가이드라인 기반", C_MANTLE, C_SUB1, 9).pack(anchor=tk.W)

        rf = tk.Frame(inner, bg=C_MANTLE); rf.pack(side=tk.RIGHT)
        _lbl(rf, "F5  또는  Ctrl+Enter  →  진단 시작", C_MANTLE, C_SURF1, 9).pack(anchor=tk.E)
        _lbl(rf, f"{platform.system()} {platform.release()}", C_MANTLE, C_OVER0, 9).pack(anchor=tk.E)

        tk.Frame(self.root, bg=C_SURF0, height=1).pack(fill=tk.X)

    # ── 왼쪽 패널 ────────────────────────────────────────────────────────────
    def _build_left(self, parent):
        nb = ttk.Notebook(parent)
        nb.pack(fill=tk.BOTH, expand=True)

        t1 = tk.Frame(nb, bg=C_MANTLE); nb.add(t1, text="  🔌  연결 설정  ")
        t2 = tk.Frame(nb, bg=C_MANTLE); nb.add(t2, text="  🔍  진단 모듈  ")
        t3 = tk.Frame(nb, bg=C_MANTLE); nb.add(t3, text="  📄  리포트  ")

        self._build_conn_tab(t1)
        self._build_module_tab(t2)
        self._build_report_tab(t3)

        # 실행 버튼 영역
        bot = tk.Frame(parent, bg=C_MANTLE)
        bot.pack(fill=tk.X)
        tk.Frame(bot, bg=C_SURF0, height=1).pack(fill=tk.X)
        bf = tk.Frame(bot, bg=C_MANTLE); bf.pack(fill=tk.X, padx=14, pady=10)
        self.run_btn = ttk.Button(bf, text="▶   진단 시작  (F5)",
                                   style="Run.TButton", command=self._start_scan)
        self.run_btn.pack(fill=tk.X, ipady=2)

    # ── 연결 설정 탭 ─────────────────────────────────────────────────────────
    def _build_conn_tab(self, parent):
        sf = ScrollableFrame(parent)
        sf.pack(fill=tk.BOTH, expand=True)
        p = sf.inner; p.configure(padx=14, pady=10)

        self._sec(p, "연결 방식")
        modes = [("1","🖥","로컬","현재 시스템에서 직접 진단"),
                 ("2","🔑","SSH","원격 서버 / PEM 키 또는 패스워드"),
                 ("3","☁","AWS SSM","EC2 Session Manager")]
        for val, icon, title, desc in modes:
            row = tk.Frame(p, bg=C_MANTLE, cursor="hand2"); row.pack(fill=tk.X, pady=2)
            ttk.Radiobutton(row, text="", variable=self.conn_mode,
                            value=val, command=self._on_conn).pack(side=tk.LEFT)
            _lbl(row, icon, C_MANTLE, C_ACCENT, 12).pack(side=tk.LEFT, padx=(2, 6))
            tf = tk.Frame(row, bg=C_MANTLE); tf.pack(side=tk.LEFT)
            _lbl(tf, title, C_MANTLE, C_FG, 10, "bold").pack(anchor=tk.W)
            _lbl(tf, desc,  C_MANTLE, C_SUB1, 8).pack(anchor=tk.W)
            for w in (row, tf): w.bind("<Button-1>",
                lambda e, v=val: (self.conn_mode.set(v), self._on_conn()))

        self._div(p)

        # SSH 필드
        self.f_ssh = tk.Frame(p, bg=C_MANTLE)
        self._fl(self.f_ssh, "호스트 / IP"); self._ent(self.f_ssh, self.ssh_host)
        rr = tk.Frame(self.f_ssh, bg=C_MANTLE); rr.pack(fill=tk.X, pady=(4,0))
        pf = tk.Frame(rr, bg=C_MANTLE); pf.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0,8))
        self._fl(pf, "포트"); self._ent(pf, self.ssh_port, w=9)
        uf = tk.Frame(rr, bg=C_MANTLE); uf.pack(side=tk.LEFT, fill=tk.X, expand=True)
        self._fl(uf, "사용자명"); self._ent(uf, self.ssh_user)
        self._fl(self.f_ssh, "인증 방식")
        ar = tk.Frame(self.f_ssh, bg=C_MANTLE); ar.pack(anchor=tk.W, pady=2)
        for v, l in [("key","🔑 PEM 키 파일"), ("pwd","🔒 패스워드")]:
            ttk.Radiobutton(ar, text=l, variable=self.ssh_auth,
                            value=v, command=self._on_auth).pack(side=tk.LEFT, padx=(0,10))
        self.f_pem = tk.Frame(self.f_ssh, bg=C_MANTLE)
        self._fl(self.f_pem, "PEM 키 파일 경로")
        pr = tk.Frame(self.f_pem, bg=C_MANTLE); pr.pack(fill=tk.X)
        self._ent(pr, self.ssh_key, w=22, side=tk.LEFT)
        ttk.Button(pr, text="찾기", width=5, command=self._browse_pem).pack(side=tk.LEFT, padx=(4,0))
        self.f_spwd = tk.Frame(self.f_ssh, bg=C_MANTLE)
        self._fl(self.f_spwd, "패스워드"); self._ent(self.f_spwd, self.ssh_pass, show="●")

        # SSM 필드
        self.f_ssm = tk.Frame(p, bg=C_MANTLE)
        self._fl(self.f_ssm, "EC2 인스턴스 ID")
        self._ent(self.f_ssm, self.ssm_id)
        self._fl(self.f_ssm, "AWS 리전"); self._ent(self.f_ssm, self.ssm_region, w=22)
        self._fl(self.f_ssm, "자격 증명")
        for v, l in [("1","🔑 IAM 키 직접 입력"), ("2","🔄 환경변수 / ~/.aws 자동 사용")]:
            ttk.Radiobutton(self.f_ssm, text=l, variable=self.ssm_cred,
                            value=v, command=self._on_cred).pack(anchor=tk.W, pady=1)
        self.f_ssm_key = tk.Frame(self.f_ssm, bg=C_SURF0)
        ki = tk.Frame(self.f_ssm_key, bg=C_SURF0); ki.pack(fill=tk.X, padx=8, pady=6)
        self._fl(ki, "Access Key ID",    bg=C_SURF0); self._ent(ki, self.ssm_ak, bg=C_SURF0)
        self._fl(ki, "Secret Access Key",bg=C_SURF0); self._ent(ki, self.ssm_sk, show="●", bg=C_SURF0)
        self._fl(ki, "Session Token (선택)", bg=C_SURF0); self._ent(ki, self.ssm_tok, show="●", bg=C_SURF0)
        self._fl(self.f_ssm, "대상 OS")
        or_ = tk.Frame(self.f_ssm, bg=C_MANTLE); or_.pack(anchor=tk.W, pady=2)
        for v, l in [("linux","🐧 Linux"), ("windows","🪟 Windows")]:
            ttk.Radiobutton(or_, text=l, variable=self.ssm_os, value=v).pack(side=tk.LEFT, padx=(0,10))

        self._on_conn()

    # ── 진단 모듈 탭 ─────────────────────────────────────────────────────────
    def _build_module_tab(self, parent):
        sf = ScrollableFrame(parent)
        sf.pack(fill=tk.BOTH, expand=True)
        p = sf.inner; p.configure(padx=14, pady=10)

        self._sec(p, "진단 대상")
        self._fl(p, "호스트 / IP  (리포트에 표시)")
        self._ent(p, self.target)
        self._div(p)

        self._sec(p, "모듈 선택")
        for k, info in MODULES.items():
            card = tk.Frame(p, bg=C_SURF0, cursor="hand2")
            card.pack(fill=tk.X, pady=3)
            ci = tk.Frame(card, bg=C_SURF0); ci.pack(fill=tk.X, padx=10, pady=7)
            tr = tk.Frame(ci, bg=C_SURF0); tr.pack(fill=tk.X)
            ttk.Radiobutton(tr, text="", variable=self.mod_key,
                            value=k, command=self._on_mod).pack(side=tk.LEFT)
            _lbl(tr, info["icon"], C_SURF0, C_ACCENT, 12).pack(side=tk.LEFT, padx=(2,6))
            _lbl(tr, info["name"], C_SURF0, C_FG, 10, "bold").pack(side=tk.LEFT)
            _lbl(ci, info["desc"], C_SURF0, C_SUB1, 8,
                 wraplength=340, justify=tk.LEFT).pack(anchor=tk.W, padx=22)
            for w in (card, ci, tr):
                w.bind("<Button-1>", lambda e, v=k: (self.mod_key.set(v), self._on_mod()))

        self._div(p)
        self._sec(p, "모듈 옵션")
        self.opt_box = tk.Frame(p, bg=C_MANTLE); self.opt_box.pack(fill=tk.X)
        self._build_opts()
        self._on_mod()

    def _build_opts(self):
        self.opt_frames = {}
        for k in ("1","2","4"):
            f = tk.Frame(self.opt_box, bg=C_MANTLE)
            _lbl(f, "이 모듈은 추가 옵션이 없습니다.", C_MANTLE, C_OVER0, 9).pack(anchor=tk.W, pady=4)
            self.opt_frames[k] = f

        # 3 Nginx
        f3 = tk.Frame(self.opt_box, bg=C_MANTLE)
        self._fl(f3, "nginx.conf 경로  (비워두면 자동 탐색)")
        nr = tk.Frame(f3, bg=C_MANTLE); nr.pack(fill=tk.X)
        self._ent(nr, self.nginx_conf, w=22, side=tk.LEFT)
        ttk.Button(nr, text="찾기", width=5,
                   command=lambda: self._browse_file(self.nginx_conf, "nginx.conf 선택",
                       [("conf","*.conf"),("모든 파일","*.*")])).pack(side=tk.LEFT, padx=(4,0))
        self.opt_frames["3"] = f3

        # 5 DBMS
        f5 = tk.Frame(self.opt_box, bg=C_MANTLE)
        self._fl(f5, "DB 종류")
        dr = tk.Frame(f5, bg=C_MANTLE); dr.pack(anchor=tk.W, pady=2)
        for v, l in [("mysql","MySQL"),("postgresql","PostgreSQL"),("mssql","MSSQL")]:
            ttk.Radiobutton(dr, text=l, variable=self.db_type,
                            value=v, command=self._on_dbtype).pack(side=tk.LEFT, padx=(0,8))
        self._fl(f5, "포트"); self._ent(f5, self.db_port, w=10)
        self._fl(f5, "접속 계정  (비워두면 포트/네트워크 점검만)"); self._ent(f5, self.db_user)
        self._fl(f5, "패스워드"); self._ent(f5, self.db_pass, show="●")
        self.opt_frames["5"] = f5

        # 6 Oracle
        f6 = tk.Frame(self.opt_box, bg=C_MANTLE)
        self._fl(f6, "배포 유형")
        dpr = tk.Frame(f6, bg=C_MANTLE); dpr.pack(anchor=tk.W, pady=2)
        for v, l in [("server","🖥 서버"),("docker","🐳 Docker"),("rds","☁ AWS RDS")]:
            ttk.Radiobutton(dpr, text=l, variable=self.ora_deploy, value=v).pack(side=tk.LEFT, padx=(0,8))
        self._fl(f6, "DB 호스트 / IP"); self._ent(f6, self.ora_host)
        ph = tk.Frame(f6, bg=C_MANTLE); ph.pack(fill=tk.X, pady=(4,0))
        pf2 = tk.Frame(ph, bg=C_MANTLE); pf2.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0,8))
        self._fl(pf2, "포트"); self._ent(pf2, self.ora_port, w=9)
        sf2 = tk.Frame(ph, bg=C_MANTLE); sf2.pack(side=tk.LEFT, fill=tk.X, expand=True)
        self._fl(sf2, "서비스명 / SID"); self._ent(sf2, self.ora_svc, w=14)
        self._fl(f6, "접속 계정"); self._ent(f6, self.ora_user)
        self._fl(f6, "DB 패스워드"); self._ent(f6, self.ora_pass, show="●")
        self.opt_frames["6"] = f6

    # ── 리포트 탭 ────────────────────────────────────────────────────────────
    def _build_report_tab(self, parent):
        sf = ScrollableFrame(parent)
        sf.pack(fill=tk.BOTH, expand=True)
        p = sf.inner; p.configure(padx=14, pady=10)

        self._sec(p, "저장 형식")
        for var, title, desc in [
            (self.rpt_excel, "📊 Excel (.xlsx)", "상세 표 형식 리포트"),
            (self.rpt_md,    "📝 Markdown (.md)", "텍스트 기반 리포트"),
        ]:
            row = tk.Frame(p, bg=C_MANTLE); row.pack(fill=tk.X, pady=3)
            ttk.Checkbutton(row, text="", variable=var).pack(side=tk.LEFT)
            tf = tk.Frame(row, bg=C_MANTLE); tf.pack(side=tk.LEFT, padx=(4,0))
            _lbl(tf, title, C_MANTLE, C_FG, 10, "bold").pack(anchor=tk.W)
            _lbl(tf, desc,  C_MANTLE, C_SUB1, 8).pack(anchor=tk.W)
        _lbl(p, "※ 로그(.txt)는 항상 자동 저장됩니다.", C_MANTLE, C_OVER0, 8).pack(anchor=tk.W, pady=(10,0))
        self._div(p)
        self._sec(p, "저장 위치")
        _lbl(p, "reports/  폴더에 날짜-시간 기준으로 자동 저장됩니다.",
             C_MANTLE, C_SUB1, 9, wraplength=360).pack(anchor=tk.W)

    # ── 오른쪽 패널 (출력) ────────────────────────────────────────────────────
    def _build_right(self, parent):
        # 헤더
        oh = tk.Frame(parent, bg=C_MANTLE); oh.pack(fill=tk.X)
        _lbl(oh, "  진단 출력", C_MANTLE, C_ACCENT, 11, "bold").pack(side=tk.LEFT, pady=8)
        tk.Button(oh, text="🗑  지우기", bg=C_MANTLE, fg=C_OVER0,
                  activebackground=C_SURF0, activeforeground=C_FG,
                  relief=tk.FLAT, padx=8, pady=4, cursor="hand2",
                  command=self._clear).pack(side=tk.RIGHT, padx=8)
        tk.Frame(parent, bg=C_SURF0, height=1).pack(fill=tk.X)

        # 텍스트 출력
        tf = tk.Frame(parent, bg=C_BASE); tf.pack(fill=tk.BOTH, expand=True)
        self.txt = tk.Text(tf, wrap=tk.NONE,
                           font=(_MONO, 11),
                           bg=C_BASE, fg=C_FG,
                           insertbackground=C_FG,
                           selectbackground=C_SURF1,
                           selectforeground=C_FG,
                           state=tk.DISABLED, relief=tk.FLAT,
                           padx=14, pady=10)
        vsb = ttk.Scrollbar(tf, orient=tk.VERTICAL,   command=self.txt.yview)
        hsb = ttk.Scrollbar(tf, orient=tk.HORIZONTAL, command=self.txt.xview)
        self.txt.configure(yscrollcommand=vsb.set, xscrollcommand=hsb.set)
        vsb.pack(side=tk.RIGHT,  fill=tk.Y)
        hsb.pack(side=tk.BOTTOM, fill=tk.X)
        self.txt.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        # 색상 태그
        self.txt.tag_config("vuln",   foreground=C_RED)
        self.txt.tag_config("safe",   foreground=C_GREEN)
        self.txt.tag_config("warn",   foreground=C_YELLOW)
        self.txt.tag_config("info",   foreground=C_ACCENT)
        self.txt.tag_config("gray",   foreground=C_OVER0)
        self.txt.tag_config("normal", foreground=C_FG)

        # 요약 + 저장 바
        sb = tk.Frame(parent, bg=C_MANTLE); sb.pack(fill=tk.X)
        tk.Frame(sb, bg=C_SURF0, height=1).pack(fill=tk.X)
        si = tk.Frame(sb, bg=C_MANTLE); si.pack(fill=tk.X, padx=8, pady=6)
        self.sum_var = tk.StringVar(value="")
        _lbl(si, "", C_MANTLE, C_ACCENT, 9, "bold",
             textvariable=self.sum_var).pack(side=tk.LEFT)
        self.save_frame = tk.Frame(si, bg=C_MANTLE)
        for lbl, fmt in [("📊 Excel","excel"),("📝 Markdown","md"),("📋 로그","log")]:
            ttk.Button(self.save_frame, text=lbl, style="Save.TButton",
                       command=lambda f=fmt: self._save(f)).pack(side=tk.LEFT, padx=2)

    def _build_statusbar(self):
        bar = tk.Frame(self.root, bg=C_CRUST); bar.pack(fill=tk.X, side=tk.BOTTOM)
        self.progress = ttk.Progressbar(bar, mode="indeterminate", length=110)
        # 스캔 시작 시에만 표시
        _lbl(bar, "  ", C_CRUST, C_CRUST, 3).pack(side=tk.LEFT)  # spacer
        self.status_lbl = _lbl(bar, "", C_CRUST, C_SUB1, 9, textvariable=self.status_var)
        self.status_lbl.pack(side=tk.LEFT, padx=4, pady=3)

    # ── 이벤트 ────────────────────────────────────────────────────────────────
    def _on_conn(self):
        self.f_ssh.pack_forget(); self.f_ssm.pack_forget()
        m = self.conn_mode.get()
        if m == "2": self.f_ssh.pack(fill=tk.X); self._on_auth()
        elif m == "3": self.f_ssm.pack(fill=tk.X); self._on_cred()

    def _on_auth(self):
        self.f_pem.pack_forget(); self.f_spwd.pack_forget()
        if self.ssh_auth.get() == "key": self.f_pem.pack(fill=tk.X, pady=2)
        else: self.f_spwd.pack(fill=tk.X, pady=2)

    def _on_cred(self):
        if self.ssm_cred.get() == "1": self.f_ssm_key.pack(fill=tk.X, pady=4)
        else: self.f_ssm_key.pack_forget()

    def _on_mod(self):
        for f in self.opt_frames.values(): f.pack_forget()
        k = self.mod_key.get()
        if k in self.opt_frames: self.opt_frames[k].pack(fill=tk.X, pady=4)

    def _on_dbtype(self):
        self.db_port.set({"mysql":"3306","postgresql":"5432","mssql":"1433"}.get(
            self.db_type.get(), "3306"))

    def _browse_pem(self):
        p = filedialog.askopenfilename(title="PEM 키 선택",
                                       filetypes=[("PEM","*.pem"),("모든 파일","*.*")])
        if p: self.ssh_key.set(p)

    def _browse_file(self, var, title, filetypes):
        p = filedialog.askopenfilename(title=title, filetypes=filetypes)
        if p: var.set(p)

    # ── 출력 폴링 ─────────────────────────────────────────────────────────────
    def _poll_output(self):
        try:
            while True:
                self._append(self.output_q.get_nowait())
        except queue.Empty:
            pass
        self.root.after(40, self._poll_output)

    def _append(self, text: str):
        self.txt.config(state=tk.NORMAL)
        tl = text.lower()
        if   "[취약]"  in text:                               tag = "vuln"
        elif "[양호]"  in text:                               tag = "safe"
        elif "[검토]"  in text or "[ n/a]" in tl:            tag = "warn"
        elif text.strip().startswith(("✓", "✔")):             tag = "safe"
        elif text.strip().startswith(("✗", "[오류]")):        tag = "vuln"
        elif text.startswith(("─","═","  [","  →","  ✓")):   tag = "info"
        elif text.startswith(("─","═")):                      tag = "gray"
        else:                                                  tag = "normal"
        self.txt.insert(tk.END, text, tag)
        self.txt.see(tk.END)
        self.txt.config(state=tk.DISABLED)

    def _clear(self):
        self.txt.config(state=tk.NORMAL)
        self.txt.delete("1.0", tk.END)
        self.txt.config(state=tk.DISABLED)
        self.sum_var.set("")
        self.save_frame.pack_forget()

    # ── 진단 실행 ─────────────────────────────────────────────────────────────
    def _start_scan(self):
        if self.scan_thread and self.scan_thread.is_alive():
            messagebox.showwarning("진행 중", "이미 진단이 실행 중입니다."); return
        self.run_btn.config(state=tk.DISABLED)
        self.status_var.set("진단 중...")
        self.save_frame.pack_forget()
        self.sum_var.set("")
        self._clear()
        self._report = None
        self.progress.pack(side=tk.LEFT, padx=(8,4))
        self.progress.start(10)
        self.scan_thread = threading.Thread(target=self._worker, daemon=True)
        self.scan_thread.start()

    def _worker(self):
        old = sys.stdout; sys.stdout = StdoutQueue(self.output_q); executor = None
        try:
            executor = self._make_executor()
            opts = self._make_opts(executor)
            k = self.mod_key.get()
            Cls = MODULES[k]["loader"]()
            valid = set(inspect.signature(Cls.__init__).parameters) - {"self"}
            report = Cls(**{p: v for p, v in opts.items() if p in valid}).run()
            self._report = report

            saved = [f"로그: {reporter.save_log(report)}"]
            if self.rpt_excel.get(): saved.append(f"Excel: {reporter.save_excel(report)}")
            if self.rpt_md.get():    saved.append(f"Markdown: {reporter.save_markdown(report)}")

            print("\n" + "─"*60)
            print("  진단 완료")
            for s in saved: print(f"  ✓ {s}")
            print("─"*60)
            self.root.after(0, lambda: self._on_done(report))
        except Exception as e:
            import traceback
            print(f"\n[오류] {e}\n{traceback.format_exc()}")
            self.root.after(0, lambda m=str(e): self._on_error(m))
        finally:
            sys.stdout = old
            if executor:
                try: executor.close()
                except: pass

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
            from core.remote import SSHExecutor
            ex = SSHExecutor(h, port, user, kp, pw)
            print("  ✓ SSH 연결 성공\n"); return ex
        if m == "3":
            iid = self.ssm_id.get().strip()
            if not iid: raise ValueError("EC2 인스턴스 ID를 입력하세요.")
            region = self.ssm_region.get().strip() or "ap-northeast-2"
            ak = sk = tok = None
            if self.ssm_cred.get() == "1":
                ak = self.ssm_ak.get().strip() or None
                sk = self.ssm_sk.get() or None
                tok = self.ssm_tok.get() or None
            ost = self.ssm_os.get()
            ping = "echo OK" if ost == "linux" else "Write-Output OK"
            print(f"\n  → SSM 연결 확인 중 ({iid} / {region} / {ost})...")
            from core.remote import SSMExecutor
            ex = SSMExecutor(iid, region, ak, sk, tok, platform=ost)
            rc, out, err = ex.run_shell(ping, timeout=30)
            if rc != 0 or "OK" not in out: raise RuntimeError(err or "SSM 응답 없음")
            print("  ✓ SSM 연결 성공\n"); return ex
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
            opts.update(deploy_type=self.ora_deploy.get(),
                        db_host=self.ora_host.get().strip() or t,
                        db_port=int(self.ora_port.get() or 1521),
                        service_name=self.ora_svc.get().strip() or "ORCL",
                        db_user=self.ora_user.get().strip() or "system",
                        db_password=self.ora_pass.get())
        return opts

    def _on_done(self, report):
        self.run_btn.config(state=tk.NORMAL)
        self.status_var.set("완료 ✓")
        self.progress.stop(); self.progress.pack_forget()
        s = report.summary; sv = s["by_severity"]; rv = s["manual"] + s["error"]
        self.sum_var.set(
            f"전체 {s['total']}  │  취약 {s['vulnerable']}  │  양호 {s['safe']}  │  "
            f"검토 {rv}  │  N/A {s['skipped']}    ·    "
            f"위험 {sv['위험']}  높음 {sv['높음']}  보통 {sv['보통']}  낮음 {sv['낮음']}")
        self.save_frame.pack(side=tk.RIGHT, padx=4)

    def _on_error(self, msg):
        self.run_btn.config(state=tk.NORMAL)
        self.status_var.set("오류 ✗")
        self.progress.stop(); self.progress.pack_forget()
        messagebox.showerror("진단 오류", msg)

    def _save(self, fmt):
        if not self._report:
            messagebox.showwarning("알림", "저장할 리포트가 없습니다."); return
        try:
            p = (reporter.save_excel(self._report)    if fmt == "excel" else
                 reporter.save_markdown(self._report)  if fmt == "md"    else
                 reporter.save_log(self._report))
            messagebox.showinfo("저장 완료", f"저장되었습니다:\n{p}")
        except Exception as e:
            messagebox.showerror("저장 오류", str(e))

    # ── 헬퍼 ─────────────────────────────────────────────────────────────────
    def _sec(self, p, text):
        _lbl(p, text.upper(), C_MANTLE, C_ACCENT, 8, "bold").pack(anchor=tk.W, pady=(8,2))

    def _fl(self, p, text, bg=C_MANTLE):
        _lbl(p, text, bg, C_SUB1, 9).pack(anchor=tk.W, pady=(6,1))

    def _ent(self, p, var, w=28, show=None, side=tk.TOP, bg=None):
        kw = dict(textvariable=var, width=w)
        if show: kw["show"] = show
        e = ttk.Entry(p, **kw)
        e.pack(side=side, anchor=tk.W,
               fill=tk.X if side == tk.TOP else tk.NONE,
               pady=(0, 2))
        return e

    def _div(self, p):
        tk.Frame(p, bg=C_SURF0, height=1).pack(fill=tk.X, pady=10)


def main():
    root = tk.Tk()
    try: root.iconbitmap("icon.ico")
    except: pass
    VulnScannerGUI(root)
    root.mainloop()


if __name__ == "__main__":
    main()
