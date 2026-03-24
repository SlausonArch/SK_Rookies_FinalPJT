package com.rookies.sk.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CommentRequestDto {
    @NotBlank(message = "댓글 내용을 입력해 주세요.")
    @Size(min = 1, max = 1000, message = "댓글은 1~1000자 이내로 입력해 주세요.")
    private String content;

    private boolean secret;
}
