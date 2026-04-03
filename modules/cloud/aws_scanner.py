"""
AWS Cloud 취약점 진단 모듈
SK Shieldus AWS 보안 가이드라인 기반
주통기 2026 개정 반영

[2026 개정 추가 항목]
  C-1.11  IAM 액세스 키 교체 주기 점검     (2026 신규 — 90일 이하 교체 권장)
  C-4.14  AWS Config 서비스 활성화 점검    (2026 신규 — 리소스 구성 변경 추적)
  C-4.15  GuardDuty 활성화 점검           (2026 신규 — 위협 탐지 서비스)

점검 항목:
  1. 계정 관리   (C-1.1 ~ C-1.11) ★2026 C-1.11 추가
  2. 권한 관리   (C-2.1 ~ C-2.3)  — 수동 점검
  3. 가상 리소스 (C-3.1 ~ C-3.8)
  4. 운영 관리   (C-4.1 ~ C-4.15) ★2026 C-4.14, C-4.15 추가
"""
from __future__ import annotations
from datetime import datetime, timezone
from core.base_scanner import BaseScanner
from core.result import ScanReport, Severity


class AWSScanner(BaseScanner):
    CATEGORY = "Cloud-AWS"

    def __init__(
        self,
        target: str = "AWS",
        verbose: bool = False,
        executor=None,
        aws_access_key_id: str = "",
        aws_secret_access_key: str = "",
        aws_session_token: str = "",
        region: str = "ap-northeast-2",
    ):
        super().__init__(target, verbose, executor)
        self.region = region or "ap-northeast-2"
        self._ak  = aws_access_key_id or None
        self._sk  = aws_secret_access_key or None
        self._tok = aws_session_token or None
        self._cache: dict = {}

    # ── boto3 클라이언트 ───────────────────────────────────────────────
    def _client(self, service: str):
        if service not in self._cache:
            try:
                import boto3
            except ImportError:
                raise RuntimeError("boto3 미설치 — pip install boto3")
            kw: dict = dict(region_name=self.region)
            if self._ak:
                kw["aws_access_key_id"]     = self._ak
                kw["aws_secret_access_key"] = self._sk
            if self._tok:
                kw["aws_session_token"] = self._tok
            self._cache[service] = boto3.client(service, **kw)
        return self._cache[service]

    def _paginate(self, service: str, method: str, key: str, **kwargs) -> list:
        """페이지네이션 처리하여 전체 결과 반환."""
        client = self._client(service)
        results = []
        paginator = client.get_paginator(method)
        for page in paginator.paginate(**kwargs):
            results.extend(page.get(key, []))
        return results

    # ── run ───────────────────────────────────────────────────────────────
    def run(self) -> ScanReport:
        print(f"\n[*] AWS Cloud 취약점 진단 시작 → 리전: {self.region}\n")

        checks = [
            # 계정 관리
            ("C-1.1",  self._chk_iam_admin_accounts),
            ("C-1.2",  self._chk_iam_user_single),
            ("C-1.3",  self._chk_iam_user_tags),
            ("C-1.4",  self._chk_iam_group_users),
            ("C-1.5",  self._chk_ec2_key_pair),
            ("C-1.6",  self._chk_key_pair_storage),
            ("C-1.7",  self._chk_root_console_usage),
            ("C-1.8",  self._chk_access_key_mgmt),
            ("C-1.9",  self._chk_mfa),
            ("C-1.10", self._chk_password_policy),
            ("C-1.11", self._chk_access_key_rotation),  # ★2026
            # 권한 관리
            ("C-2.1",  self._chk_instance_policy),
            ("C-2.2",  self._chk_network_policy),
            ("C-2.3",  self._chk_other_policy),
            # 가상 리소스
            ("C-3.1",  self._chk_sg_any_port),
            ("C-3.2",  self._chk_sg_any_source),
            ("C-3.3",  self._chk_nacl),
            ("C-3.4",  self._chk_route_table),
            ("C-3.5",  self._chk_igw),
            ("C-3.6",  self._chk_nat_gw),
            ("C-3.7",  self._chk_s3_access),
            ("C-3.8",  self._chk_rds_subnet),
            # 운영 관리
            ("C-4.1",  self._chk_ebs_encryption),
            ("C-4.2",  self._chk_rds_encryption),
            ("C-4.3",  self._chk_s3_encryption),
            ("C-4.4",  self._chk_tls_encryption),
            ("C-4.5",  self._chk_cloudtrail_encryption),
            ("C-4.6",  self._chk_cloudwatch_encryption),
            ("C-4.7",  self._chk_cloudtrail_logging),
            ("C-4.8",  self._chk_instance_logging),
            ("C-4.9",  self._chk_rds_logging),
            ("C-4.10", self._chk_s3_logging),
            ("C-4.11", self._chk_vpc_flow_log),
            ("C-4.12", self._chk_log_retention),
            ("C-4.13", self._chk_backup),
            ("C-4.14", self._chk_aws_config),       # ★2026
            ("C-4.15", self._chk_guardduty),         # ★2026
        ]

        for cid, fn in checks:
            try:
                fn()
            except Exception as e:
                err = str(e)
                name = fn.__name__.replace("_chk_", "").replace("_", " ").upper()
                if "AccessDenied" in err or "UnauthorizedAccess" in err:
                    self.error(cid, name, Severity.HIGH,
                               f"[{cid}] 권한 부족으로 점검 불가",
                               f"API 오류: {err[:200]}",
                               "해당 항목을 점검할 IAM 권한을 부여하세요.")
                else:
                    self.error(cid, name, Severity.HIGH,
                               f"[{cid}] 점검 중 오류",
                               f"오류: {err[:200]}", "수동 점검 필요")

        print("\n[*] AWS 진단 완료\n")
        return self.report

    # ══════════════════════════════════════════════════════════════════
    # 1. 계정 관리
    # ══════════════════════════════════════════════════════════════════

    def _chk_iam_admin_accounts(self):
        """C-1.1 사용자 계정 관리 — AdministratorAccess 보유 계정 다수 확인"""
        iam = self._client("iam")
        users = self._paginate("iam", "list_users", "Users")
        admin_users = []
        for u in users:
            uname = u["UserName"]
            # 직접 연결된 정책
            attached = iam.list_attached_user_policies(UserName=uname)["AttachedPolicies"]
            for p in attached:
                if p["PolicyName"] in ("AdministratorAccess", "PowerUserAccess"):
                    admin_users.append(f"{uname} (직접: {p['PolicyName']})")
            # 그룹 경유 정책
            groups = iam.list_groups_for_user(UserName=uname)["Groups"]
            for g in groups:
                gp = iam.list_attached_group_policies(GroupName=g["GroupName"])["AttachedPolicies"]
                for p in gp:
                    if p["PolicyName"] == "AdministratorAccess":
                        admin_users.append(f"{uname} (그룹 {g['GroupName']}: {p['PolicyName']})")

        if len(admin_users) > 1:
            self.vulnerable("C-1.1", "사용자 계정 관리", Severity.HIGH,
                            "AdministratorAccess 권한 보유 계정이 다수 존재합니다.",
                            f"관리자 권한 계정 ({len(admin_users)}개):\n" + "\n".join(admin_users),
                            "관리자 권한 계정을 최소화하고 불필요한 계정은 삭제하세요.")
        elif len(admin_users) == 1:
            self.safe("C-1.1", "사용자 계정 관리", Severity.HIGH,
                      "AdministratorAccess 권한 보유 계정이 1개입니다.",
                      f"관리자 계정: {admin_users[0]}",
                      "관리자 권한 계정을 최소화하여 유지하세요.")
        else:
            self.safe("C-1.1", "사용자 계정 관리", Severity.HIGH,
                      "AdministratorAccess 직접 부여 계정이 없습니다.",
                      "IAM 사용자에 AdministratorAccess 직접 부여 없음",
                      "양호")

    def _chk_iam_user_single(self):
        """C-1.2 IAM 사용자 계정 단일화 — 수동 점검"""
        users = self._paginate("iam", "list_users", "Users")
        names = [u["UserName"] for u in users]
        self.manual("C-1.2", "IAM 사용자 계정 단일화 관리", Severity.MEDIUM,
                    "1인 1계정 원칙 준수 여부는 수동 확인이 필요합니다.",
                    f"현재 IAM 사용자 수: {len(names)}명\n사용자 목록:\n" + "\n".join(names[:20]),
                    "각 사용자가 1인 1계정을 사용하는지 확인하고 공용 계정을 제거하세요.")

    def _chk_iam_user_tags(self):
        """C-1.3 IAM 사용자 계정 식별 관리 — 태그 설정 확인"""
        iam = self._client("iam")
        users = self._paginate("iam", "list_users", "Users")
        no_tag = []
        for u in users:
            tags = iam.list_user_tags(UserName=u["UserName"])["Tags"]
            if not tags:
                no_tag.append(u["UserName"])
        if no_tag:
            self.vulnerable("C-1.3", "IAM 사용자 계정 식별 관리", Severity.MEDIUM,
                            "태그가 설정되지 않은 IAM 사용자가 있습니다.",
                            f"태그 없는 사용자 ({len(no_tag)}명):\n" + "\n".join(no_tag),
                            "각 IAM 사용자에 이름, 이메일, 부서 등 식별 태그를 설정하세요.")
        else:
            self.safe("C-1.3", "IAM 사용자 계정 식별 관리", Severity.MEDIUM,
                      "모든 IAM 사용자에 태그가 설정되어 있습니다.",
                      f"전체 사용자 {len(users)}명 태그 확인 완료",
                      "양호")

    def _chk_iam_group_users(self):
        """C-1.4 IAM 그룹 사용자 계정 관리 — 그룹 미소속 사용자 확인"""
        iam = self._client("iam")
        users = self._paginate("iam", "list_users", "Users")
        no_group = []
        for u in users:
            groups = iam.list_groups_for_user(UserName=u["UserName"])["Groups"]
            if not groups:
                no_group.append(u["UserName"])
        if no_group:
            self.vulnerable("C-1.4", "IAM 그룹 사용자 계정 관리", Severity.MEDIUM,
                            "어떤 그룹에도 속하지 않은 IAM 사용자가 있습니다.",
                            f"그룹 미소속 사용자 ({len(no_group)}명):\n" + "\n".join(no_group),
                            "IAM 사용자를 적절한 그룹에 배치하고 그룹 단위로 권한을 관리하세요.")
        else:
            self.safe("C-1.4", "IAM 그룹 사용자 계정 관리", Severity.MEDIUM,
                      "모든 IAM 사용자가 그룹에 소속되어 있습니다.",
                      f"전체 사용자 {len(users)}명 그룹 소속 확인 완료",
                      "양호")

    def _chk_ec2_key_pair(self):
        """C-1.5 Key Pair 접근 관리 — EC2 인스턴스 Key Pair 사용 확인"""
        ec2 = self._client("ec2")
        instances = []
        resp = ec2.describe_instances()
        for r in resp["Reservations"]:
            for i in r["Instances"]:
                if i["State"]["Name"] not in ("terminated", "shutting-down"):
                    instances.append(i)
        no_kp = [i.get("InstanceId","?") for i in instances if not i.get("KeyName")]
        if no_kp:
            self.vulnerable("C-1.5", "Key Pair 접근 관리", Severity.HIGH,
                            "Key Pair 없이 실행 중인 EC2 인스턴스가 있습니다.",
                            f"Key Pair 미설정 인스턴스:\n" + "\n".join(no_kp),
                            "EC2 인스턴스 접근 시 Key Pair(PEM)를 사용하도록 설정하세요.")
        else:
            self.safe("C-1.5", "Key Pair 접근 관리", Severity.HIGH,
                      "모든 실행 중인 EC2 인스턴스에 Key Pair가 설정되어 있습니다.",
                      f"확인된 인스턴스 {len(instances)}개 모두 Key Pair 사용",
                      "양호")

    def _chk_key_pair_storage(self):
        """C-1.6 Key Pair 보관 관리 — 수동 점검"""
        self.manual("C-1.6", "Key Pair 보관 관리", Severity.HIGH,
                    "Key Pair 파일의 보관 위치는 수동 확인이 필요합니다.",
                    "Key Pair 파일이 공용 접근 가능한 위치(퍼블릭 S3, Admin Console 루트 등)에 저장되어 있지 않은지 확인하세요.",
                    "Key Pair를 프라이빗 S3 버킷 또는 안전한 비밀 관리 서비스에 보관하세요.")

    def _chk_root_console_usage(self):
        """C-1.7 Admin Console 관리자 정책 관리 — 루트 계정 액세스 키 확인"""
        iam = self._client("iam")
        import io, csv
        report = iam.get_credential_report()
        content = report["Content"].decode("utf-8")
        reader = csv.DictReader(io.StringIO(content))
        for row in reader:
            if row.get("user") == "<root_account>":
                ak1 = row.get("access_key_1_active", "false")
                ak2 = row.get("access_key_2_active", "false")
                if ak1 == "true" or ak2 == "true":
                    self.vulnerable("C-1.7", "Admin Console 관리자 정책 관리", Severity.MEDIUM,
                                    "루트 계정에 활성화된 Access Key가 존재합니다.",
                                    f"access_key_1_active={ak1}, access_key_2_active={ak2}",
                                    "루트 계정의 Access Key를 즉시 삭제하고 IAM 사용자 계정을 사용하세요.")
                else:
                    self.safe("C-1.7", "Admin Console 관리자 정책 관리", Severity.MEDIUM,
                              "루트 계정에 활성 Access Key가 없습니다.", "루트 계정 Access Key 없음", "양호")
                return
        self.manual("C-1.7", "Admin Console 관리자 정책 관리", Severity.MEDIUM,
                    "Credential Report 생성 후 재시도 필요",
                    "IAM > 자격 증명 보고서 생성 후 점검하세요.",
                    "루트 계정은 일상 업무에 사용하지 않도록 하세요.")

    def _chk_access_key_mgmt(self):
        """C-1.8 Access Key 활성화 및 사용주기 관리 — 90일 초과 키 확인"""
        iam = self._client("iam")
        users = self._paginate("iam", "list_users", "Users")
        old_keys = []
        now = datetime.now(timezone.utc)
        for u in users:
            keys = iam.list_access_keys(UserName=u["UserName"])["AccessKeyMetadata"]
            for k in keys:
                if k["Status"] != "Active":
                    continue
                age = (now - k["CreateDate"]).days
                if age > 90:
                    old_keys.append(f"{u['UserName']} — KeyId: {k['AccessKeyId'][:8]}... ({age}일 경과)")
        if old_keys:
            self.vulnerable("C-1.8", "Admin Console 계정 Access Key 관리", Severity.HIGH,
                            f"90일 초과 Active Access Key가 {len(old_keys)}개 존재합니다.",
                            "\n".join(old_keys),
                            "Access Key 사용 주기를 60일 이내로 관리하고 미사용 키는 삭제하세요.")
        else:
            self.safe("C-1.8", "Admin Console 계정 Access Key 관리", Severity.HIGH,
                      "모든 Active Access Key가 90일 이내입니다.",
                      f"전체 사용자 {len(users)}명 Access Key 확인 완료",
                      "양호")

    def _chk_mfa(self):
        """C-1.9 MFA 설정 — 루트 및 IAM 사용자 MFA 확인"""
        iam = self._client("iam")
        issues = []
        # 루트 MFA
        acct = iam.get_account_summary()["SummaryMap"]
        if not acct.get("AccountMFAEnabled", 0):
            issues.append("루트 계정 MFA 비활성화")
        # IAM 사용자 MFA
        users = self._paginate("iam", "list_users", "Users")
        for u in users:
            devices = iam.list_mfa_devices(UserName=u["UserName"])["MFADevices"]
            if not devices:
                issues.append(f"IAM 사용자 '{u['UserName']}' MFA 미설정")
        if issues:
            self.vulnerable("C-1.9", "MFA 설정", Severity.MEDIUM,
                            f"MFA가 설정되지 않은 계정이 {len(issues)}개 있습니다.",
                            "\n".join(issues),
                            "루트 계정 및 모든 IAM 사용자에 MFA를 활성화하세요.")
        else:
            self.safe("C-1.9", "MFA 설정", Severity.MEDIUM,
                      "루트 및 모든 IAM 사용자에 MFA가 설정되어 있습니다.",
                      "MFA 설정 확인 완료", "양호")

    def _chk_password_policy(self):
        """C-1.10 AWS 계정 패스워드 정책 관리"""
        iam = self._client("iam")
        try:
            policy = iam.get_account_password_policy()["PasswordPolicy"]
        except Exception:
            self.vulnerable("C-1.10", "AWS 계정 패스워드 정책 관리", Severity.MEDIUM,
                            "IAM 패스워드 정책이 설정되어 있지 않습니다.",
                            "get_account_password_policy 응답 없음",
                            "IAM 패스워드 정책을 설정하세요 (최소 8자, 복잡성, 만료 90일 이내).")
            return
        issues = []
        if policy.get("MinimumPasswordLength", 0) < 8:
            issues.append(f"최소 길이 {policy.get('MinimumPasswordLength')}자 (권고: 8자 이상)")
        if not policy.get("RequireUppercaseCharacters"):
            issues.append("대문자 요구 미설정")
        if not policy.get("RequireLowercaseCharacters"):
            issues.append("소문자 요구 미설정")
        if not policy.get("RequireNumbers"):
            issues.append("숫자 요구 미설정")
        if not policy.get("RequireSymbols"):
            issues.append("특수문자 요구 미설정")
        max_age = policy.get("MaxPasswordAge")
        if not max_age or max_age > 90:
            issues.append(f"최대 사용 기간 {max_age}일 (권고: 90일 이하)")
        if not policy.get("PasswordReusePrevention"):
            issues.append("이전 패스워드 재사용 제한 미설정")
        if issues:
            self.vulnerable("C-1.10", "AWS 계정 패스워드 정책 관리", Severity.MEDIUM,
                            "패스워드 정책이 권고 기준에 미달합니다.",
                            "\n".join(issues),
                            "IAM 패스워드 정책에서 복잡성·만료·재사용 제한을 설정하세요.")
        else:
            self.safe("C-1.10", "AWS 계정 패스워드 정책 관리", Severity.MEDIUM,
                      "패스워드 정책이 권고 기준을 충족합니다.",
                      str(policy), "양호")

    # ══════════════════════════════════════════════════════════════════
    # 2. 권한 관리 (수동 점검)
    # ══════════════════════════════════════════════════════════════════

    def _chk_instance_policy(self):
        """C-2.1 인스턴스 서비스 정책 관리 — 수동 점검"""
        self.manual("C-2.1", "인스턴스 서비스 정책 관리", Severity.HIGH,
                    "EC2/RDS/S3 등 인스턴스 서비스별 IAM 권한이 역할에 맞게 설정되어 있는지 수동 확인이 필요합니다.",
                    "서비스별 FullAccess 등 고권한 정책이 Infra 운영자 외에 부여되지 않았는지 확인하세요.",
                    "각 서비스 역할에 최소 권한 원칙(PoLP)을 적용하세요.")

    def _chk_network_policy(self):
        """C-2.2 네트워크 서비스 정책 관리 — 수동 점검"""
        self.manual("C-2.2", "네트워크 서비스 정책 관리", Severity.HIGH,
                    "VPC/Route53/DirectConnect 등 네트워크 서비스 IAM 권한을 수동으로 확인하세요.",
                    "AmazonVPCFullAccess 등 네트워크 관련 고권한 정책의 부여 대상을 확인하세요.",
                    "네트워크 서비스 권한은 Infra 운영/관리자에게만 부여하세요.")

    def _chk_other_policy(self):
        """C-2.3 기타 서비스 정책 관리 — 수동 점검"""
        self.manual("C-2.3", "기타 서비스 정책 관리", Severity.HIGH,
                    "CloudTrail/CloudWatch/KMS/WAF 등 기타 서비스 IAM 권한을 수동으로 확인하세요.",
                    "보안 관련 서비스(GuardDuty, Security Hub, KMS 등)의 권한 부여 현황을 점검하세요.",
                    "기타 서비스 권한도 최소 권한 원칙에 따라 관리하세요.")

    # ══════════════════════════════════════════════════════════════════
    # 3. 가상 리소스 관리
    # ══════════════════════════════════════════════════════════════════

    def _chk_sg_any_port(self):
        """C-3.1 보안 그룹 인/아웃바운드 ANY 포트 설정 관리"""
        ec2 = self._client("ec2")
        sgs = ec2.describe_security_groups()["SecurityGroups"]
        vuln = []
        for sg in sgs:
            sgid = sg["GroupId"]
            sgname = sg.get("GroupName", "")
            for rule in sg.get("IpPermissions", []):
                if rule.get("IpProtocol") == "-1":
                    vuln.append(f"[인바운드 ALL] {sgid} ({sgname})")
            for rule in sg.get("IpPermissionsEgress", []):
                if rule.get("IpProtocol") == "-1":
                    for r in rule.get("IpRanges", []):
                        if r.get("CidrIp") == "0.0.0.0/0":
                            vuln.append(f"[아웃바운드 ALL→0.0.0.0/0] {sgid} ({sgname})")
        if vuln:
            self.vulnerable("C-3.1", "보안 그룹 인/아웃바운드 ANY 설정 관리", Severity.HIGH,
                            f"인/아웃바운드 ALL 허용 보안 그룹이 {len(vuln)}개 발견되었습니다.",
                            "\n".join(vuln[:30]),
                            "보안 그룹에서 불필요한 ALL(Any) 허용 규칙을 제거하고 필요한 포트만 개방하세요.")
        else:
            self.safe("C-3.1", "보안 그룹 인/아웃바운드 ANY 설정 관리", Severity.HIGH,
                      "ALL(Any) 포트 허용 보안 그룹이 없습니다.",
                      f"보안 그룹 {len(sgs)}개 확인 완료", "양호")

    def _chk_sg_any_source(self):
        """C-3.2 보안 그룹 인/아웃바운드 불필요 정책 관리 — 0.0.0.0/0 소스 확인"""
        ec2 = self._client("ec2")
        sgs = ec2.describe_security_groups()["SecurityGroups"]
        vuln = []
        SENSITIVE_PORTS = {22, 3389, 1521, 3306, 5432, 1433, 27017, 6379, 9200}
        for sg in sgs:
            sgid = sg["GroupId"]
            sgname = sg.get("GroupName", "")
            for rule in sg.get("IpPermissions", []):
                for r in rule.get("IpRanges", []):
                    if r.get("CidrIp") == "0.0.0.0/0":
                        from_p = rule.get("FromPort", 0)
                        to_p   = rule.get("ToPort", 0)
                        proto  = rule.get("IpProtocol", "")
                        ports_in_range = any(from_p <= p <= to_p for p in SENSITIVE_PORTS)
                        if ports_in_range or proto == "-1":
                            vuln.append(f"{sgid}({sgname}) 인바운드 {proto} {from_p}-{to_p} from 0.0.0.0/0")
        if vuln:
            self.vulnerable("C-3.2", "보안 그룹 인/아웃바운드 불필요 정책 관리", Severity.HIGH,
                            f"민감 포트를 0.0.0.0/0으로 허용하는 보안 그룹 규칙이 {len(vuln)}개 있습니다.",
                            "\n".join(vuln[:30]),
                            "SSH(22), RDP(3389), DB 포트 등은 특정 IP/대역으로만 허용하세요.")
        else:
            self.safe("C-3.2", "보안 그룹 인/아웃바운드 불필요 정책 관리", Severity.HIGH,
                      "민감 포트 전체 허용(0.0.0.0/0) 규칙이 없습니다.",
                      f"보안 그룹 {len(sgs)}개 확인 완료", "양호")

    def _chk_nacl(self):
        """C-3.3 네트워크 ACL 인/아웃바운드 트래픽 정책 관리"""
        ec2 = self._client("ec2")
        nacls = ec2.describe_network_acls()["NetworkAcls"]
        vuln = []
        for acl in nacls:
            acid = acl["NetworkAclId"]
            # 기본 ACL 0.0.0.0/0 ALLOW 규칙(rule# 100) 확인
            for entry in acl.get("Entries", []):
                if (entry.get("CidrBlock") == "0.0.0.0/0"
                        and entry.get("RuleAction") == "allow"
                        and entry.get("Protocol") == "-1"
                        and entry.get("RuleNumber", 9999) <= 100):
                    direction = "인바운드" if not entry.get("Egress") else "아웃바운드"
                    vuln.append(f"{acid} {direction} ALL 허용 (rule #{entry['RuleNumber']})")
        if vuln:
            self.vulnerable("C-3.3", "네트워크 ACL 인/아웃바운드 트래픽 정책 관리", Severity.MEDIUM,
                            f"ALL 트래픽을 허용하는 네트워크 ACL이 {len(vuln)}개 있습니다.",
                            "\n".join(vuln),
                            "네트워크 ACL에서 모든 트래픽 허용 규칙을 제거하고 필요한 포트/IP만 허용하세요.")
        else:
            self.safe("C-3.3", "네트워크 ACL 인/아웃바운드 트래픽 정책 관리", Severity.MEDIUM,
                      "ALL 허용 네트워크 ACL이 없습니다.",
                      f"네트워크 ACL {len(nacls)}개 확인 완료", "양호")

    def _chk_route_table(self):
        """C-3.4 라우팅 테이블 정책 관리 — 0.0.0.0/0 경로 확인"""
        ec2 = self._client("ec2")
        rts = ec2.describe_route_tables()["RouteTables"]
        igw_routes = []
        for rt in rts:
            rtid = rt["RouteTableId"]
            for route in rt.get("Routes", []):
                if (route.get("DestinationCidrBlock") == "0.0.0.0/0"
                        and route.get("GatewayId", "").startswith("igw-")):
                    igw_routes.append(f"{rtid} → {route['GatewayId']} (0.0.0.0/0)")
        if igw_routes:
            self.manual("C-3.4", "라우팅 테이블 정책 관리", Severity.MEDIUM,
                        "인터넷 게이트웨이로의 기본 경로(0.0.0.0/0)가 존재합니다. 서비스 목적에 맞는지 확인하세요.",
                        "\n".join(igw_routes),
                        "퍼블릭 서브넷 이외의 라우팅 테이블에 0.0.0.0/0 → IGW 경로가 있는지 확인하세요.")
        else:
            self.safe("C-3.4", "라우팅 테이블 정책 관리", Severity.MEDIUM,
                      "인터넷 게이트웨이로의 기본 경로가 없습니다.",
                      f"라우팅 테이블 {len(rts)}개 확인 완료", "양호")

    def _chk_igw(self):
        """C-3.5 인터넷 게이트웨이 연결 관리"""
        ec2 = self._client("ec2")
        igws = ec2.describe_internet_gateways()["InternetGateways"]
        attached = [igw for igw in igws if igw.get("Attachments")]
        self.manual("C-3.5", "인터넷 게이트웨이 연결 관리", Severity.LOW,
                    f"연결된 인터넷 게이트웨이 {len(attached)}개를 확인하세요.",
                    "\n".join(
                        f"{igw['InternetGatewayId']} → VPC: {igw['Attachments'][0].get('VpcId','?')}"
                        for igw in attached
                    ) or "연결된 IGW 없음",
                    "불필요하게 연결된 인터넷 게이트웨이가 없는지 확인하세요.")

    def _chk_nat_gw(self):
        """C-3.6 NAT 게이트웨이 연결 관리"""
        ec2 = self._client("ec2")
        nats = ec2.describe_nat_gateways()["NatGateways"]
        active = [n for n in nats if n["State"] == "available"]
        self.manual("C-3.6", "NAT 게이트웨이 연결 관리", Severity.MEDIUM,
                    f"활성 NAT 게이트웨이 {len(active)}개를 확인하세요.",
                    "\n".join(
                        f"{n['NatGatewayId']} (서브넷: {n.get('SubnetId','?')})"
                        for n in active
                    ) or "활성 NAT GW 없음",
                    "DBMS, 개인정보 보관 서비스 등 외부 오픈이 금지된 서비스가 NAT를 통해 외부와 통신하지 않는지 확인하세요.")

    def _chk_s3_access(self):
        """C-3.7 S3 버킷/객체 접근 관리 — 퍼블릭 액세스 차단 확인"""
        s3 = self._client("s3")
        buckets = s3.list_buckets().get("Buckets", [])
        vuln = []
        for b in buckets:
            name = b["Name"]
            try:
                cfg = s3.get_public_access_block(Bucket=name)["PublicAccessBlockConfiguration"]
                if not all([
                    cfg.get("BlockPublicAcls"),
                    cfg.get("IgnorePublicAcls"),
                    cfg.get("BlockPublicPolicy"),
                    cfg.get("RestrictPublicBuckets"),
                ]):
                    vuln.append(f"{name} — 퍼블릭 액세스 차단 미완료")
            except Exception:
                vuln.append(f"{name} — 퍼블릭 액세스 차단 설정 없음")
        if vuln:
            self.vulnerable("C-3.7", "S3 버킷/객체 접근 관리", Severity.MEDIUM,
                            f"퍼블릭 액세스 차단이 미완료된 S3 버킷이 {len(vuln)}개 있습니다.",
                            "\n".join(vuln[:20]),
                            "S3 버킷의 모든 퍼블릭 액세스 차단 옵션 4개를 활성화하세요.")
        else:
            self.safe("C-3.7", "S3 버킷/객체 접근 관리", Severity.MEDIUM,
                      "모든 S3 버킷의 퍼블릭 액세스 차단이 설정되어 있습니다.",
                      f"S3 버킷 {len(buckets)}개 확인 완료", "양호")

    def _chk_rds_subnet(self):
        """C-3.8 RDS 서브넷 가용 영역 관리 — 수동 점검"""
        rds = self._client("rds")
        sg = rds.describe_db_subnet_groups()["DBSubnetGroups"]
        details = []
        for g in sg:
            azs = list({s["SubnetAvailabilityZone"]["Name"] for s in g.get("Subnets", [])})
            details.append(f"{g['DBSubnetGroupName']}: AZ {azs}")
        self.manual("C-3.8", "RDS 서브넷 가용 영역 관리", Severity.MEDIUM,
                    "RDS 서브넷 그룹에 불필요한 가용 영역이 포함되어 있는지 수동 확인이 필요합니다.",
                    "\n".join(details) or "RDS 서브넷 그룹 없음",
                    "RDS 서브넷 그룹에서 서비스에 필요하지 않은 가용 영역의 서브넷을 제거하세요.")

    # ══════════════════════════════════════════════════════════════════
    # 4. 운영 관리
    # ══════════════════════════════════════════════════════════════════

    def _chk_ebs_encryption(self):
        """C-4.1 EBS 및 볼륨 암호화 설정"""
        ec2 = self._client("ec2")
        volumes = ec2.describe_volumes()["Volumes"]
        unencrypted = [v["VolumeId"] for v in volumes if not v.get("Encrypted")]
        if unencrypted:
            self.vulnerable("C-4.1", "EBS 및 볼륨 암호화 설정", Severity.MEDIUM,
                            f"암호화되지 않은 EBS 볼륨이 {len(unencrypted)}개 있습니다.",
                            "\n".join(unencrypted[:20]),
                            "EBS 볼륨을 생성할 때 암호화를 활성화하거나 기존 볼륨을 암호화된 스냅샷으로 교체하세요.")
        else:
            self.safe("C-4.1", "EBS 및 볼륨 암호화 설정", Severity.MEDIUM,
                      "모든 EBS 볼륨이 암호화되어 있습니다.",
                      f"EBS 볼륨 {len(volumes)}개 확인 완료", "양호")

    def _chk_rds_encryption(self):
        """C-4.2 RDS 암호화 설정"""
        rds = self._client("rds")
        dbs = rds.describe_db_instances()["DBInstances"]
        unenc = [d["DBInstanceIdentifier"] for d in dbs if not d.get("StorageEncrypted")]
        if unenc:
            self.vulnerable("C-4.2", "RDS 암호화 설정", Severity.MEDIUM,
                            f"암호화되지 않은 RDS 인스턴스가 {len(unenc)}개 있습니다.",
                            "\n".join(unenc),
                            "RDS 인스턴스 생성 시 저장 데이터 암호화를 활성화하세요.")
        else:
            self.safe("C-4.2", "RDS 암호화 설정", Severity.MEDIUM,
                      "모든 RDS 인스턴스가 암호화되어 있습니다.",
                      f"RDS 인스턴스 {len(dbs)}개 확인 완료", "양호")

    def _chk_s3_encryption(self):
        """C-4.3 S3 암호화 설정 — SSE-S3 또는 SSE-KMS 확인"""
        s3 = self._client("s3")
        buckets = s3.list_buckets().get("Buckets", [])
        unenc = []
        for b in buckets:
            name = b["Name"]
            try:
                enc = s3.get_bucket_encryption(Bucket=name)
                rules = enc["ServerSideEncryptionConfiguration"]["Rules"]
                if not any(r.get("ApplyServerSideEncryptionByDefault") for r in rules):
                    unenc.append(f"{name} — 암호화 규칙 없음")
            except Exception:
                unenc.append(f"{name} — 암호화 미설정")
        if unenc:
            self.vulnerable("C-4.3", "S3 암호화 설정", Severity.MEDIUM,
                            f"기본 암호화가 설정되지 않은 S3 버킷이 {len(unenc)}개 있습니다.",
                            "\n".join(unenc[:20]),
                            "S3 버킷 속성에서 SSE-S3 또는 SSE-KMS 기본 암호화를 활성화하세요.")
        else:
            self.safe("C-4.3", "S3 암호화 설정", Severity.MEDIUM,
                      "모든 S3 버킷에 기본 암호화가 설정되어 있습니다.",
                      f"S3 버킷 {len(buckets)}개 확인 완료", "양호")

    def _chk_tls_encryption(self):
        """C-4.4 통신구간 암호화 설정 — 수동 점검"""
        self.manual("C-4.4", "통신구간 암호화 설정", Severity.MEDIUM,
                    "통신구간 암호화(TLS/SSL, VPN, SSH) 적용 여부는 수동 확인이 필요합니다.",
                    "서비스간 통신에 암호화된 채널(TLS 1.2 이상, OpenSSH, VPN)이 사용되는지 점검하세요.",
                    "내/외부 통신 구간에 TLS 1.2 이상을 적용하고 평문 통신을 금지하세요.")

    def _chk_cloudtrail_encryption(self):
        """C-4.5 CloudTrail 암호화 설정 — SSE-KMS 확인"""
        ct = self._client("cloudtrail")
        trails = ct.describe_trails()["trailList"]
        unenc = [t["Name"] for t in trails if not t.get("KMSKeyId")]
        if unenc:
            self.vulnerable("C-4.5", "CloudTrail 암호화 설정", Severity.MEDIUM,
                            f"KMS 암호화가 설정되지 않은 CloudTrail이 {len(unenc)}개 있습니다.",
                            "\n".join(unenc),
                            "CloudTrail 로그 파일에 SSE-KMS 암호화를 설정하세요.")
        else:
            self.safe("C-4.5", "CloudTrail 암호화 설정", Severity.MEDIUM,
                      "모든 CloudTrail에 KMS 암호화가 설정되어 있습니다.",
                      f"CloudTrail {len(trails)}개 확인 완료", "양호")

    def _chk_cloudwatch_encryption(self):
        """C-4.6 CloudWatch 암호화 설정 — 로그 그룹 KMS 확인"""
        logs = self._client("logs")
        groups = self._paginate("logs", "describe_log_groups", "logGroups")
        unenc = [g["logGroupName"] for g in groups if not g.get("kmsKeyId")]
        if unenc:
            self.vulnerable("C-4.6", "CloudWatch 암호화 설정", Severity.MEDIUM,
                            f"KMS 암호화가 설정되지 않은 CloudWatch 로그 그룹이 {len(unenc)}개 있습니다.",
                            "\n".join(unenc[:20]),
                            "CloudWatch 로그 그룹 생성 시 KMS 키 ARN을 설정하세요.")
        else:
            self.safe("C-4.6", "CloudWatch 암호화 설정", Severity.MEDIUM,
                      "모든 CloudWatch 로그 그룹에 KMS 암호화가 설정되어 있습니다.",
                      f"로그 그룹 {len(groups)}개 확인 완료", "양호")

    def _chk_cloudtrail_logging(self):
        """C-4.7 AWS 사용자 계정 로깅 설정 — CloudTrail 활성화 확인"""
        ct = self._client("cloudtrail")
        trails = ct.describe_trails()["trailList"]
        if not trails:
            self.vulnerable("C-4.7", "AWS 사용자 계정 로깅 설정", Severity.HIGH,
                            "CloudTrail이 설정되어 있지 않습니다.",
                            "CloudTrail 추적 없음",
                            "CloudTrail을 활성화하여 모든 AWS 계정 활동을 로깅하세요.")
            return
        inactive = []
        for t in trails:
            status = ct.get_trail_status(Name=t["TrailARN"])
            if not status.get("IsLogging"):
                inactive.append(t["Name"])
        if inactive:
            self.vulnerable("C-4.7", "AWS 사용자 계정 로깅 설정", Severity.HIGH,
                            f"로깅이 비활성화된 CloudTrail이 {len(inactive)}개 있습니다.",
                            "\n".join(inactive),
                            "CloudTrail 로깅을 활성화하세요.")
        else:
            self.safe("C-4.7", "AWS 사용자 계정 로깅 설정", Severity.HIGH,
                      "모든 CloudTrail이 활성화되어 있습니다.",
                      f"CloudTrail {len(trails)}개 로깅 활성화 확인", "양호")

    def _chk_instance_logging(self):
        """C-4.8 인스턴스 로깅 설정 — CloudWatch 에이전트 수동 점검"""
        ec2 = self._client("ec2")
        instances = []
        for r in ec2.describe_instances()["Reservations"]:
            for i in r["Instances"]:
                if i["State"]["Name"] == "running":
                    instances.append(i.get("InstanceId", "?"))
        self.manual("C-4.8", "인스턴스 로깅 설정", Severity.MEDIUM,
                    f"실행 중인 EC2 인스턴스 {len(instances)}개의 CloudWatch 에이전트 설치 여부를 수동 확인하세요.",
                    "인스턴스 ID:\n" + "\n".join(instances[:20]),
                    "각 EC2 인스턴스에 CloudWatch 에이전트를 설치하고 로그 스트림을 설정하세요.")

    def _chk_rds_logging(self):
        """C-4.9 RDS 로깅 설정 — CloudWatch 로그 내보내기 확인"""
        rds = self._client("rds")
        dbs = rds.describe_db_instances()["DBInstances"]
        no_log = []
        for d in dbs:
            exports = d.get("EnabledCloudwatchLogsExports", [])
            if not exports:
                no_log.append(f"{d['DBInstanceIdentifier']} ({d['Engine']})")
        if no_log:
            self.vulnerable("C-4.9", "RDS 로깅 설정", Severity.MEDIUM,
                            f"CloudWatch 로그 내보내기가 설정되지 않은 RDS 인스턴스가 {len(no_log)}개 있습니다.",
                            "\n".join(no_log),
                            "RDS 인스턴스 수정 → 로그 내보내기 옵션을 활성화하세요.")
        else:
            self.safe("C-4.9", "RDS 로깅 설정", Severity.MEDIUM,
                      "모든 RDS 인스턴스에 CloudWatch 로그 내보내기가 설정되어 있습니다.",
                      f"RDS 인스턴스 {len(dbs)}개 확인 완료", "양호")

    def _chk_s3_logging(self):
        """C-4.10 S3 버킷 로깅 설정 — 서버 액세스 로깅 확인"""
        s3 = self._client("s3")
        buckets = s3.list_buckets().get("Buckets", [])
        no_log = []
        for b in buckets:
            name = b["Name"]
            try:
                log = s3.get_bucket_logging(Bucket=name)
                if not log.get("LoggingEnabled"):
                    no_log.append(name)
            except Exception:
                no_log.append(f"{name} (오류)")
        if no_log:
            self.vulnerable("C-4.10", "S3 버킷 로깅 설정", Severity.MEDIUM,
                            f"서버 액세스 로깅이 비활성화된 S3 버킷이 {len(no_log)}개 있습니다.",
                            "\n".join(no_log[:20]),
                            "S3 버킷 속성에서 서버 액세스 로깅을 활성화하세요.")
        else:
            self.safe("C-4.10", "S3 버킷 로깅 설정", Severity.MEDIUM,
                      "모든 S3 버킷에 서버 액세스 로깅이 설정되어 있습니다.",
                      f"S3 버킷 {len(buckets)}개 확인 완료", "양호")

    def _chk_vpc_flow_log(self):
        """C-4.11 VPC 플로우 로깅 설정"""
        ec2 = self._client("ec2")
        vpcs = ec2.describe_vpcs()["Vpcs"]
        flow_logs = ec2.describe_flow_logs()["FlowLogs"]
        vpc_with_logs = {fl["ResourceId"] for fl in flow_logs if fl.get("FlowLogStatus") == "ACTIVE"}
        no_log = [v["VpcId"] for v in vpcs if v["VpcId"] not in vpc_with_logs]
        if no_log:
            self.vulnerable("C-4.11", "VPC 플로우 로깅 설정", Severity.MEDIUM,
                            f"플로우 로그가 설정되지 않은 VPC가 {len(no_log)}개 있습니다.",
                            "\n".join(no_log),
                            "VPC 플로우 로그를 활성화하여 네트워크 트래픽을 모니터링하세요.")
        else:
            self.safe("C-4.11", "VPC 플로우 로깅 설정", Severity.MEDIUM,
                      "모든 VPC에 플로우 로그가 설정되어 있습니다.",
                      f"VPC {len(vpcs)}개 확인 완료", "양호")

    def _chk_log_retention(self):
        """C-4.12 로그 보관 기간 설정 — CloudWatch 로그 그룹 보존 기간 확인"""
        groups = self._paginate("logs", "describe_log_groups", "logGroups")
        issues = []
        for g in groups:
            ret = g.get("retentionInDays")
            if ret is None:
                issues.append(f"{g['logGroupName']} — 무기한 (권고: 365일 이상)")
            elif ret < 365:
                issues.append(f"{g['logGroupName']} — {ret}일 (권고: 365일 이상)")
        if issues:
            self.vulnerable("C-4.12", "로그 보관 기간 설정", Severity.MEDIUM,
                            f"보관 기간이 1년 미만인 CloudWatch 로그 그룹이 {len(issues)}개 있습니다.",
                            "\n".join(issues[:20]),
                            "CloudWatch 로그 그룹의 보존 기간을 최소 365일(1년) 이상으로 설정하세요.")
        else:
            self.safe("C-4.12", "로그 보관 기간 설정", Severity.MEDIUM,
                      "모든 CloudWatch 로그 그룹의 보관 기간이 1년 이상입니다.",
                      f"로그 그룹 {len(groups)}개 확인 완료", "양호")

    def _chk_backup(self):
        """C-4.13 백업 사용 여부 — AWS Backup 플랜 확인"""
        backup = self._client("backup")
        plans = backup.list_backup_plans()["BackupPlansList"]
        if not plans:
            self.vulnerable("C-4.13", "백업 사용 여부", Severity.MEDIUM,
                            "AWS Backup 플랜이 설정되어 있지 않습니다.",
                            "AWS Backup 플랜 없음",
                            "AWS Backup을 사용하여 EC2, RDS, EBS, S3 등 주요 리소스의 백업 정책을 수립하세요.")
        else:
            self.safe("C-4.13", "백업 사용 여부", Severity.MEDIUM,
                      f"AWS Backup 플랜이 {len(plans)}개 설정되어 있습니다.",
                      "\n".join(p["BackupPlanName"] for p in plans),
                      "백업 플랜의 대상 리소스와 보존 기간이 정책에 맞는지 주기적으로 검토하세요.")

    def _chk_access_key_rotation(self):
        """C-1.11 IAM 액세스 키 교체 주기 점검 [★2026 신규]
        주통기 2026: 액세스 키 장기 미교체 시 유출·악용 위험.
        생성 후 90일 이상 경과한 활성 액세스 키 보유 계정을 탐지.
        """
        iam = self._client("iam")
        users = self._paginate("iam", "list_users", "Users")
        issues = []
        now = datetime.now(timezone.utc)

        for u in users:
            uname = u["UserName"]
            keys = iam.list_access_keys(UserName=uname)["AccessKeyMetadata"]
            for k in keys:
                if k["Status"] != "Active":
                    continue
                created = k["CreateDate"]
                age_days = (now - created).days
                if age_days > 90:
                    issues.append(f"{uname}: 액세스 키 {k['AccessKeyId'][:8]}... "
                                  f"{age_days}일 경과 (생성: {created.strftime('%Y-%m-%d')})")

        if issues:
            self.vulnerable("C-1.11", "IAM 액세스 키 교체 주기", Severity.HIGH,
                            f"90일 이상 미교체 활성 액세스 키 {len(issues)}개 발견:",
                            "\n".join(issues),
                            "액세스 키를 90일 이내에 교체하고 미사용 키는 즉시 비활성화·삭제하세요.\n"
                            "aws iam update-access-key --access-key-id <ID> --status Inactive")
        else:
            self.safe("C-1.11", "IAM 액세스 키 교체 주기", Severity.HIGH,
                      f"모든 활성 액세스 키가 90일 이내에 생성 또는 교체됨 ({len(users)}개 계정 확인)",
                      "양호",
                      "액세스 키 교체 주기(90일)를 유지하고 불필요한 키는 삭제하세요.")

    def _chk_aws_config(self):
        """C-4.14 AWS Config 서비스 활성화 점검 [★2026 신규]
        주통기 2026: AWS Config 비활성화 시 리소스 구성 변경 이력 추적 불가.
        현재 리전에서 Config recorder가 활성화·기록 중인지 점검.
        """
        config = self._client("config")
        recorders = config.describe_configuration_recorder_status().get(
            "ConfigurationRecordersStatus", []
        )

        if not recorders:
            self.vulnerable("C-4.14", "AWS Config 서비스 활성화", Severity.HIGH,
                            "AWS Config Configuration Recorder가 설정되어 있지 않습니다.",
                            "Config Recorder 없음",
                            "AWS Config를 활성화하여 모든 리소스 구성 변경을 기록하고 규정 준수 여부를 추적하세요.")
            return

        not_recording = [r["name"] for r in recorders if not r.get("recording", False)]

        if not_recording:
            self.vulnerable("C-4.14", "AWS Config 서비스 활성화", Severity.HIGH,
                            f"Config Recorder가 기록 중지 상태: {', '.join(not_recording)}",
                            "recording=False",
                            "AWS Config Recorder를 시작하세요: aws configservice start-configuration-recorder")
        else:
            self.safe("C-4.14", "AWS Config 서비스 활성화", Severity.HIGH,
                      f"AWS Config Recorder {len(recorders)}개 모두 활성화·기록 중",
                      "양호",
                      "Config 규칙을 추가하여 보안 정책 준수 여부를 자동으로 평가하세요.")

    def _chk_guardduty(self):
        """C-4.15 GuardDuty 활성화 점검 [★2026 신규]
        주통기 2026: GuardDuty 비활성화 시 비정상 API 호출, 악성 IP 접근,
        자격 증명 유출 등 위협을 자동 탐지할 수 없음.
        """
        gd = self._client("guardduty")
        detectors = gd.list_detectors().get("DetectorIds", [])

        if not detectors:
            self.vulnerable("C-4.15", "GuardDuty 활성화", Severity.HIGH,
                            "GuardDuty 탐지기가 설정되어 있지 않습니다.",
                            "GuardDuty Detector 없음",
                            "GuardDuty를 활성화하여 위협 탐지를 설정하세요:\n"
                            "aws guardduty create-detector --enable")
            return

        issues = []
        for det_id in detectors:
            det = gd.get_detector(DetectorId=det_id)
            status = det.get("Status", "")
            if status != "ENABLED":
                issues.append(f"Detector {det_id}: {status}")

        if issues:
            self.vulnerable("C-4.15", "GuardDuty 활성화", Severity.HIGH,
                            f"비활성화된 GuardDuty 탐지기 {len(issues)}개:",
                            "\n".join(issues),
                            "GuardDuty 탐지기를 활성화하세요:\n"
                            "aws guardduty update-detector --detector-id <ID> --enable")
        else:
            self.safe("C-4.15", "GuardDuty 활성화", Severity.HIGH,
                      f"GuardDuty 탐지기 {len(detectors)}개 모두 활성화됨",
                      "양호",
                      "GuardDuty 결과(Findings)를 정기적으로 검토하고 위협에 즉시 대응하세요.")
