package com.rookies.sk.dto;

import com.rookies.sk.entity.Inquiry;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

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

    @Data
    @Builder
    public static class InquiryResponse {
        private Long inquiryId;
        private String title;
        private String content;
        private String status;
        private String reply;
        private String attachmentUrl;
        private LocalDateTime createdAt;
        private String memberName;
        private String memberEmail;

        public static InquiryResponse from(Inquiry inquiry) {
            return InquiryResponse.builder()
                    .inquiryId(inquiry.getInquiryId())
                    .title(inquiry.getTitle())
                    .content(inquiry.getContent())
                    .status(inquiry.getStatus())
                    .reply(inquiry.getReply())
                    .attachmentUrl(inquiry.getAttachmentUrl())
                    .createdAt(inquiry.getCreatedAt())
                    .memberName(inquiry.getMember() != null ? inquiry.getMember().getName() : null)
                    .memberEmail(inquiry.getMember() != null ? inquiry.getMember().getEmail() : null)
                    .build();
        }
    }

}
