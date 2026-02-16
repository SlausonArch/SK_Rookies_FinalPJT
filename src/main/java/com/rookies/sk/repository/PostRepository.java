package com.rookies.sk.repository;

import com.rookies.sk.entity.Post;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface PostRepository extends JpaRepository<Post, Long> {

    @Query(
            value = "SELECT * " +
                    "FROM POSTS " +
                    "WHERE (:keyword IS NULL " +
                    "  OR LOWER(TITLE) LIKE LOWER('%' || :keyword || '%') " +
                    "  OR DBMS_LOB.INSTR(CONTENT, :keyword) > 0) " +
                    "AND IS_HIDDEN = 'N' " +
                    "ORDER BY IS_NOTICE DESC, CREATED_AT DESC",
            nativeQuery = true)
    List<Post> searchVisiblePosts(@Param("keyword") String keyword);

    @Query(
            value = "SELECT * " +
                    "FROM POSTS " +
                    "WHERE (:keyword IS NULL " +
                    "  OR LOWER(TITLE) LIKE LOWER('%' || :keyword || '%') " +
                    "  OR DBMS_LOB.INSTR(CONTENT, :keyword) > 0) " +
                    "ORDER BY IS_NOTICE DESC, CREATED_AT DESC",
            nativeQuery = true)
    List<Post> searchAllPostsForAdmin(@Param("keyword") String keyword);
}
