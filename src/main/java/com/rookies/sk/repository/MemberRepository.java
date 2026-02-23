package com.rookies.sk.repository;

import com.rookies.sk.entity.Member;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface MemberRepository extends JpaRepository<Member, Long> {
    Optional<Member> findByEmail(String email);

    Optional<Member> findByReferralCode(String referralCode);

    boolean existsByEmail(String email);
}
