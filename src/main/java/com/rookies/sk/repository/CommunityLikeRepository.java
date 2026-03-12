package com.rookies.sk.repository;

import com.rookies.sk.entity.CommunityLike;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CommunityLikeRepository extends JpaRepository<CommunityLike, Long> {
    boolean existsByTargetTypeAndTargetIdAndMember_MemberId(String targetType, Long targetId, Long memberId);

    long countByTargetTypeAndTargetId(String targetType, Long targetId);

    void deleteByTargetTypeAndTargetIdAndMember_MemberId(String targetType, Long targetId, Long memberId);
}
