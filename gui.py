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
from tkinter import ttk, scrolledtext, filedialog, messagebox

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from core import reporter

# ── 모듈 정의 ────────────────────────────────────────────────────────────────
MODULES = {
    "1": {"name": "OS - Linux",              "loader": lambda: __import__("modules.os.linux_scanner",       fromlist=["LinuxScanner"]).LinuxScanner},
    "2": {"name": "OS - Windows",            "loader": lambda: __import__("modules.os.windows_scanner",     fromlist=["WindowsScanner"]).WindowsScanner},
    "3": {"name": "WebServer - Nginx",       "loader": lambda: __import__("modules.webserver.nginx_scanner",fromlist=["NginxScanner"]).NginxScanner},
    "4": {"name": "WebServer - IIS",         "loader": lambda: __import__("modules.webserver.iis_scanner",  fromlist=["IISScanner"]).IISScanner},
    "5": {"name": "DBMS (MySQL/PG/MSSQL)",  "loader": lambda: __import__("modules.dbms.dbms_scanner",     fromlist=["DBMSScanner"]).DBMSScanner},
    "6": {"name": "Oracle DB (11g~21c)",     "loader": lambda: __import__("modules.dbms.oracle_scanner",   fromlist=["OracleScanner"]).OracleScanner},
}

# ── 다크 테마 색상 ────────────────────────────────────────────────────────────
C_BG     = "#1e1e2e"
C_FG     = "#cdd6f4"
C_PANEL  = "#181825"
C_BORDER = "#313244"
C_ACCENT = "#89b4fa"
C_RED    = "#f38ba8"
C_GREEN  = "#a6e3a1"
C_YELLOW = "#f9e2af"
C_GRAY   = "#6c7086"
C_BTN    = "#313244"
C_BTN_A  = "#89b4fa"


class StdoutQueue:
    """stdout → Queue 리다이렉터"""
    def __init__(self, q: queue.Queue):
        self.q = q

    def write(self, text: str):
        if text:
            self.q.put(text)

    def flush(self):
        pass


