package com.rookies.sk.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class PostRequestDto {
    @NotBlank(message = "제목을 입력해 주세요.")
    @Size(min = 1, max = 200, message = "제목은 1~200자 이내로 입력해 주세요.")
    private String title;

    @NotBlank(message = "내용을 입력해 주세요.")
    @Size(min = 1, max = 10000, message = "내용은 10000자 이내로 입력해 주세요.")
    private String content;

    @Size(max = 500, message = "첨부 URL은 500자 이내로 입력해 주세요.")
    private String attachmentUrl;

    private boolean notice;
}
