package com.rookies.sk.repository;

import com.rookies.sk.entity.Member;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface MemberRepository extends JpaRepository<Member, Long> {
    Optional<Member> findByEmail(String email);

    Optional<Member> findByReferralCode(String referralCode);

    boolean existsByEmail(String email);

    @Query("""
    select m from Member m
    where (:pattern is null or lower(m.email) like lower(:pattern) escape '!'
                             or lower(m.name)  like lower(:pattern) escape '!')
      and (:role is null or m.role = :role)
      and (:status is null or m.status = :status)
      and m.role not in :excludeRoles
    """)
    Page<Member> searchMembers(
            @Param("pattern") String pattern,
            @Param("role") Member.Role role,
            @Param("status") Member.Status status,
            @Param("excludeRoles") List<Member.Role> excludeRoles,
            Pageable pageable
    );
}
