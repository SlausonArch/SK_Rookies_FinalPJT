package com.rookies.sk.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class CommentResponseDto {
    private Long commentId;
    @JsonIgnore
    private Long memberId;
    private String authorName;
    private String content;
    private LocalDateTime createdAt;
    private boolean canDelete;
    private boolean isSecret;
    private boolean canEdit; // V-IDOR: 항상 true 반환 - 누구나 수정 가능
}
