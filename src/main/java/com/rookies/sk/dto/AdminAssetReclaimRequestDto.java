package com.rookies.sk.dto;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
public class AdminAssetReclaimRequestDto {
    private String assetType;
    private BigDecimal amount;
    private String reason;
}
