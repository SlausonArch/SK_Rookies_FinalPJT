package com.rookies.sk.config;

import com.rookies.sk.entity.Member;
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
    private final PasswordEncoder passwordEncoder;

    @Bean
    public CommandLineRunner initAdminAccount() {
        return args -> {
            // 관리자 계정이 이미 있는지 확인
            if (memberRepository.findByEmail("admin@vce.com").isEmpty()) {
                Member admin = Member.builder()
                        .email("admin@vce.com")
                        .password(passwordEncoder.encode("admin1234")) // 초기 비밀번호
                        .name("시스템 관리자")
                        .role(Member.Role.ADMIN)
                        .status(Member.Status.ACTIVE)
                        .build();

                memberRepository.save(admin);
                log.info("✅ 초기 관리자 계정 생성 완료: admin@vce.com / admin1234");
            } else {
                log.info("관리자 계정이 이미 존재합니다.");
            }
        };
    }
}
