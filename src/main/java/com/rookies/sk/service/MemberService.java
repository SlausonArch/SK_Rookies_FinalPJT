package com.rookies.sk.service;

import com.rookies.sk.dto.SignupRequestDto;
import com.rookies.sk.entity.Member;
import com.rookies.sk.repository.MemberRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;

@Service
@RequiredArgsConstructor
public class MemberService {

    private final MemberRepository memberRepository;

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
        member.setAccountNumber(dto.getAccountNumber());
        member.setIdPhotoUrl(itemsUrl);

        // 추천인 코드 생성 로직 (영문 대문자 + 숫자 8자리)
        member.setReferralCode(generateReferralCode());
        member.setReferredByCode(dto.getReferredByCode());

        member.setRole(Member.Role.USER);
        member.setStatus(Member.Status.ACTIVE);

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
}
