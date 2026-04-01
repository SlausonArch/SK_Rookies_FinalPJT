"""
원격 실행기 (SSH / AWS SSM / Docker)
BaseScanner._run_cmd / _run_shell / _read_file 에 주입해 원격 진단에 사용
"""
from __future__ import annotations
import io
import time
import json
import shlex
from typing import Optional


# ══════════════════════════════════════════════════════
# SSH Executor (paramiko 기반)
# ══════════════════════════════════════════════════════

class SSHExecutor:
    """SSH를 통해 원격 호스트에서 명령 실행 및 파일 읽기"""

    def __init__(
        self,
        host: str,
        port: int = 22,
        username: str = "ec2-user",
        key_path: Optional[str] = None,
        password: Optional[str] = None,
    ):
        try:
            import paramiko
        except ImportError:
            raise RuntimeError("paramiko 미설치 — pip install paramiko")

        self.host = host
        self.username = username
        self._client = paramiko.SSHClient()
        self._client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

        connect_kwargs: dict = dict(
            hostname=host, port=port, username=username, timeout=15,
            allow_agent=True, look_for_keys=(key_path is None and password is None),
        )
        if key_path:
            connect_kwargs["key_filename"] = key_path
        if password:
            connect_kwargs["password"] = password

        self._client.connect(**connect_kwargs)

    # ── 내부 실행 ────────────────────────────────────

    def _exec(self, cmd: str, timeout: int) -> tuple[int, str, str]:
        try:
            stdin, stdout, stderr = self._client.exec_command(cmd, timeout=timeout)
            rc   = stdout.channel.recv_exit_status()
            out  = stdout.read().decode("utf-8", errors="replace").strip()
            err  = stderr.read().decode("utf-8", errors="replace").strip()
            return rc, out, err
        except Exception as e:
            return -1, "", str(e)

    # ── public API (BaseScanner 인터페이스와 동일) ─────

    def run_cmd(self, cmd: str, timeout: int = 10) -> tuple[int, str, str]:
        """shlex.split 불필요 — SSH는 셸 문자열을 그대로 전달"""
        return self._exec(cmd, timeout)

    def run_shell(self, cmd: str, timeout: int = 10) -> tuple[int, str, str]:
        return self._exec(cmd, timeout)

    def read_file(self, path: str) -> Optional[str]:
        rc, out, _ = self._exec(f"cat {shlex.quote(path)} 2>/dev/null", timeout=10)
        return out if rc == 0 and out else None

    def close(self):
        self._client.close()

    def __repr__(self):
        return f"SSHExecutor({self.username}@{self.host})"


# ══════════════════════════════════════════════════════
# AWS SSM Executor (boto3 기반)
# ══════════════════════════════════════════════════════

class SSMExecutor:
    """
    AWS Systems Manager Run Command(send_command) 를 통해
    EC2 인스턴스에서 명령 실행 및 파일 읽기.

    사전 조건:
      - 인스턴스에 SSM Agent 설치 및 AmazonSSMManagedInstanceCore 정책 부여
      - 호출 측에 ssm:SendCommand / ssm:GetCommandInvocation 권한 필요
    """

    _POLL_INTERVAL = 1   # 결과 조회 간격(초)
    _MAX_WAIT      = 60  # 최대 대기(초)

    def __init__(
        self,
        instance_id: str,
        region: str,
        aws_access_key_id: Optional[str] = None,
        aws_secret_access_key: Optional[str] = None,
        aws_session_token: Optional[str] = None,
        platform: str = "linux",   # "linux" | "windows"
    ):
        try:
            import boto3
        except ImportError:
            raise RuntimeError("boto3 미설치 — pip install boto3")

        self.instance_id = instance_id
        self.region = region
        # Linux: AWS-RunShellScript / Windows: AWS-RunPowerShellScript
        self._document = (
            "AWS-RunPowerShellScript" if platform == "windows"
            else "AWS-RunShellScript"
        )

        session_kwargs: dict = dict(region_name=region)
        if aws_access_key_id:
            session_kwargs["aws_access_key_id"]     = aws_access_key_id
            session_kwargs["aws_secret_access_key"] = aws_secret_access_key
        if aws_session_token:
            session_kwargs["aws_session_token"] = aws_session_token

        import boto3
        self._ssm = boto3.client("ssm", **session_kwargs)

    # ── 내부 실행 ────────────────────────────────────

    def _exec(self, cmd: str, timeout: int) -> tuple[int, str, str]:
        try:
            resp = self._ssm.send_command(
                InstanceIds=[self.instance_id],
                DocumentName=self._document,
                Parameters={"commands": [cmd]},
                TimeoutSeconds=max(timeout, 30),
            )
            cmd_id = resp["Command"]["CommandId"]

            elapsed = 0
            while elapsed < self._MAX_WAIT:
                time.sleep(self._POLL_INTERVAL)
                elapsed += self._POLL_INTERVAL
                inv = self._ssm.get_command_invocation(
                    CommandId=cmd_id,
                    InstanceId=self.instance_id,
                )
                status = inv["Status"]
                if status in ("Success", "Failed", "TimedOut", "Cancelled"):
                    rc  = 0 if status == "Success" else 1
                    out = inv.get("StandardOutputContent", "").strip()
                    err = inv.get("StandardErrorContent", "").strip()
                    if rc != 0 and not err:
                        err = f"[SSM Status={status}]"
                    return rc, out, err

            return -1, "", f"SSM timeout after {self._MAX_WAIT}s"
        except Exception as e:
            # InvalidInstanceId 는 호출 측에서 직접 처리하도록 재raise
            raise

    # ── public API ────────────────────────────────────

    def run_cmd(self, cmd: str, timeout: int = 10) -> tuple[int, str, str]:
        return self._exec(cmd, timeout)

    def run_shell(self, cmd: str, timeout: int = 10) -> tuple[int, str, str]:
        return self._exec(cmd, timeout)

    def read_file(self, path: str) -> Optional[str]:
        rc, out, _ = self._exec(f"cat {shlex.quote(path)} 2>/dev/null", timeout=10)
        return out if rc == 0 and out else None

    def close(self):
        pass  # boto3 client는 별도 close 불필요

    def __repr__(self):
        return f"SSMExecutor({self.instance_id} @ {self.region})"


