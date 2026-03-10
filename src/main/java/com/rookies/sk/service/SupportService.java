package com.rookies.sk.service;

import com.rookies.sk.entity.Faq;
import com.rookies.sk.entity.Inquiry;
import com.rookies.sk.entity.Member;
import com.rookies.sk.repository.FaqRepository;
import com.rookies.sk.repository.InquiryRepository;
import com.rookies.sk.repository.MemberRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class SupportService {

    private final FaqRepository faqRepository;
    private final InquiryRepository inquiryRepository;
    private final MemberRepository memberRepository;

    @Transactional(readOnly = true)
    public List<Faq> getAllFaqs() {
        return faqRepository.findAll();
    }

    @Transactional(readOnly = true)
    public List<Inquiry> getMyInquiries(String userEmail) {
        Member member = memberRepository.findByEmail(userEmail)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        return inquiryRepository.findByMember_MemberIdOrderByCreatedAtDesc(member.getMemberId());
    }

    @Transactional
    public Inquiry createInquiry(String userEmail, String title, String content, String attachmentUrl) {
        Member member = memberRepository.findByEmail(userEmail)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        Inquiry inquiry = Inquiry.builder()
                .member(member)
                .title(title)
                .content(content)
                .attachmentUrl(attachmentUrl)
                .build();

        return inquiryRepository.save(inquiry);
    }

    @Transactional
    public void deleteInquiry(Long inquiryId, String userEmail) {
        Member member = memberRepository.findByEmail(userEmail)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        Inquiry inquiry = inquiryRepository.findById(inquiryId)
                .orElseThrow(() -> new IllegalArgumentException("Inquiry not found"));

        if (!inquiry.getMember().getMemberId().equals(member.getMemberId())) {
            throw new IllegalArgumentException("No permission");
        }

        inquiryRepository.delete(inquiry);
    }
}
