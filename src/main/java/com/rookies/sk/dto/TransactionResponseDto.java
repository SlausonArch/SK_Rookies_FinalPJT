package com.rookies.sk.dto;

import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Builder
public class TransactionResponseDto {
    private Long txId;
    private String txType;
    private String assetType;
    private BigDecimal amount;
    private BigDecimal price;
    private BigDecimal totalValue;
    private BigDecimal fee;
    private LocalDateTime txDate;
}
