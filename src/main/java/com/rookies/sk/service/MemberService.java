package com.rookies.sk.service;

import com.rookies.sk.dto.SignupRequestDto;
import com.rookies.sk.entity.Member;
import com.rookies.sk.entity.Asset;
import com.rookies.sk.entity.Transaction;
import com.rookies.sk.repository.MemberRepository;
import com.rookies.sk.repository.AssetRepository;
import com.rookies.sk.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;

@Service
@RequiredArgsConstructor
public class MemberService {

    private final MemberRepository memberRepository;
    private final AssetRepository assetRepository;
    private final TransactionRepository transactionRepository;

    @Transactional
    public Member completeSignupByEmail(String email, SignupRequestDto dto, String itemsUrl) {
        Member member = memberRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("Member not found"));

        if (member.getRole() != Member.Role.GUEST) {
            throw new RuntimeException("Already a registered user");
        }

        member.setName(dto.getName());
        member.setRrnPrefix(dto.getRrnPrefix());
        member.setPhoneNumber(dto.getPhoneNumber());
        member.setAddress(dto.getAddress());
        member.setBankName(dto.getBankName());
        member.setAccountNumber(dto.getAccountNumber());
        member.setAccountHolder(dto.getName());
        member.setIdPhotoUrl(itemsUrl);

        // 추천인 코드 생성 로직 (영문 대문자 + 숫자 8자리)
        member.setReferralCode(generateReferralCode());

        String referredByCode = dto.getReferredByCode();
        if (referredByCode != null && !referredByCode.trim().isEmpty()) {
            member.setReferredByCode(referredByCode);
            // 추천인 찾기 및 리워드 지급 (70,000 KRW)
            memberRepository.findByReferralCode(referredByCode).ifPresent(referrer -> {
                Asset referrerKrw = assetRepository.findByMember_MemberIdAndAssetType(referrer.getMemberId(), "KRW")
                        .orElseGet(() -> {
                            Asset newAsset = Asset.builder()
                                    .member(referrer)
                                    .assetType("KRW")
                                    .balance(java.math.BigDecimal.ZERO)
                                    .lockedBalance(java.math.BigDecimal.ZERO)
                                    .build();
                            return assetRepository.save(newAsset);
                        });

                java.math.BigDecimal rewardAmount = new java.math.BigDecimal("70000");
                referrerKrw.setBalance(referrerKrw.getBalance().add(rewardAmount));
                assetRepository.save(referrerKrw);

                Transaction tx = Transaction.builder()
                        .member(referrer)
                        .txType("DEPOSIT")
                        .assetType("KRW")
                        .amount(rewardAmount)
                        .totalValue(rewardAmount)
                        .fee(java.math.BigDecimal.ZERO)
                        .build();
                transactionRepository.save(tx);
            });
        }

        member.setRole(Member.Role.USER);
        member.setStatus(Member.Status.LOCKED);

        return memberRepository.save(member);
    }

    @Transactional
    public Member submitIdPhotoByEmail(String email, String idPhotoUrl) {
        Member member = memberRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("Member not found"));

        if (member.getStatus() == Member.Status.WITHDRAWN) {
            throw new RuntimeException("탈퇴 계정은 신분증을 제출할 수 없습니다.");
        }

        if (member.getIdPhotoUrl() != null && !member.getIdPhotoUrl().isBlank()) {
            throw new RuntimeException("이미 신분증이 제출된 계정입니다.");
        }

        member.setIdPhotoUrl(idPhotoUrl);
        if (member.getRole() == Member.Role.USER) {
            member.setStatus(Member.Status.LOCKED);
        }

        return memberRepository.save(member);
    }

    private String generateReferralCode() {
        String chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        SecureRandom random = new SecureRandom();
        StringBuilder sb = new StringBuilder(8);
        for (int i = 0; i < 8; i++) {
            sb.append(chars.charAt(random.nextInt(chars.length())));
        }
        return sb.toString();
    }

    @Transactional
    public void assignReferralCode(Member member) {
        if (member.getReferralCode() == null || member.getReferralCode().isEmpty()) {
            member.setReferralCode(generateReferralCode());
            memberRepository.save(member);
        }
    }

    // V-01: IDOR - No check if the requesting user matches the requested ID
    @Transactional(readOnly = true)
    public Member getUserInfo(Long memberId) {
        return memberRepository.findById(memberId)
                .orElseThrow(() -> new RuntimeException("Member not found"));
    }

    @Transactional(readOnly = true)
    public Member findByEmailForLogin(String email) {
        return memberRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("Member not found"));
    }

    @Transactional
    public Member saveMember(Member member) {
        return memberRepository.save(member);
    }

    @Transactional
    public void withdrawMember(Member member) {
        member.setStatus(Member.Status.WITHDRAWN);
        member.setEmail("withdrawn_" + member.getMemberId() + "@deleted.com");
        member.setName("탈퇴회원");
        member.setPhoneNumber("000-0000-0000");
        member.setAddress("삭제됨");
        member.setAccountNumber("삭제됨");
        member.setAccountHolder("삭제됨");
        member.setReferralCode(null);
        member.setPassword("");
        memberRepository.save(member);
    }
}
