package com.rookies.sk.service;

import com.rookies.sk.entity.*;
import com.rookies.sk.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AdminService {

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
}
