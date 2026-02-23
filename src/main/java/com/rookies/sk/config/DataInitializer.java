package com.rookies.sk.config;

import com.rookies.sk.entity.Asset;
import com.rookies.sk.entity.Member;
import com.rookies.sk.entity.Transaction;
import com.rookies.sk.repository.AssetRepository;
import com.rookies.sk.repository.MemberRepository;
import com.rookies.sk.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.math.BigDecimal;

@Slf4j
@Configuration
@RequiredArgsConstructor
public class DataInitializer {

    private final MemberRepository memberRepository;
    private final AssetRepository assetRepository;
    private final TransactionRepository transactionRepository;
    private final PasswordEncoder passwordEncoder;

    @Bean
    public CommandLineRunner initAccounts() {
        return args -> {
            // 관리자 계정
            if (memberRepository.findByEmail("admin@vce.com").isEmpty()) {
                Member admin = Member.builder()
                        .email("admin@vce.com")
                        .password(passwordEncoder.encode("admin1234"))
                        .name("시스템 관리자")
                        .role(Member.Role.ADMIN)
                        .status(Member.Status.ACTIVE)
                        .build();
                memberRepository.save(admin);
                log.info("관리자 계정 생성 완료: admin@vce.com / admin1234");
            }

            // 테스트 유저 계정
            if (memberRepository.findByEmail("test@vce.com").isEmpty()) {
                Member testUser = Member.builder()
                        .email("test@vce.com")
                        .password(passwordEncoder.encode("test1234"))
                        .name("테스트 사용자")
                        .phoneNumber("010-1234-5678")
                        .rrnPrefix("950101")
                        .address("서울시 강남구")
                        .accountNumber("123-456-789012")
                        .role(Member.Role.USER)
                        .status(Member.Status.ACTIVE)
                        .build();
                memberRepository.save(testUser);

                // KRW 초기 잔고 1000만원
                Asset krwAsset = Asset.builder()
                        .member(testUser)
                        .assetType("KRW")
                        .balance(new BigDecimal("10000000"))
                        .lockedBalance(BigDecimal.ZERO)
                        .build();
                assetRepository.save(krwAsset);

                // 입금 거래 기록
                Transaction depositTx = Transaction.builder()
                        .member(testUser)
                        .txType("DEPOSIT")
                        .assetType("KRW")
                        .amount(new BigDecimal("10000000"))
                        .totalValue(new BigDecimal("10000000"))
                        .build();
                transactionRepository.save(depositTx);

                log.info("테스트 계정 생성 완료: test@vce.com / test1234 (KRW 10,000,000)");
            }
        };
    }
}