# ══════════════════════════════════════════════════════
# Docker Executor (docker exec 기반)
# ══════════════════════════════════════════════════════

class DockerExecutor:
    """
    로컬 Docker 컨테이너 내부에서 명령 실행 및 파일 읽기.
    docker CLI가 설치되어 있고, 해당 컨테이너가 실행 중이어야 함.
    """

    def __init__(self, container: str):
        self.container = container

    def _exec(self, cmd: str, timeout: int) -> tuple[int, str, str]:
        import subprocess
        full = f"docker exec {shlex.quote(self.container)} sh -c {shlex.quote(cmd)}"
        try:
            r = subprocess.run(full, shell=True, capture_output=True,
                               text=True, timeout=timeout)
            return r.returncode, r.stdout.strip(), r.stderr.strip()
        except subprocess.TimeoutExpired:
            return -1, "", f"docker exec timeout after {timeout}s"
        except Exception as e:
            return -1, "", str(e)

    def run_cmd(self, cmd: str, timeout: int = 10) -> tuple[int, str, str]:
        return self._exec(cmd, timeout)

    def run_shell(self, cmd: str, timeout: int = 10) -> tuple[int, str, str]:
        return self._exec(cmd, timeout)

    def read_file(self, path: str) -> Optional[str]:
        rc, out, _ = self._exec(f"cat {shlex.quote(path)} 2>/dev/null", timeout=10)
        return out if rc == 0 and out else None

    def close(self):
        pass

    def __repr__(self):
        return f"DockerExecutor({self.container})"


# ══════════════════════════════════════════════════════
# Remote Docker Executor (SSH/SSM → docker exec 체이닝)
# ══════════════════════════════════════════════════════

class RemoteDockerExecutor:
    """
    SSH 또는 SSM Executor를 통해 원격 EC2 안의 Docker 컨테이너에서 명령 실행.
    예: 로컬 → SSH → EC2 → docker exec nginx-container
    """

    def __init__(self, base_executor, container: str):
        self._base      = base_executor
        self.container  = container

    def _wrap(self, cmd: str) -> str:
        return f"docker exec {shlex.quote(self.container)} sh -c {shlex.quote(cmd)}"

    def run_cmd(self, cmd: str, timeout: int = 10) -> tuple[int, str, str]:
        return self._base.run_shell(self._wrap(cmd), timeout)

    def run_shell(self, cmd: str, timeout: int = 10) -> tuple[int, str, str]:
        return self._base.run_shell(self._wrap(cmd), timeout)

    def read_file(self, path: str) -> Optional[str]:
        rc, out, _ = self.run_shell(f"cat {shlex.quote(path)} 2>/dev/null", timeout=10)
        return out if rc == 0 and out else None

    def close(self):
        try:
            self._base.close()
        except Exception:
            pass

    def __repr__(self):
        return f"RemoteDockerExecutor({self.container} via {self._base})"
