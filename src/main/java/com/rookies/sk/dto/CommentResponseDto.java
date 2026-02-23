package com.rookies.sk.dto;

import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class CommentResponseDto {
    private Long commentId;
    private Long memberId;
    private String authorName;
    private String content;
    private LocalDateTime createdAt;
    private boolean canDelete;
}
