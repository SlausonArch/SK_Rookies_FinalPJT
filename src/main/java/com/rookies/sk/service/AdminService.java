package com.rookies.sk.service;

import com.rookies.sk.entity.*;
import com.rookies.sk.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import jakarta.servlet.http.HttpServletRequest;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;
import java.util.stream.Collectors;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import java.time.LocalDate;
import java.time.LocalDateTime;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.GrantedAuthority;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

@Service
@RequiredArgsConstructor
public class AdminService {

    private static final int ASSET_SCALE = 8;
    private static final BigDecimal EPSILON = new BigDecimal("0.00000001");

    private final MemberRepository memberRepository;
    private final OrderRepository orderRepository;
    private final AssetRepository assetRepository;
    private final TransactionRepository transactionRepository;
    private final InquiryRepository inquiryRepository;
    private final AuditLogRepository auditLogRepository;
    private final PasswordEncoder passwordEncoder;

    private boolean isManager() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null)
            return false;
        return authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch(role -> role.equals("ROLE_MANAGER"));
    }

    private String maskEmail(String email) {
        if (email == null || email.isBlank())
            return "";
        int atIndex = email.indexOf("@");
        if (atIndex <= 1)
            return email; // e.g. a@b.com => a@b.com
        String prefix = email.substring(0, 1) + "***" + email.substring(atIndex - 1, atIndex);
        return prefix + email.substring(atIndex);
    }

    private String maskName(String name) {
        if (name == null || name.isBlank())
            return "";
        if (name.length() <= 1)
            return name;
        if (name.length() == 2)
            return name.substring(0, 1) + "*";
        return name.substring(0, 1) + "*".repeat(name.length() - 2) + name.substring(name.length() - 1);
    }

    private String maskPhone(String phone) {
        if (phone == null || phone.isBlank())
            return "";
        String cleanPhone = phone.replaceAll("[^0-9]", "");
        if (cleanPhone.length() < 10)
            return phone;
        String prefix = cleanPhone.substring(0, 3);
        String suffix = cleanPhone.substring(cleanPhone.length() - 4);
        return prefix + "****" + suffix;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getAllMembers() {
        return memberRepository.findAll().stream().map(m -> {
            Map<String, Object> map = new LinkedHashMap<>();
            boolean manager = isManager();
            map.put("memberId", m.getMemberId());
            map.put("email", maskEmail(m.getEmail()));
            map.put("name", maskName(m.getName()));
            map.put("phoneNumber", maskPhone(m.getPhoneNumber()));
            map.put("role", m.getRole().name());
            map.put("status", m.getStatus().name());
            map.put("hasIdPhoto", m.getIdPhotoUrl() != null && !m.getIdPhotoUrl().isBlank());
            map.put("idPhotoUrl", (manager || m.getIdPhotoUrl() == null) ? "" : m.getIdPhotoUrl());
            map.put("createdAt", m.getCreatedAt());
            return map;
        }).collect(Collectors.toList());
    }

    @Transactional
    public Map<String, Object> getUnmaskedMemberInfo(Long targetMemberId, HttpServletRequest request) {
        Member targetMember = memberRepository.findById(targetMemberId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "회원을 찾을 수 없습니다."));

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String operatorEmail = auth != null ? auth.getName() : "UNKNOWN";
        Member operator = memberRepository.findByEmail(operatorEmail).orElse(null);
        Long operatorId = operator != null ? operator.getMemberId() : null;

        String ipAddress = request.getHeader("X-Forwarded-For");
        if (isBlank(ipAddress)) {
            ipAddress = request.getRemoteAddr();
        }
        String userAgent = request.getHeader("User-Agent");

        AuditLog auditLog = AuditLog.builder()
                .memberId(operatorId)
                .action("VIEW_UNMASKED_PII")
                .ipAddress(ipAddress)
                .userAgent(userAgent)
                .targetTable("MEMBERS")
                .targetId(targetMemberId)
                .logDetail("Unmasked PII accessed for member email: " + targetMember.getEmail())
                .build();
        auditLogRepository.save(auditLog);

        Map<String, Object> map = new LinkedHashMap<>();
        map.put("memberId", targetMember.getMemberId());
        map.put("email", targetMember.getEmail());
        map.put("name", targetMember.getName());
        map.put("phoneNumber", targetMember.getPhoneNumber());
        return map;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getMemberDetails(Long memberId) {
        Member m = memberRepository.findById(memberId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "회원을 찾을 수 없습니다."));

        Map<String, Object> map = new LinkedHashMap<>();
        map.put("memberId", m.getMemberId());
        map.put("email", maskEmail(m.getEmail()));
        map.put("name", maskName(m.getName()));
        map.put("phoneNumber", maskPhone(m.getPhoneNumber()));
        map.put("role", m.getRole().name());
        map.put("status", m.getStatus().name());
        map.put("createdAt", m.getCreatedAt());
        map.put("updatedAt", m.getUpdatedAt());
        map.put("hasIdPhoto", m.getIdPhotoUrl() != null && !m.getIdPhotoUrl().isBlank());
        map.put("idPhotoUrl", isManager() ? "" : (m.getIdPhotoUrl() == null ? "" : m.getIdPhotoUrl()));

        List<Map<String, Object>> assets = assetRepository.findByMember_MemberId(memberId).stream().map(a -> {
            Map<String, Object> amap = new LinkedHashMap<>();
            amap.put("assetId", a.getAssetId());
            amap.put("assetType", a.getAssetType());
            amap.put("balance", a.getBalance());
            amap.put("lockedBalance", a.getLockedBalance());
            return amap;
        }).collect(Collectors.toList());
        map.put("assets", assets);

        return map;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> searchMembers(String q, String role, String status, int page, int size) {
        PageRequest pageable = PageRequest.of(
                Math.max(page, 0),
                Math.max(1, Math.min(size, 200)),
                Sort.by(Sort.Direction.DESC, "createdAt"));

        Member.Role roleEnum = isBlank(role) ? null : Member.Role.valueOf(role.toUpperCase());
        Member.Status statusEnum = isBlank(status) ? null : Member.Status.valueOf(status.toUpperCase());

        String sanitizedQ = isBlank(q) ? null : q.trim().replace("%", "").replace("_", "");
        Page<Member> result = memberRepository.searchMembers(
                sanitizedQ,
                roleEnum,
                statusEnum,
                pageable);

        List<Map<String, Object>> content = result.getContent().stream().map(m -> {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("memberId", m.getMemberId());
            map.put("email", maskEmail(m.getEmail()));
            map.put("name", maskName(m.getName()));
            map.put("phoneNumber", maskPhone(m.getPhoneNumber()));
            map.put("role", m.getRole().name());
            map.put("status", m.getStatus().name());
            map.put("createdAt", m.getCreatedAt());
            return map;
        }).collect(Collectors.toList());

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("content", content);
        response.put("totalElements", result.getTotalElements());
        response.put("totalPages", result.getTotalPages());
        response.put("page", result.getNumber());

        return response;
    }

    @Transactional
    public Map<String, Object> updateMemberStatus(Long memberId, String status) {
        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new RuntimeException("회원을 찾을 수 없습니다."));

        if ("ACTIVE".equalsIgnoreCase(status)
                && (member.getIdPhotoUrl() == null || member.getIdPhotoUrl().isBlank())) {
            throw new RuntimeException("신분증 제출 확인 후에만 ACTIVE 승인할 수 있습니다.");
        }

        member.setStatus(Member.Status.valueOf(status));
        memberRepository.save(member);

        Map<String, Object> map = new LinkedHashMap<>();
        map.put("memberId", member.getMemberId());
        map.put("email", maskEmail(member.getEmail()));
        map.put("name", maskName(member.getName()));
        map.put("status", member.getStatus().name());
        return map;
    }

    @Transactional
    public Map<String, Object> approveMemberIdentity(Long memberId) {
        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new RuntimeException("회원을 찾을 수 없습니다."));

        if (member.getStatus() == Member.Status.WITHDRAWN) {
            throw new RuntimeException("탈퇴 계정은 승인할 수 없습니다.");
        }
        if (member.getIdPhotoUrl() == null || member.getIdPhotoUrl().isBlank()) {
            throw new RuntimeException("신분증 제출본이 없어 승인할 수 없습니다.");
        }

        member.setStatus(Member.Status.ACTIVE);
        memberRepository.save(member);

        Map<String, Object> map = new LinkedHashMap<>();
        map.put("memberId", member.getMemberId());
        map.put("email", member.getEmail());
        map.put("name", member.getName());
        map.put("status", member.getStatus().name());
        return map;
    }

    @Transactional
    public Map<String, Object> reclaimMemberAsset(Long memberId, String assetType, BigDecimal amount, String reason) {
        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "회원을 찾을 수 없습니다."));

        String normalizedAssetType = normalizeAssetType(assetType);
        BigDecimal reclaimAmount = normalizeAmount(amount);
        if (isBlank(normalizedAssetType)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "자산 코드를 입력해 주세요.");
        }
        if (reclaimAmount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "회수 수량은 0보다 커야 합니다.");
        }
        if (isBlank(reason)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "회수 사유를 입력해 주세요.");
        }

        Asset asset = assetRepository.findWithLockByMember_MemberIdAndAssetType(memberId, normalizedAssetType)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "해당 회원의 자산을 찾을 수 없습니다."));

        BigDecimal balance = normalizeAmount(asset.getBalance());
        BigDecimal lockedBalance = normalizeAmount(asset.getLockedBalance());
        BigDecimal availableBalance = nonNegative(balance.subtract(lockedBalance));
        if (availableBalance.compareTo(reclaimAmount) < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "회수 가능한 잔고가 부족합니다.");
        }

        BigDecimal nextBalance = nonNegative(balance.subtract(reclaimAmount));
        if (nextBalance.abs().compareTo(EPSILON) <= 0) {
            nextBalance = BigDecimal.ZERO;
        }

        asset.setBalance(nextBalance);
        assetRepository.save(asset);

        Transaction tx = Transaction.builder()
                .member(member)
                .txType("ADMIN_RECLAIM")
                .assetType(normalizedAssetType)
                .amount(reclaimAmount)
                .totalValue(reclaimAmount)
                .fee(BigDecimal.ZERO)
                .build();
        transactionRepository.save(tx);

        Map<String, Object> map = new LinkedHashMap<>();
        boolean manager = isManager();
        map.put("memberId", member.getMemberId());
        map.put("memberEmail", maskEmail(member.getEmail()));
        map.put("assetType", normalizedAssetType);
        map.put("reclaimedAmount", reclaimAmount);
        map.put("balance", manager ? BigDecimal.ZERO : asset.getBalance());
        map.put("lockedBalance", manager ? BigDecimal.ZERO : lockedBalance);
        map.put("availableBalance", nonNegative(asset.getBalance().subtract(lockedBalance)));
        map.put("reason", reason != null ? reason.trim() : "");
        map.put("message", "자산 회수가 완료되었습니다.");
        return map;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getAllOrders() {
        boolean manager = isManager();
        return orderRepository.findAll().stream().map(o -> {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("orderId", o.getOrderId());
            map.put("memberId", o.getMember().getMemberId());
            map.put("memberEmail", maskEmail(o.getMember().getEmail()));
            map.put("memberName", maskName(o.getMember().getName()));
            map.put("orderType", o.getOrderType());
            map.put("priceType", o.getPriceType());
            map.put("assetType", o.getAssetType());
            map.put("price", o.getPrice());
            map.put("amount", o.getAmount());
            map.put("filledAmount", o.getFilledAmount());
            map.put("status", o.getStatus());
            map.put("createdAt", o.getCreatedAt());
            return map;
        }).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getAllAssets() {
        boolean manager = isManager();
        return assetRepository.findAll().stream().map(a -> {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("assetId", a.getAssetId());
            map.put("memberId", a.getMember().getMemberId());
            map.put("memberEmail", maskEmail(a.getMember().getEmail()));
            map.put("memberName", maskName(a.getMember().getName()));
            map.put("assetType", a.getAssetType());
            map.put("balance", manager ? BigDecimal.ZERO : a.getBalance());
            map.put("lockedBalance", manager ? BigDecimal.ZERO : a.getLockedBalance());
            return map;
        }).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getAllTransactions() {
        boolean manager = isManager();
        return transactionRepository.findAll().stream()
                .sorted((a, b) -> {
                    if (b.getTxDate() == null)
                        return -1;
                    if (a.getTxDate() == null)
                        return 1;
                    return b.getTxDate().compareTo(a.getTxDate());
                })
                .map(tx -> {
                    Map<String, Object> map = new LinkedHashMap<>();
                    map.put("txId", tx.getTxId());
                    map.put("memberId", tx.getMember().getMemberId());
                    map.put("memberEmail", maskEmail(tx.getMember().getEmail()));
                    map.put("memberName", maskName(tx.getMember().getName()));
                    map.put("txType", tx.getTxType());
                    map.put("assetType", tx.getAssetType());
                    map.put("amount", manager ? BigDecimal.ZERO : tx.getAmount());
                    map.put("price", manager ? BigDecimal.ZERO : tx.getPrice());
                    map.put("totalValue", manager ? BigDecimal.ZERO : tx.getTotalValue());
                    map.put("fee", tx.getFee());
                    map.put("txDate", tx.getTxDate());
                    return map;
                }).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getStats() {
        long totalMembers = memberRepository.count();
        long activeMembers = memberRepository.findAll().stream()
                .filter(m -> m.getStatus() == Member.Status.ACTIVE).count();
        long totalOrders = orderRepository.count();

        BigDecimal totalAssetValue = assetRepository.findAll().stream()
                .filter(a -> "KRW".equals(a.getAssetType()))
                .map(Asset::getBalance)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        long totalTransactions = transactionRepository.count();

        boolean manager = isManager();
        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("totalMembers", totalMembers);
        stats.put("activeMembers", activeMembers);
        stats.put("totalOrders", totalOrders);
        stats.put("totalKrwBalance", manager ? BigDecimal.ZERO : totalAssetValue);
        stats.put("totalTransactions", totalTransactions);
        return stats;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getAllInquiries() {
        boolean manager = isManager();
        return inquiryRepository.findAll().stream()
                .sorted((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()))
                .map(inq -> {
                    Map<String, Object> map = new LinkedHashMap<>();
                    map.put("inquiryId", inq.getInquiryId());
                    map.put("memberId", inq.getMember().getMemberId());
                    map.put("memberEmail", maskEmail(inq.getMember().getEmail()));
                    map.put("memberName", maskName(inq.getMember().getName()));
                    map.put("title", inq.getTitle());
                    map.put("content", inq.getContent());
                    map.put("status", inq.getStatus());
                    map.put("reply", inq.getReply());
                    map.put("attachmentUrl", inq.getAttachmentUrl());
                    map.put("createdAt", inq.getCreatedAt());
                    return map;
                }).collect(Collectors.toList());
    }

    @Transactional
    public Map<String, Object> replyToInquiry(Long inquiryId, String replyStatus, String replyContent) {
        Inquiry inquiry = inquiryRepository.findById(inquiryId)
                .orElseThrow(() -> new RuntimeException("문의를 찾을 수 없습니다."));

        inquiry.setStatus(replyStatus);
        inquiry.setReply(replyContent);
        inquiryRepository.save(inquiry);

        Map<String, Object> map = new LinkedHashMap<>();
        map.put("inquiryId", inquiry.getInquiryId());
        map.put("status", inquiry.getStatus());
        map.put("reply", inquiry.getReply());
        return map;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> searchTransactions(
            String memberEmail,
            String assetType,
            String txType,
            String from,
            String to,
            int page,
            int size) {

        LocalDateTime fromDt = parseFrom(from);
        LocalDateTime toDt = parseTo(to);

        PageRequest pageable = PageRequest.of(
                Math.max(page, 0),
                Math.max(1, Math.min(size, 200)),
                Sort.by(Sort.Direction.DESC, "txDate"));

        Page<Transaction> result = transactionRepository.searchAdminTransactions(
                isBlank(memberEmail) ? null : memberEmail.trim(),
                isBlank(assetType) ? null : assetType.toUpperCase(),
                isBlank(txType) ? null : txType.toUpperCase(),
                fromDt,
                toDt,
                pageable);

        boolean manager = isManager();
        List<Map<String, Object>> content = result.getContent().stream()
                .map(tx -> {
                    Map<String, Object> map = new LinkedHashMap<>();
                    map.put("txId", tx.getTxId());
                    map.put("memberId", tx.getMember().getMemberId());
                    map.put("memberEmail", maskEmail(tx.getMember().getEmail()));
                    map.put("memberName", maskName(tx.getMember().getName()));
                    map.put("txType", tx.getTxType());
                    map.put("assetType", tx.getAssetType());
                    map.put("amount", manager ? BigDecimal.ZERO : tx.getAmount());
                    map.put("price", manager ? BigDecimal.ZERO : tx.getPrice());
                    map.put("totalValue", manager ? BigDecimal.ZERO : tx.getTotalValue());
                    map.put("fee", tx.getFee());
                    map.put("txDate", tx.getTxDate());
                    return map;
                })
                .toList();

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("content", content);
        response.put("totalElements", result.getTotalElements());
        response.put("totalPages", result.getTotalPages());
        response.put("page", result.getNumber());

        return response;
    }

    // ── 직원(Staff) 관리 ─────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getStaffMembers() {
        List<Member.Role> staffRoles = List.of(
                Member.Role.VCESYS_CORE, Member.Role.VCESYS_MGMT, Member.Role.VCESYS_EMP);
        return memberRepository.findAll().stream()
                .filter(m -> staffRoles.contains(m.getRole()))
                .sorted(Comparator.comparing(
                        m -> m.getCreatedAt() != null ? m.getCreatedAt() : LocalDateTime.MIN))
                .map(m -> {
                    Map<String, Object> map = new LinkedHashMap<>();
                    map.put("memberId", m.getMemberId());
                    map.put("email", m.getEmail());
                    map.put("name", m.getName());
                    map.put("role", m.getRole().name());
                    map.put("status", m.getStatus().name());
                    map.put("createdAt", m.getCreatedAt());
                    return map;
                }).collect(Collectors.toList());
    }

    @Transactional
    public Map<String, Object> createStaffMember(
            String email, String password, String name, String role) {

        if (isBlank(email) || isBlank(password) || isBlank(name) || isBlank(role)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "email, password, name, role은 필수 항목입니다.");
        }

        Set<String> allowedRoles = Set.of("VCESYS_CORE", "VCESYS_MGMT", "VCESYS_EMP");
        String upperRole = role.trim().toUpperCase();
        if (!allowedRoles.contains(upperRole)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "role은 VCESYS_CORE / VCESYS_MGMT / VCESYS_EMP 중 하나여야 합니다.");
        }

        validateAdminPassword(password);

        if (memberRepository.existsByEmail(email.trim())) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "이미 사용 중인 이메일입니다.");
        }

        Member member = Member.builder()
                .email(email.trim())
                .password(sha256Hex(password))
                .name(name.trim())
                .role(Member.Role.valueOf(upperRole))
                .status(Member.Status.ACTIVE)
                .build();
        memberRepository.save(member);

        Map<String, Object> map = new LinkedHashMap<>();
        map.put("memberId", member.getMemberId());
        map.put("email", member.getEmail());
        map.put("name", member.getName());
        map.put("role", member.getRole().name());
        map.put("status", member.getStatus().name());
        map.put("message", "직원 계정이 생성되었습니다.");
        return map;
    }

    @Transactional
    public Map<String, Object> deleteStaffMember(Long memberId) {
        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "직원 계정을 찾을 수 없습니다."));

        List<Member.Role> staffRoles = List.of(
                Member.Role.VCESYS_CORE, Member.Role.VCESYS_MGMT, Member.Role.VCESYS_EMP);
        if (!staffRoles.contains(member.getRole())) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "직원 계정이 아닙니다.");
        }

        // 현재 로그인된 관리자가 자기 자신을 삭제하는 것을 방지
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String currentEmail = auth != null ? auth.getName() : null;
        if (currentEmail != null && currentEmail.equals(member.getEmail())) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "자신의 계정은 삭제할 수 없습니다.");
        }

        memberRepository.delete(member);

        Map<String, Object> map = new LinkedHashMap<>();
        map.put("memberId", memberId);
        map.put("message", "직원 계정이 삭제되었습니다.");
        return map;
    }

    // ── 내부 유틸리티 ────────────────────────────────────────────────

    private LocalDateTime parseFrom(String from) {
        if (isBlank(from))
            return null;
        return LocalDate.parse(from).atStartOfDay();
    }

    private LocalDateTime parseTo(String to) {
        if (isBlank(to))
            return null;
        return LocalDate.parse(to).plusDays(1).atStartOfDay().minusNanos(1);
    }

    private boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    private String normalizeAssetType(String assetType) {
        return assetType == null ? "" : assetType.trim().toUpperCase();
    }

    private BigDecimal normalizeAmount(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value.setScale(ASSET_SCALE, RoundingMode.DOWN);
    }

    private BigDecimal nonNegative(BigDecimal value) {
        if (value.compareTo(BigDecimal.ZERO) < 0 && value.abs().compareTo(EPSILON) <= 0) {
            return BigDecimal.ZERO;
        }
        return value.max(BigDecimal.ZERO);
    }

    /**
     * 관리자 계정 비밀번호 정책 검증
     * - 최소 8자 이상
     * - 영문 대소문자, 숫자, 특수문자 각 1개 이상 포함
     */
    private void validateAdminPassword(String password) {
        if (isBlank(password) || password.length() < 8) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "비밀번호는 8자 이상이어야 합니다.");
        }
        if (!password.matches(".*[A-Z].*")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "비밀번호에 영문 대문자를 1자 이상 포함해야 합니다.");
        }
        if (!password.matches(".*[a-z].*")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "비밀번호에 영문 소문자를 1자 이상 포함해야 합니다.");
        }
        if (!password.matches(".*[0-9].*")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "비밀번호에 숫자를 1자 이상 포함해야 합니다.");
        }
        if (!password.matches(".*[!@#$%^&*()_+\\-=\\[\\]{};':\"\\\\|,.<>/?].*")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "비밀번호에 특수문자를 1자 이상 포함해야 합니다.");
        }
    }

    private String sha256Hex(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : hash) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 not available", e);
        }
    }
}
