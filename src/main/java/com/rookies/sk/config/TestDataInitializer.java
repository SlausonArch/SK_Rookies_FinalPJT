package com.rookies.sk.config;

import com.rookies.sk.entity.Asset;
import com.rookies.sk.entity.Member;
import com.rookies.sk.repository.AssetRepository;
import com.rookies.sk.repository.MemberRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

/**
 * 애플리케이션 시작 시 테스트 계정 및 초기 자산을 자동 생성한다.
 * test@vce.com / test1234 계정이 없으면 생성하고, KRW 100억을 지급한다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class TestDataInitializer implements ApplicationRunner {

    private static final String TEST_EMAIL    = "test@vce.com";
    private static final String TEST_PASSWORD = "test1234";
    private static final String TEST_NAME     = "테스트 계정";
    private static final BigDecimal INITIAL_KRW = new BigDecimal("10000000000"); // 100억

    private final MemberRepository memberRepository;
    private final AssetRepository  assetRepository;
    private final PasswordEncoder  passwordEncoder;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        Member member = memberRepository.findByEmail(TEST_EMAIL).orElse(null);

        if (member == null) {
            member = Member.builder()
                    .email(TEST_EMAIL)
                    .password(passwordEncoder.encode(TEST_PASSWORD))
                    .name(TEST_NAME)
                    .role(Member.Role.USER)
                    .status(Member.Status.ACTIVE)
                    .rrnPrefix("000101-1")
                    .phoneNumber("010-0000-0001")
                    .build();
            memberRepository.save(member);
            log.info("테스트 계정 생성: {}", TEST_EMAIL);
        } else {
            // 이미 존재하면 상태만 ACTIVE로 보정
            if (member.getStatus() != Member.Status.ACTIVE) {
                member.setStatus(Member.Status.ACTIVE);
                member.setLoginFailCount(0);
                memberRepository.save(member);
            }
        }

        // KRW 자산 생성 또는 100억으로 리셋
        Asset krw = assetRepository
                .findByMember_MemberIdAndAssetType(member.getMemberId(), "KRW")
                .orElse(null);

        if (krw == null) {
            krw = Asset.builder()
                    .member(member)
                    .assetType("KRW")
                    .balance(INITIAL_KRW)
                    .lockedBalance(BigDecimal.ZERO)
                    .averageBuyPrice(BigDecimal.ZERO)
                    .build();
            assetRepository.save(krw);
            log.info("테스트 계정 KRW 100억 지급 완료");
        }
    }
}
