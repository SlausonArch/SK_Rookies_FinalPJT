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
 * Keeps the exchange test account usable across redeploys, even if an older row already exists.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class TestDataInitializer implements ApplicationRunner {

    private static final String TEST_EMAIL = "test@vce.com";
    private static final String TEST_PASSWORD = "test1234";
    private static final String TEST_NAME = "테스트 계정";
    private static final BigDecimal INITIAL_KRW = new BigDecimal("10000000000");

    private final MemberRepository memberRepository;
    private final AssetRepository assetRepository;
    private final PasswordEncoder passwordEncoder;

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
            boolean updated = false;

            if (member.getRole() != Member.Role.USER) {
                member.setRole(Member.Role.USER);
                updated = true;
            }
            if (member.getStatus() != Member.Status.ACTIVE) {
                member.setStatus(Member.Status.ACTIVE);
                updated = true;
            }
            if (member.getLoginFailCount() != 0) {
                member.setLoginFailCount(0);
                updated = true;
            }
            if (member.getPassword() == null || !passwordEncoder.matches(TEST_PASSWORD, member.getPassword())) {
                member.setPassword(passwordEncoder.encode(TEST_PASSWORD));
                updated = true;
            }
            if (member.getName() == null || member.getName().isBlank()) {
                member.setName(TEST_NAME);
                updated = true;
            }
            if (member.getRrnPrefix() == null || member.getRrnPrefix().isBlank()) {
                member.setRrnPrefix("000101-1");
                updated = true;
            }
            if (member.getPhoneNumber() == null || member.getPhoneNumber().isBlank()) {
                member.setPhoneNumber("010-0000-0001");
                updated = true;
            }

            if (updated) {
                memberRepository.save(member);
                log.info("테스트 계정 보정: {}", TEST_EMAIL);
            }
        }

        Asset krw = assetRepository.findByMember_MemberIdAndAssetType(member.getMemberId(), "KRW").orElse(null);
        if (krw == null) {
            krw = Asset.builder()
                    .member(member)
                    .assetType("KRW")
                    .balance(INITIAL_KRW)
                    .lockedBalance(BigDecimal.ZERO)
                    .averageBuyPrice(BigDecimal.ZERO)
                    .build();
            assetRepository.save(krw);
            log.info("테스트 계정 KRW 초기 자산 지급 완료");
            return;
        }

        boolean assetUpdated = false;
        if (krw.getBalance() == null || krw.getBalance().compareTo(INITIAL_KRW) < 0) {
            krw.setBalance(INITIAL_KRW);
            assetUpdated = true;
        }
        if (krw.getLockedBalance() == null) {
            krw.setLockedBalance(BigDecimal.ZERO);
            assetUpdated = true;
        }
        if (krw.getAverageBuyPrice() == null) {
            krw.setAverageBuyPrice(BigDecimal.ZERO);
            assetUpdated = true;
        }
        if (assetUpdated) {
            assetRepository.save(krw);
            log.info("테스트 계정 KRW 자산 보정 완료");
        }
    }
}
