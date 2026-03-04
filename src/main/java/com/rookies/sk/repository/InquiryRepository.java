package com.rookies.sk.repository;

import com.rookies.sk.entity.Inquiry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface InquiryRepository extends JpaRepository<Inquiry, Long> {
    List<Inquiry> findByMember_MemberIdOrderByCreatedAtDesc(Long memberId);
}
