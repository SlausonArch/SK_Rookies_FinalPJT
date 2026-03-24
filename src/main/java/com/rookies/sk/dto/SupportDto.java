package com.rookies.sk.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

public class SupportDto {

    @Data
    public static class InquiryRequest {
        @NotBlank(message = "제목을 입력해 주세요.")
        @Size(min = 1, max = 200, message = "제목은 1~200자 이내로 입력해 주세요.")
        private String title;

        @NotBlank(message = "내용을 입력해 주세요.")
        @Size(min = 1, max = 5000, message = "내용은 1~5000자 이내로 입력해 주세요.")
        private String content;
    }

}
