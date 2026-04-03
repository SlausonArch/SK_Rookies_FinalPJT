package com.rookies.sk.config;

import com.rookies.sk.entity.Faq;
import com.rookies.sk.entity.FeeTier;
import com.rookies.sk.entity.Inquiry;
import com.rookies.sk.entity.Member;
import com.rookies.sk.repository.FaqRepository;
import com.rookies.sk.repository.FeeTierRepository;
import com.rookies.sk.repository.InquiryRepository;
import com.rookies.sk.repository.MemberRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.math.BigDecimal;

@Slf4j
@Configuration
@RequiredArgsConstructor
public class DataInitializer {

    private final MemberRepository memberRepository;
    private final FeeTierRepository feeTierRepository;
    private final FaqRepository faqRepository;
    private final InquiryRepository inquiryRepository;

    /** SHA-256 hex — 관리자 계정 비밀번호 저장 형식 (init.sql과 동일) */
    private static String sha256Hex(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : hash) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 not available", e);
        }
    }

    private void ensureAdminAccount(String email, String plainPassword, String name,
                                    String phone, Member.Role role) {
        String hashed = sha256Hex(plainPassword);
        memberRepository.findByEmail(email).ifPresentOrElse(
                existing -> {
                    if (existing.getStatus() == Member.Status.WITHDRAWN) {
                        log.info("비활성화된 관리자 계정 유지: {} ({})", email, existing.getRole());
                        return;
                    }
                    existing.setPassword(hashed);
                    existing.setRole(role);
                    existing.setStatus(Member.Status.ACTIVE);
                    memberRepository.save(existing);
                    log.info("관리자 계정 갱신: {} ({})", email, role);
                },
                () -> {
                    Member m = Member.builder()
                            .email(email)
                            .password(hashed)
                            .name(name)
                            .phoneNumber(phone)
                            .rrnPrefix("000101")
                            .role(role)
                            .status(Member.Status.ACTIVE)
                            .build();
                    memberRepository.save(m);
                    log.info("관리자 계정 생성: {} ({})", email, role);
                });
    }

    private void ensureFeeTier(long tierLevel, String tierName, String minVolume, String maxVolume, String feeRate) {
        FeeTier tier = feeTierRepository.findById(tierLevel).orElseGet(() -> FeeTier.builder().tierLevel(tierLevel).build());
        tier.setTierName(tierName);
        tier.setMinVolume(new BigDecimal(minVolume));
        tier.setMaxVolume(maxVolume == null ? null : new BigDecimal(maxVolume));
        tier.setFeeRate(new BigDecimal(feeRate));
        feeTierRepository.save(tier);
    }

    @Bean
    public CommandLineRunner initAccounts() {
        return args -> {
            ensureFeeTier(1L, "BRONZE", "0", "99999999.9999", "0.0008");
            ensureFeeTier(2L, "SILVER", "100000000", "1999999999.9999", "0.0005");
            ensureFeeTier(3L, "GOLD", "2000000000", "19999999999.9999", "0.0003");
            ensureFeeTier(4L, "VIP", "20000000000", null, "0.0001");

            // 관리자 계정 (init.sql과 동일한 계정/비밀번호)
            ensureAdminAccount("core@vce.com", "Core!2024", "코어 관리자", "010-0000-0001", Member.Role.VCESYS_CORE);
            ensureAdminAccount("mgmt@vce.com", "Mgmt!2024", "매니지먼트", "010-0000-0002", Member.Role.VCESYS_MGMT);
            ensureAdminAccount("emp@vce.com", "Emp!2024", "임직원",   "010-0000-0003", Member.Role.VCESYS_EMP);

            // FAQ 초기 데이터 생성
            if (faqRepository.count() == 0) {
                faqRepository.save(Faq.builder().category("이용/가입").question("회원가입은 어떻게 하나요?").answer(
                        "우측 상단의 '회원가입' 버튼을 누른 뒤, 카카오톡 또는 네이버 간편 가입을 이용하거나 이메일 가입 절차를 따라 진행해 주시면 됩니다. (현재 플랫폼은 모의 해킹 목적이므로 민감정보를 요구하지 않습니다.)")
                        .build());
                faqRepository.save(Faq.builder().category("입출금").question("입금 처리가 되지 않습니다. 어떻게 해야 하나요?").answer(
                        "가상 자산 거래소 모의 진단 목적상, 실제 입출금은 지원하지 않으며 데모 자산(1,000만원) 또는 자산 내역 추가 기능만 작동합니다. 에러가 발생했다면 V-Series 취약점 확인차 발생한 오류일 수 있습니다.")
                        .build());
                faqRepository.save(Faq.builder().category("보안/인증").question("내 계정이 해킹당한 것 같습니다.").answer(
                        "본 플랫폼은 의도적인 보안 결함(취약점)이 다수 존재하며, 이를 학습하고 진단하는 용도입니다. 1:1 문의 게시판을 통해 발견한 취약점을 신고해 보실 수 있습니다!")
                        .build());
                log.info("더미 FAQ(자주 묻는 질문) 생성 완료");
            }

            // 1:1 문의 예시 데이터 (emp@vce.com 소유)
            if (inquiryRepository.count() == 0) {
                memberRepository.findByEmail("emp@vce.com").ifPresent(emp -> {
                    inquiryRepository.save(Inquiry.builder()
                            .member(emp)
                            .title("자산 금액 표기 오류 문의합니다.")
                            .content("투자내역 탭에서 제가 가진 수익률이 항상 -10%로 표시됩니다. 확인 부탁드립니다.")
                            .status("ANSWERED")
                            .reply("안녕하세요 관리자입니다. 해당 문제는 V-Series 라운딩 오차 취약점으로 인한 의도된 렌더링입니다. 취약점 진단 점수가 인정되었습니다. 감사합니다.")
                            .build());
                    inquiryRepository.save(Inquiry.builder()
                            .member(emp)
                            .title("비밀번호 변경은 어디서 하나요")
                            .content("마이페이지에 가도 비밀번호 변경 창이 안보여요.")
                            .status("PENDING")
                            .build());
                    log.info("테스트용 1:1 문의 데이터 생성 완료");
                });
            }
        };
    }
}
