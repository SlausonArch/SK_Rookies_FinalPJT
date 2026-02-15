package com.rookies.sk.service;

import com.rookies.sk.dto.SignupRequestDto;
import com.rookies.sk.entity.Member;
import com.rookies.sk.repository.MemberRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
        member.setRole(Member.Role.USER);
        member.setStatus(Member.Status.ACTIVE);

        return memberRepository.save(member);
    }

    // V-01: IDOR - No check if the requesting user matches the requested ID
    @Transactional(readOnly = true)
    public Member getUserInfo(Long memberId) {
        return memberRepository.findById(memberId)
                .orElseThrow(() -> new RuntimeException("Member not found"));
    }
}
