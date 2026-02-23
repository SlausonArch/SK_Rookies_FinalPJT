package com.rookies.sk.dto;

import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class PostResponseDto {
    private Long postId;
    private Long memberId;
    private String authorName;
    private String title;
    private String content;
    private String attachmentUrl;
    private boolean notice;
    private boolean hidden;
    private long viewCount;
    private long likeCount;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private boolean canEdit;
    private boolean canDelete;
    private boolean userLiked;
}
