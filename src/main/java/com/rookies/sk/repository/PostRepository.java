package com.rookies.sk.repository;

import com.rookies.sk.entity.Post;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface PostRepository extends JpaRepository<Post, Long> {

    // 공개 게시글만 조회
    List<Post> findByIsHidden(String isHidden);
}
