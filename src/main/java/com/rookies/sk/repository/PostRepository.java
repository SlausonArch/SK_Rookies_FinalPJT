package com.rookies.sk.repository;

import com.rookies.sk.entity.Post;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface PostRepository extends JpaRepository<Post, Long> {

    // 공개 게시글만 조회
    List<Post> findByIsHidden(String isHidden);

    // 좋아요 Race Condition 방지용 비관적 잠금 조회 (SELECT ... FOR UPDATE)
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM Post p WHERE p.postId = :postId")
    Optional<Post> findWithLockById(@Param("postId") Long postId);
}
