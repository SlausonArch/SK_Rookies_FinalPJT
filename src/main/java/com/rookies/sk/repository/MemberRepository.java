package com.rookies.sk.repository;

import com.rookies.sk.entity.Member;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface MemberRepository extends JpaRepository<Member, Long> {
    Optional<Member> findByEmail(String email);

    Optional<Member> findByReferralCode(String referralCode);

    boolean existsByEmail(String email);

    @Query("""
    select m from Member m
    where (:q is null or :q = '' or lower(m.email) like lower(concat('%', :q, '%')) escape '!' or lower(m.name) like lower(concat('%', :q, '%')) escape '!')
      and (:role is null or m.role = :role)
      and (:status is null or m.status = :status)
    """)
    Page<Member> searchMembers(
            @Param("q") String q,
            @Param("role") Member.Role role,
            @Param("status") Member.Status status,
            Pageable pageable
    );
}
