package com.rookies.sk.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Table(name = "POSTS")
public class Post {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "POST_ID")
    private Long postId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "MEMBER_ID")
    private Member member;

    @Column(name = "TITLE", nullable = false, length = 200)
    private String title;

    @Lob
    @Column(name = "CONTENT", nullable = false)
    private String content;

    @Column(name = "ATTACHMENT_URL", length = 500)
    private String attachmentUrl;

    @Column(name = "IS_NOTICE", nullable = false, length = 1)
    @Builder.Default
    private String isNotice = "N";

    @Column(name = "IS_HIDDEN", nullable = false, length = 1)
    @Builder.Default
    private String isHidden = "N";

    @Column(name = "VIEW_COUNT")
    @Builder.Default
    private Long viewCount = 0L;

    @Column(name = "LIKE_COUNT")
    @Builder.Default
    private Long likeCount = 0L;

    @Column(name = "CREATED_AT")
    private LocalDateTime createdAt;

    @Column(name = "UPDATED_AT")
    private LocalDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        if (this.createdAt == null) {
            this.createdAt = now;
        }
        this.updatedAt = now;
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}
