package com.rookies.sk.dto;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
public class OrderRequestDto {
    private String orderType;
    private String priceType;
    private String assetType;
    private BigDecimal price;
    private BigDecimal amount;
}
