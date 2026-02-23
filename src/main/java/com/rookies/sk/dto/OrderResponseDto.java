package com.rookies.sk.dto;

import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Builder
public class OrderResponseDto {
    private Long orderId;
    private String orderType;
    private String priceType;
    private String assetType;
    private BigDecimal price;
    private BigDecimal amount;
    private BigDecimal filledAmount;
    private String status;
    private LocalDateTime createdAt;
}