class VulnScannerGUI:
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title(f"취약점 진단 자동화  │  {platform.system()} {platform.release()}")
        self.root.geometry("1180x860")
        self.root.minsize(960, 680)
        self.root.configure(bg=C_BG)

        self.output_q: queue.Queue = queue.Queue()
        self.scan_thread: threading.Thread | None = None
        self._report = None

        self._init_vars()
        self._apply_style()
        self._build_ui()
        self._poll_output()

    # ── 변수 초기화 ───────────────────────────────────────────────────────────

    def _init_vars(self):
        # Connection
        self.conn_mode   = tk.StringVar(value="1")
        self.ssh_host    = tk.StringVar()
        self.ssh_port    = tk.StringVar(value="22")
        self.ssh_user    = tk.StringVar(value="ec2-user")
        self.ssh_auth    = tk.StringVar(value="key")
        self.ssh_key     = tk.StringVar()
        self.ssh_pass    = tk.StringVar()
        self.ssm_id      = tk.StringVar()
        self.ssm_region  = tk.StringVar(value="ap-northeast-2")
        self.ssm_cred    = tk.StringVar(value="2")
        self.ssm_ak      = tk.StringVar()
        self.ssm_sk      = tk.StringVar()
        self.ssm_tok     = tk.StringVar()
        self.ssm_os      = tk.StringVar(value="linux")
        # Module
        self.module_key  = tk.StringVar(value="1")
        self.target_host = tk.StringVar(value="localhost")
        self.nginx_conf  = tk.StringVar()
        self.db_type     = tk.StringVar(value="mysql")
        self.db_port     = tk.StringVar(value="3306")
        self.db_user_v   = tk.StringVar()
        self.db_pass_v   = tk.StringVar()
        self.ora_deploy  = tk.StringVar(value="server")
        self.ora_host    = tk.StringVar(value="localhost")
        self.ora_port    = tk.StringVar(value="1521")
        self.ora_svc     = tk.StringVar(value="ORCL")
        self.ora_user_v  = tk.StringVar(value="system")
        self.ora_pass_v  = tk.StringVar()
        # Report
        self.rpt_excel   = tk.BooleanVar(value=True)
        self.rpt_md      = tk.BooleanVar(value=False)
        # Status
        self.status_var  = tk.StringVar(value="대기 중")

    # ── ttk 스타일 ────────────────────────────────────────────────────────────

    def _apply_style(self):
        style = ttk.Style(self.root)
        style.theme_use("clam")
        style.configure(".",             background=C_BG,    foreground=C_FG,   borderwidth=0)
        style.configure("TFrame",        background=C_BG)
        style.configure("TLabel",        background=C_BG,    foreground=C_FG,   font=("TkDefaultFont", 10))
        style.configure("Header.TLabel", background=C_BG,    foreground=C_ACCENT,font=("TkDefaultFont", 12, "bold"))
        style.configure("TLabelframe",   background=C_BG,    foreground=C_ACCENT,bordercolor=C_BORDER, relief="solid", borderwidth=1)
        style.configure("TLabelframe.Label", background=C_BG,foreground=C_ACCENT,font=("TkDefaultFont", 10, "bold"))
        style.configure("TRadiobutton",  background=C_BG,    foreground=C_FG,   indicatorcolor=C_ACCENT)
        style.configure("TCheckbutton",  background=C_BG,    foreground=C_FG,   indicatorcolor=C_ACCENT)
        style.configure("TSeparator",    background=C_BORDER)
        style.configure("TEntry",        fieldbackground=C_PANEL, foreground=C_FG, insertcolor=C_FG, bordercolor=C_BORDER)
        style.configure("TButton",       background=C_BTN,   foreground=C_FG,   bordercolor=C_BORDER, focuscolor=C_ACCENT)
        style.map("TButton",             background=[("active", C_BTN_A), ("disabled", C_BORDER)],
                                         foreground=[("active", C_BG),   ("disabled", C_GRAY)])
        style.configure("Run.TButton",   background=C_ACCENT,foreground=C_BG,   font=("TkDefaultFont", 11, "bold"))
        style.map("Run.TButton",         background=[("active", C_BTN_A), ("disabled", C_BORDER)],
                                         foreground=[("active", C_BG),   ("disabled", C_GRAY)])
        style.configure("TNotebook",     background=C_BG,    tabmargins=[2,2,2,0])
        style.configure("TNotebook.Tab", background=C_PANEL, foreground=C_GRAY, padding=[10,4])
        style.map("TNotebook.Tab",       background=[("selected", C_BG)], foreground=[("selected", C_ACCENT)])

    # ── UI 빌드 ──────────────────────────────────────────────────────────────

    def _build_ui(self):
        # 헤더
        hdr = tk.Frame(self.root, bg=C_PANEL, pady=10)
        hdr.pack(fill=tk.X, side=tk.TOP)
        tk.Label(hdr, text="  ⚡  취약점 진단 자동화 스크립트",
                 bg=C_PANEL, fg=C_ACCENT,
                 font=("TkDefaultFont", 14, "bold")).pack(side=tk.LEFT)
        tk.Label(hdr, text=f"SK Shieldus 보안 가이드라인 기반  │  {platform.system()} {platform.release()}",
                 bg=C_PANEL, fg=C_GRAY,
                 font=("TkDefaultFont", 9)).pack(side=tk.LEFT, padx=12)

        # 메인 영역 (PanedWindow)
        pw = tk.PanedWindow(self.root, orient=tk.VERTICAL,
                            bg=C_BORDER, sashwidth=5, relief=tk.FLAT)
        pw.pack(fill=tk.BOTH, expand=True, padx=10, pady=(6, 0))

        # ── 상단: 설정 ──
        top = tk.Frame(pw, bg=C_BG)
        pw.add(top, minsize=280)

        # 왼쪽: 연결 설정
        conn_lf = ttk.LabelFrame(top, text=" 연결 설정 ", padding=(10, 6))
        conn_lf.pack(side=tk.LEFT, fill=tk.BOTH, padx=(0, 6), pady=4)
        self._build_connection(conn_lf)

        # 오른쪽: 모듈 + 옵션
        mod_lf = ttk.LabelFrame(top, text=" 진단 모듈 ", padding=(10, 6))
        mod_lf.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, pady=4)
        self._build_module(mod_lf)

        # ── 중단: 실행 바 ──
        mid = tk.Frame(pw, bg=C_PANEL, pady=6)
        pw.add(mid, minsize=52)
        self._build_run_bar(mid)

        # ── 하단: 출력 ──
        bot = ttk.LabelFrame(pw, text=" 진단 출력 ", padding=(6, 4))
        pw.add(bot, minsize=220)
        self._build_output(bot)

    # ── 연결 설정 ─────────────────────────────────────────────────────────────

    def _build_connection(self, parent):
        for k, label in [("1", "🖥  로컬 (현재 시스템)"),
                          ("2", "🔑  SSH (원격 서버 / PEM)"),
                          ("3", "☁  AWS SSM (EC2 Session Manager)")]:
            ttk.Radiobutton(parent, text=label, variable=self.conn_mode,
                            value=k, command=self._on_conn_change).pack(anchor=tk.W, pady=1)

        self._sep(parent)

        # SSH 필드
        self.f_ssh = ttk.Frame(parent)
        self._label(self.f_ssh, "호스트 / IP")
        ttk.Entry(self.f_ssh, textvariable=self.ssh_host, width=26).pack(anchor=tk.W)
        r = ttk.Frame(self.f_ssh); r.pack(anchor=tk.W)
        self._label(r, "포트"); ttk.Entry(r, textvariable=self.ssh_port, width=7).pack(side=tk.LEFT)
        self._label(r, "  사용자명"); ttk.Entry(r, textvariable=self.ssh_user, width=14).pack(side=tk.LEFT)
        self._label(self.f_ssh, "인증 방식")
        for v, lbl in [("key", "PEM 키 파일"), ("pwd", "패스워드")]:
            ttk.Radiobutton(self.f_ssh, text=lbl, variable=self.ssh_auth,
                            value=v, command=self._on_auth_change).pack(anchor=tk.W)
        # PEM 행
        self.f_pem = ttk.Frame(self.f_ssh)
        self._label(self.f_pem, "PEM 키 파일")
        r2 = ttk.Frame(self.f_pem); r2.pack(anchor=tk.W)
        ttk.Entry(r2, textvariable=self.ssh_key, width=22).pack(side=tk.LEFT)
        ttk.Button(r2, text="찾기", width=4, command=self._browse_pem).pack(side=tk.LEFT, padx=3)
        # Password 행
        self.f_spwd = ttk.Frame(self.f_ssh)
        self._label(self.f_spwd, "패스워드")
        ttk.Entry(self.f_spwd, textvariable=self.ssh_pass, show="●", width=26).pack(anchor=tk.W)

        # SSM 필드
        self.f_ssm = ttk.Frame(parent)
        self._label(self.f_ssm, "EC2 인스턴스 ID (i-xxxxx)")
        ttk.Entry(self.f_ssm, textvariable=self.ssm_id, width=28).pack(anchor=tk.W)
        self._label(self.f_ssm, "AWS 리전")
        ttk.Entry(self.f_ssm, textvariable=self.ssm_region, width=20).pack(anchor=tk.W)
        self._label(self.f_ssm, "자격 증명")
        for v, lbl in [("1", "IAM 키 직접 입력"), ("2", "환경변수 / ~/.aws 자동 사용")]:
            ttk.Radiobutton(self.f_ssm, text=lbl, variable=self.ssm_cred,
                            value=v, command=self._on_cred_change).pack(anchor=tk.W)
        self.f_ssm_key = ttk.Frame(self.f_ssm)
        self._label(self.f_ssm_key, "Access Key ID")
        ttk.Entry(self.f_ssm_key, textvariable=self.ssm_ak, width=28).pack(anchor=tk.W)
        self._label(self.f_ssm_key, "Secret Access Key")
        ttk.Entry(self.f_ssm_key, textvariable=self.ssm_sk, show="●", width=28).pack(anchor=tk.W)
        self._label(self.f_ssm_key, "Session Token (선택)")
        ttk.Entry(self.f_ssm_key, textvariable=self.ssm_tok, show="●", width=28).pack(anchor=tk.W)
        self._label(self.f_ssm, "대상 OS")
        r3 = ttk.Frame(self.f_ssm); r3.pack(anchor=tk.W)
        for v, lbl in [("linux", "Linux"), ("windows", "Windows")]:
            ttk.Radiobutton(r3, text=lbl, variable=self.ssm_os, value=v).pack(side=tk.LEFT, padx=4)

        self._on_conn_change()

    def _on_conn_change(self):
        self.f_ssh.pack_forget()
        self.f_ssm.pack_forget()
        mode = self.conn_mode.get()
        if mode == "2":
            self.f_ssh.pack(fill=tk.X)
            self._on_auth_change()
        elif mode == "3":
            self.f_ssm.pack(fill=tk.X)
            self._on_cred_change()

    def _on_auth_change(self):
        self.f_pem.pack_forget()
        self.f_spwd.pack_forget()
        if self.ssh_auth.get() == "key":
            self.f_pem.pack(fill=tk.X, pady=2)
        else:
            self.f_spwd.pack(fill=tk.X, pady=2)

    def _on_cred_change(self):
        if self.ssm_cred.get() == "1":
            self.f_ssm_key.pack(fill=tk.X, pady=2)
        else:
            self.f_ssm_key.pack_forget()

    def _browse_pem(self):
        p = filedialog.askopenfilename(title="PEM 키 선택",
                                       filetypes=[("PEM", "*.pem"), ("모든 파일", "*.*")])
        if p:
            self.ssh_key.set(p)

    # ── 모듈 선택 ─────────────────────────────────────────────────────────────

    def _build_module(self, parent):
        # 왼쪽: 라디오 버튼
        left = ttk.Frame(parent)
        left.pack(side=tk.LEFT, fill=tk.Y, padx=(0, 14))

        for k, info in MODULES.items():
            ttk.Radiobutton(left, text=info["name"], variable=self.module_key,
                            value=k, command=self._on_module_change).pack(anchor=tk.W, pady=2)

        self._sep(left, orient=tk.HORIZONTAL)
        self._label(left, "진단 대상 (리포트 표시용)")
        ttk.Entry(left, textvariable=self.target_host, width=24).pack(anchor=tk.W)

        # 오른쪽: 옵션
        right = ttk.LabelFrame(parent, text=" 모듈 옵션 ", padding=(8, 4))
        right.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        self.opt_parent = right

        self._build_opt_frames()
        self._on_module_change()

    def _build_opt_frames(self):
        self.opt_frames: dict[str, ttk.Frame] = {}

        # 1, 2, 4 : 추가 옵션 없음
        for k in ("1", "2", "4"):
            f = ttk.Frame(self.opt_parent)
            self._label(f, "이 모듈은 추가 옵션이 없습니다.", fg=C_GRAY)
            self.opt_frames[k] = f

        # 3 Nginx
        f3 = ttk.Frame(self.opt_parent)
        self._label(f3, "nginx.conf 경로  (비워두면 자동 탐색)")
        r = ttk.Frame(f3); r.pack(anchor=tk.W)
        ttk.Entry(r, textvariable=self.nginx_conf, width=32).pack(side=tk.LEFT)
        ttk.Button(r, text="찾기", width=4,
                   command=lambda: self._browse_file(self.nginx_conf, "nginx.conf",
                                                     [("conf", "*.conf"), ("모든", "*.*")])).pack(side=tk.LEFT, padx=3)
        self.opt_frames["3"] = f3

        # 5 DBMS
        f5 = ttk.Frame(self.opt_parent)
        self._label(f5, "DB 종류")
        r5 = ttk.Frame(f5); r5.pack(anchor=tk.W)
        for v, lbl in [("mysql","MySQL"), ("postgresql","PostgreSQL"), ("mssql","MSSQL")]:
            ttk.Radiobutton(r5, text=lbl, variable=self.db_type, value=v,
                            command=self._on_dbtype).pack(side=tk.LEFT, padx=4)
        rp = ttk.Frame(f5); rp.pack(anchor=tk.W, pady=2)
        self._label(rp, "포트"); ttk.Entry(rp, textvariable=self.db_port, width=8).pack(side=tk.LEFT)
        self._label(f5, "접속 계정  (비워두면 포트/네트워크 점검만)")
        ttk.Entry(f5, textvariable=self.db_user_v, width=24).pack(anchor=tk.W)
        self._label(f5, "패스워드")
        ttk.Entry(f5, textvariable=self.db_pass_v, show="●", width=24).pack(anchor=tk.W)
        self.opt_frames["5"] = f5

        # 6 Oracle
        f6 = ttk.Frame(self.opt_parent)
        self._label(f6, "배포 유형")
        r6 = ttk.Frame(f6); r6.pack(anchor=tk.W)
        for v, lbl in [("server","서버 (Linux/Win)"), ("docker","Docker"), ("rds","AWS RDS")]:
            ttk.Radiobutton(r6, text=lbl, variable=self.ora_deploy, value=v).pack(side=tk.LEFT, padx=3)
        self._label(f6, "DB 호스트 / IP")
        ttk.Entry(f6, textvariable=self.ora_host, width=28).pack(anchor=tk.W)
        rr = ttk.Frame(f6); rr.pack(anchor=tk.W, pady=2)
        self._label(rr, "포트"); ttk.Entry(rr, textvariable=self.ora_port, width=8).pack(side=tk.LEFT)
        self._label(rr, "  서비스명/SID"); ttk.Entry(rr, textvariable=self.ora_svc, width=14).pack(side=tk.LEFT)
        self._label(f6, "접속 계정")
        ttk.Entry(f6, textvariable=self.ora_user_v, width=24).pack(anchor=tk.W)
        self._label(f6, "DB 패스워드")
        ttk.Entry(f6, textvariable=self.ora_pass_v, show="●", width=24).pack(anchor=tk.W)
        self.opt_frames["6"] = f6

    def _on_module_change(self):
        for f in self.opt_frames.values():
            f.pack_forget()
        k = self.module_key.get()
        if k in self.opt_frames:
            self.opt_frames[k].pack(fill=tk.BOTH, expand=True)

    def _on_dbtype(self):
        self.db_port.set({"mysql": "3306", "postgresql": "5432", "mssql": "1433"}.get(
            self.db_type.get(), "3306"))

    # ── 실행 바 ──────────────────────────────────────────────────────────────

    def _build_run_bar(self, parent):
        parent.columnconfigure(3, weight=1)

        # 리포트 형식
        self._label_inline(parent, "리포트:", 0, 0)
        ttk.Checkbutton(parent, text="Excel (.xlsx)", variable=self.rpt_excel).grid(row=0, column=1, padx=4)
        ttk.Checkbutton(parent, text="Markdown (.md)", variable=self.rpt_md).grid(row=0, column=2, padx=4)

        # 실행 버튼
        self.run_btn = ttk.Button(parent, text="▶   진단 시작", style="Run.TButton",
                                   command=self._start_scan)
        self.run_btn.grid(row=0, column=4, padx=16, pady=6, ipady=3)

        # 상태
        ttk.Label(parent, textvariable=self.status_var, foreground=C_GRAY).grid(
            row=0, column=5, padx=8)

    # ── 출력 영역 ─────────────────────────────────────────────────────────────

    def _build_output(self, parent):
        self.txt = scrolledtext.ScrolledText(
            parent, wrap=tk.WORD,
            font=("Courier New" if platform.system() == "Windows" else "Menlo", 11),
            bg=C_BG, fg=C_FG, insertbackground=C_FG,
            selectbackground=C_BORDER, selectforeground=C_FG,
            state=tk.DISABLED, relief=tk.FLAT,
        )
        self.txt.pack(fill=tk.BOTH, expand=True)

        # 색상 태그
        self.txt.tag_config("vuln",   foreground=C_RED)
        self.txt.tag_config("safe",   foreground=C_GREEN)
        self.txt.tag_config("warn",   foreground=C_YELLOW)
        self.txt.tag_config("info",   foreground=C_ACCENT)
        self.txt.tag_config("gray",   foreground=C_GRAY)
        self.txt.tag_config("normal", foreground=C_FG)
        self.txt.tag_config("bold",   font=("Courier New" if platform.system() == "Windows" else "Menlo",
                                            11, "bold"), foreground=C_FG)

        # 요약 + 저장 버튼 바
        bot = tk.Frame(parent, bg=C_PANEL, pady=4)
        bot.pack(fill=tk.X)

        self.summary_var = tk.StringVar(value="")
        tk.Label(bot, textvariable=self.summary_var,
                 bg=C_PANEL, fg=C_ACCENT,
                 font=("TkDefaultFont", 10, "bold")).pack(side=tk.LEFT, padx=8)

        self.save_frame = tk.Frame(bot, bg=C_PANEL)
        for lbl, fmt in [("💾 Excel", "excel"), ("💾 Markdown", "md"), ("📋 로그", "log")]:
            tk.Button(self.save_frame, text=lbl, bg=C_BTN, fg=C_FG,
                      relief=tk.FLAT, padx=8,
                      command=lambda f=fmt: self._save_report(f)).pack(side=tk.LEFT, padx=3)
        # save_frame은 스캔 완료 후에만 표시

        # 지우기 버튼
        tk.Button(bot, text="🗑 지우기", bg=C_BTN, fg=C_GRAY,
                  relief=tk.FLAT, padx=6, command=self._clear_output).pack(side=tk.RIGHT, padx=8)

    # ── 출력 폴링 ─────────────────────────────────────────────────────────────

    def _poll_output(self):
        try:
            while True:
                text = self.output_q.get_nowait()
                self._append(text)
        except queue.Empty:
            pass
        self.root.after(40, self._poll_output)

    def _append(self, text: str):
        self.txt.config(state=tk.NORMAL)
        tag = "normal"
        if "[취약]" in text:
            tag = "vuln"
        elif "[양호]" in text:
            tag = "safe"
        elif "[검토]" in text or "[ N/A]" in text or "[n/a]" in text.lower():
            tag = "warn"
        elif text.lstrip().startswith("[*]") or text.lstrip().startswith("[!]"):
            tag = "info"
        elif text.startswith("  ["):
            tag = "info"
        elif text.startswith("─") or text.startswith("═"):
            tag = "gray"
        self.txt.insert(tk.END, text, tag)
        self.txt.see(tk.END)
        self.txt.config(state=tk.DISABLED)

    def _clear_output(self):
        self.txt.config(state=tk.NORMAL)
        self.txt.delete("1.0", tk.END)
        self.txt.config(state=tk.DISABLED)
        self.summary_var.set("")
        self.save_frame.pack_forget()

    # ── 진단 실행 ─────────────────────────────────────────────────────────────

    def _start_scan(self):
        if self.scan_thread and self.scan_thread.is_alive():
            messagebox.showwarning("진행 중", "이미 진단이 실행 중입니다.")
            return
        if not self.rpt_excel.get() and not self.rpt_md.get():
            if not messagebox.askyesno("알림",
                    "리포트 형식이 선택되지 않았습니다.\n"
                    "로그(txt)만 자동 저장됩니다.\n계속하시겠습니까?"):
                return

        self.run_btn.config(state=tk.DISABLED)
        self.status_var.set("진단 중...")
        self.save_frame.pack_forget()
        self.summary_var.set("")
        self._clear_output()
        self._report = None

        self.scan_thread = threading.Thread(target=self._scan_worker, daemon=True)
        self.scan_thread.start()

    def _scan_worker(self):
        old_stdout = sys.stdout
        sys.stdout = StdoutQueue(self.output_q)
        executor = None

        try:
            # 1. 연결
            executor = self._build_executor()

            # 2. 옵션
            opts = self._build_opts(executor)

            # 3. 스캐너 로드 & 실행
            k = self.module_key.get()
            ScannerClass = MODULES[k]["loader"]()
            valid = set(inspect.signature(ScannerClass.__init__).parameters) - {"self"}
            scanner = ScannerClass(**{p: v for p, v in opts.items() if p in valid})
            report = scanner.run()
            self._report = report

            # 4. 리포트 저장
            saved = []
            log_path = reporter.save_log(report)
            saved.append(f"로그: {log_path}")
            if self.rpt_excel.get():
                p = reporter.save_excel(report)
                saved.append(f"Excel: {p}")
            if self.rpt_md.get():
                p = reporter.save_markdown(report)
                saved.append(f"MD: {p}")

            print("\n" + "─" * 60)
            print("  진단 완료")
            for s in saved:
                print(f"  ✓ {s}")
            print("─" * 60)

            self.root.after(0, lambda: self._on_done(report))

        except Exception as e:
            import traceback
            print(f"\n[오류] {e}\n{traceback.format_exc()}")
            err_msg = str(e)
            self.root.after(0, lambda m=err_msg: self._on_error(m))

        finally:
            sys.stdout = old_stdout
            if executor is not None:
                try:
                    executor.close()
                except Exception:
                    pass

    def _build_executor(self):
        """연결 방식에 따라 executor 반환 (None = 로컬)"""
        mode = self.conn_mode.get()
        if mode == "1":
            return None

        if mode == "2":
            host = self.ssh_host.get().strip()
            if not host:
                raise ValueError("SSH 호스트를 입력하세요.")
            port = int(self.ssh_port.get() or 22)
            user = self.ssh_user.get().strip() or "ec2-user"
            key_path = password = None
            if self.ssh_auth.get() == "key":
                kp = self.ssh_key.get().strip()
                key_path = os.path.expanduser(kp) if kp else None
            else:
                password = self.ssh_pass.get() or None

            print(f"\n  → SSH 연결 중 ({user}@{host}:{port})...")
            from core.remote import SSHExecutor
            ex = SSHExecutor(host, port, user, key_path, password)
            print("  ✓ SSH 연결 성공\n")
            return ex

        if mode == "3":
            iid = self.ssm_id.get().strip()
            if not iid:
                raise ValueError("EC2 인스턴스 ID를 입력하세요.")
            region = self.ssm_region.get().strip() or "ap-northeast-2"
            ak = sk = tok = None
            if self.ssm_cred.get() == "1":
                ak = self.ssm_ak.get().strip() or None
                sk = self.ssm_sk.get() or None
                tok = self.ssm_tok.get() or None
            os_type = self.ssm_os.get()
            ping = "echo OK" if os_type == "linux" else "Write-Output OK"

            print(f"\n  → SSM 연결 확인 중 ({iid} / {region} / {os_type})...")
            from core.remote import SSMExecutor
            ex = SSMExecutor(iid, region, ak, sk, tok, platform=os_type)
            rc, out, err = ex.run_shell(ping, timeout=30)
            if rc != 0 or "OK" not in out:
                raise RuntimeError(err or "SSM 응답 없음")
            print("  ✓ SSM 연결 성공\n")
            return ex

        return None

    def _build_opts(self, executor) -> dict:
        target = self.target_host.get().strip() or "localhost"
        opts = {"target": target, "verbose": True}
        if executor:
            opts["executor"] = executor

        k = self.module_key.get()
        if k == "3":
            conf = self.nginx_conf.get().strip()
            if conf:
                opts["conf_path"] = conf
        elif k == "5":
            opts["db_type"] = self.db_type.get()
            opts["port"]    = int(self.db_port.get() or 3306)
            opts["user"]    = self.db_user_v.get().strip()
            if opts["user"]:
                opts["password"] = self.db_pass_v.get()
        elif k == "6":
            opts["deploy_type"]  = self.ora_deploy.get()
            opts["db_host"]      = self.ora_host.get().strip() or target
            opts["db_port"]      = int(self.ora_port.get() or 1521)
            opts["service_name"] = self.ora_svc.get().strip() or "ORCL"
            opts["db_user"]      = self.ora_user_v.get().strip() or "system"
            opts["db_password"]  = self.ora_pass_v.get()
        return opts

    def _on_done(self, report):
        self.run_btn.config(state=tk.NORMAL)
        self.status_var.set("완료 ✓")
        s = report.summary
        review = s["manual"] + s["error"]
        self.summary_var.set(
            f"전체 {s['total']}  │  "
            f"취약 {s['vulnerable']}  │  "
            f"양호 {s['safe']}  │  "
            f"검토 {review}  │  "
            f"N/A {s['skipped']}    ·    "
            f"위험 {s['by_severity']['위험']}  "
            f"높음 {s['by_severity']['높음']}  "
            f"보통 {s['by_severity']['보통']}  "
            f"낮음 {s['by_severity']['낮음']}"
        )
        self.save_frame.pack(side=tk.LEFT)

    def _on_error(self, msg: str):
        self.run_btn.config(state=tk.NORMAL)
        self.status_var.set("오류 ✗")
        messagebox.showerror("진단 오류", msg)

    def _save_report(self, fmt: str):
        if not self._report:
            messagebox.showwarning("알림", "저장할 리포트가 없습니다.")
            return
        try:
            if fmt == "excel":
                p = reporter.save_excel(self._report)
            elif fmt == "md":
                p = reporter.save_markdown(self._report)
            else:
                p = reporter.save_log(self._report)
            messagebox.showinfo("저장 완료", f"저장되었습니다:\n{p}")
        except Exception as e:
            messagebox.showerror("저장 오류", str(e))

    # ── 헬퍼 ─────────────────────────────────────────────────────────────────

    def _label(self, parent, text: str, fg: str = C_FG):
        tk.Label(parent, text=text, bg=C_BG, fg=fg,
                 font=("TkDefaultFont", 9)).pack(anchor=tk.W, pady=(4, 0))

    def _label_inline(self, parent, text: str, row: int, col: int):
        tk.Label(parent, text=text, bg=C_PANEL, fg=C_FG,
                 font=("TkDefaultFont", 10)).grid(row=row, column=col, padx=(12, 2), pady=4)

    def _sep(self, parent, orient=tk.HORIZONTAL):
        ttk.Separator(parent, orient=orient).pack(fill=tk.X if orient == tk.HORIZONTAL else tk.Y,
                                                   pady=6)

    def _browse_file(self, var: tk.StringVar, title: str, filetypes: list):
        p = filedialog.askopenfilename(title=title, filetypes=filetypes)
        if p:
            var.set(p)


def main():
    root = tk.Tk()
    # 앱 아이콘 (오류 무시)
    try:
        root.iconbitmap("icon.ico")
    except Exception:
        pass
    app = VulnScannerGUI(root)
    root.mainloop()


if __name__ == "__main__":
    main()
