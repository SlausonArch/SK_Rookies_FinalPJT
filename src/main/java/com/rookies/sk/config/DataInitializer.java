package com.rookies.sk.config;

import com.rookies.sk.entity.Faq;
import com.rookies.sk.entity.Inquiry;
import com.rookies.sk.entity.Member;
import com.rookies.sk.repository.FaqRepository;
import com.rookies.sk.repository.InquiryRepository;
import com.rookies.sk.repository.MemberRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

@Slf4j
@Configuration
@RequiredArgsConstructor
public class DataInitializer {

    private final MemberRepository memberRepository;
    private final FaqRepository faqRepository;
    private final InquiryRepository inquiryRepository;
    private final PasswordEncoder passwordEncoder;

    @Bean
    public CommandLineRunner initAccounts() {
        return args -> {
            // 관리자 계정 (매번 비밀번호 갱신)
            memberRepository.findByEmail("admin@vce.com").ifPresentOrElse(
                    admin -> {
                        admin.setPassword(passwordEncoder.encode("admin1234"));
                        memberRepository.save(admin);
                        log.info("기존 관리자 계정 비밀번호 갱신 완료: admin@vce.com / admin1234");
                    },
                    () -> {
                        Member admin = Member.builder()
                                .email("admin@vce.com")
                                .password(passwordEncoder.encode("admin1234"))
                                .name("시스템 관리자")
                                .phoneNumber("010-0000-0000")
                                .rrnPrefix("000101")
                                .role(Member.Role.VCESYS_CORE)
                                .status(Member.Status.ACTIVE)
                                .build();
                        memberRepository.save(admin);
                        log.info("신규 관리자 계정 생성 완료: admin@vce.com / admin1234");
                    });

            // 테스트 유저 계정 (매번 비밀번호 갱신)
            memberRepository.findByEmail("test@vce.com").ifPresentOrElse(
                    testUser -> {
                        testUser.setPassword(passwordEncoder.encode("test1234"));
                        testUser.setRole(Member.Role.VCESYS_EMP);
                        testUser.setBankName("VCE 가상은행");
                        testUser.setAccountNumber("110-123-456789");
                        memberRepository.save(testUser);
                        log.info("기존 테스트 계정 비밀번호/역할/계좌 갱신 완료: test@vce.com / test1234 (STAFF)");
                    },
                    () -> {
                        Member testUser = Member.builder()
                                .email("test@vce.com")
                                .password(passwordEncoder.encode("test1234"))
                                .name("테스트 사용자")
                                .phoneNumber("010-1234-5678")
                                .rrnPrefix("950101")
                                .address("서울시 강남구")
                                .bankName("VCE 가상은행")
                                .accountNumber("110-123-456789")
                                .role(Member.Role.VCESYS_EMP)
                                .status(Member.Status.ACTIVE)
                                .build();
                        memberRepository.save(testUser);
                        log.info("신규 테스트 계정 생성 완료: test@vce.com / test1234 (STAFF)");
                    });

            // 매니저 계정 (매번 비밀번호 갱신)
            memberRepository.findByEmail("manager@vce.com").ifPresentOrElse(
                    manager -> {
                        manager.setPassword(passwordEncoder.encode("manager1234"));
                        memberRepository.save(manager);
                        log.info("기존 매니저 계정 비밀번호 갱신 완료: manager@vce.com / manager1234");
                    },
                    () -> {
                        Member manager = Member.builder()
                                .email("manager@vce.com")
                                .password(passwordEncoder.encode("manager1234"))
                                .name("매니저")
                                .phoneNumber("010-0000-0001")
                                .rrnPrefix("000101")
                                .role(Member.Role.VCESYS_MGMT)
                                .status(Member.Status.ACTIVE)
                                .build();
                        memberRepository.save(manager);
                        log.info("신규 매니저 계정 생성 완료: manager@vce.com / manager1234");
                    });

            // 스태프 계정 (매번 비밀번호 갱신)
            memberRepository.findByEmail("staff@vce.com").ifPresentOrElse(
                    staff -> {
                        staff.setPassword(passwordEncoder.encode("staff1234"));
                        memberRepository.save(staff);
                        log.info("기존 스태프 계정 비밀번호 갱신 완료: staff@vce.com / staff1234");
                    },
                    () -> {
                        Member staff = Member.builder()
                                .email("staff@vce.com")
                                .password(passwordEncoder.encode("staff1234"))
                                .name("스태프")
                                .phoneNumber("010-0000-0002")
                                .rrnPrefix("000101")
                                .role(Member.Role.VCESYS_EMP)
                                .status(Member.Status.ACTIVE)
                                .build();
                        memberRepository.save(staff);
                        log.info("신규 스태프 계정 생성 완료: staff@vce.com / staff1234");
                    });

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

            // 1:1 문의 예시 데이터 (test@vce.com 소유)
            if (inquiryRepository.count() == 0) {
                memberRepository.findByEmail("test@vce.com").ifPresent(testUser -> {
                    inquiryRepository.save(Inquiry.builder()
                            .member(testUser)
                            .title("자산 금액 표기 오류 문의합니다.")
                            .content("투자내역 탭에서 제가 가진 수익률이 항상 -10%로 표시됩니다. 확인 부탁드립니다.")
                            .status("ANSWERED")
                            .reply("안녕하세요 관리자입니다. 해당 문제는 V-Series 라운딩 오차 취약점으로 인한 의도된 렌더링입니다. 취약점 진단 점수가 인정되었습니다. 감사합니다.")
                            .build());

                    inquiryRepository.save(Inquiry.builder()
                            .member(testUser)
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
