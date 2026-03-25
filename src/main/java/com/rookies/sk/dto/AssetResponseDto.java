package com.rookies.sk.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;

@Getter
@Builder
public class AssetResponseDto {
    @JsonIgnore
    private Long assetId;
    private String assetType;
    private BigDecimal balance;
    private BigDecimal lockedBalance;
    private BigDecimal availableBalance;
    private BigDecimal averageBuyPrice;
}
