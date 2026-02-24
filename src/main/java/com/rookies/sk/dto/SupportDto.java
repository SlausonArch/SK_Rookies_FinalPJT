package com.rookies.sk.dto;

import lombok.Data;

public class SupportDto {

    @Data
    public static class InquiryRequest {
        private String title;
        private String content;
    }

}
