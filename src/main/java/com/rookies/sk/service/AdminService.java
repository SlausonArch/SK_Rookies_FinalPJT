package com.rookies.sk.service;

import com.rookies.sk.entity.*;
import com.rookies.sk.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;
import java.util.stream.Collectors;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import java.time.LocalDate;
import java.time.LocalDateTime;

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

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getAllMembers() {
        return memberRepository.findAll().stream().map(m -> {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("memberId", m.getMemberId());
            map.put("email", m.getEmail());
            map.put("name", m.getName());
            map.put("phoneNumber", m.getPhoneNumber());
            map.put("role", m.getRole().name());
            map.put("status", m.getStatus().name());
            map.put("hasIdPhoto", m.getIdPhotoUrl() != null && !m.getIdPhotoUrl().isBlank());
            map.put("idPhotoUrl", m.getIdPhotoUrl() != null ? m.getIdPhotoUrl() : "");
            map.put("createdAt", m.getCreatedAt());
            return map;
        }).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public Map<String, Object> searchMembers(String q, String role, String status, int page, int size) {
        PageRequest pageable = PageRequest.of(
                Math.max(page, 0),
                Math.max(1, Math.min(size, 200)),
                Sort.by(Sort.Direction.DESC, "createdAt")
        );

        Member.Role roleEnum = isBlank(role) ? null : Member.Role.valueOf(role.toUpperCase());
        Member.Status statusEnum = isBlank(status) ? null : Member.Status.valueOf(status.toUpperCase());

        Page<Member> result = memberRepository.searchMembers(
                isBlank(q) ? null : q.trim(),
                roleEnum,
                statusEnum,
                pageable
        );

        List<Map<String, Object>> content = result.getContent().stream().map(m -> {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("memberId", m.getMemberId());
            map.put("email", m.getEmail());
            map.put("name", m.getName());
            map.put("phoneNumber", m.getPhoneNumber());
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
        map.put("email", member.getEmail());
        map.put("name", member.getName());
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
        map.put("memberId", member.getMemberId());
        map.put("memberEmail", member.getEmail());
        map.put("assetType", normalizedAssetType);
        map.put("reclaimedAmount", reclaimAmount);
        map.put("balance", asset.getBalance());
        map.put("lockedBalance", lockedBalance);
        map.put("availableBalance", nonNegative(asset.getBalance().subtract(lockedBalance)));
        map.put("reason", reason != null ? reason.trim() : "");
        map.put("message", "자산 회수가 완료되었습니다.");
        return map;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getAllOrders() {
        return orderRepository.findAll().stream().map(o -> {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("orderId", o.getOrderId());
            map.put("memberEmail", o.getMember().getEmail());
            map.put("memberName", o.getMember().getName());
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
        return assetRepository.findAll().stream().map(a -> {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("assetId", a.getAssetId());
            map.put("memberId", a.getMember().getMemberId());
            map.put("memberEmail", a.getMember().getEmail());
            map.put("memberName", a.getMember().getName());
            map.put("assetType", a.getAssetType());
            map.put("balance", a.getBalance());
            map.put("lockedBalance", a.getLockedBalance());
            return map;
        }).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getAllTransactions() {
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
                    map.put("memberEmail", tx.getMember().getEmail());
                    map.put("memberName", tx.getMember().getName());
                    map.put("txType", tx.getTxType());
                    map.put("assetType", tx.getAssetType());
                    map.put("amount", tx.getAmount());
                    map.put("price", tx.getPrice());
                    map.put("totalValue", tx.getTotalValue());
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

        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("totalMembers", totalMembers);
        stats.put("activeMembers", activeMembers);
        stats.put("totalOrders", totalOrders);
        stats.put("totalKrwBalance", totalAssetValue);
        stats.put("totalTransactions", totalTransactions);
        return stats;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getAllInquiries() {
        return inquiryRepository.findAll().stream()
                .sorted((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()))
                .map(inq -> {
                    Map<String, Object> map = new LinkedHashMap<>();
                    map.put("inquiryId", inq.getInquiryId());
                    map.put("memberEmail", inq.getMember().getEmail());
                    map.put("memberName", inq.getMember().getName());
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
            int size
    ) {

        LocalDateTime fromDt = parseFrom(from);
        LocalDateTime toDt = parseTo(to);

        PageRequest pageable = PageRequest.of(
                Math.max(page, 0),
                Math.max(1, Math.min(size, 200)),
                Sort.by(Sort.Direction.DESC, "txDate")
        );

        Page<Transaction> result = transactionRepository.searchAdminTransactions(
                isBlank(memberEmail) ? null : memberEmail.trim(),
                isBlank(assetType) ? null : assetType.toUpperCase(),
                isBlank(txType) ? null : txType.toUpperCase(),
                fromDt,
                toDt,
                pageable
        );

        List<Map<String, Object>> content = result.getContent().stream()
                .map(tx -> {
                    Map<String, Object> map = new LinkedHashMap<>();
                    map.put("txId", tx.getTxId());
                    map.put("memberEmail", tx.getMember().getEmail());
                    map.put("memberName", tx.getMember().getName());
                    map.put("txType", tx.getTxType());
                    map.put("assetType", tx.getAssetType());
                    map.put("amount", tx.getAmount());
                    map.put("price", tx.getPrice());
                    map.put("totalValue", tx.getTotalValue());
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

    private LocalDateTime parseFrom(String from) {
        if (isBlank(from)) return null;
        return LocalDate.parse(from).atStartOfDay();
    }

    private LocalDateTime parseTo(String to) {
        if (isBlank(to)) return null;
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
}
