package com.rookies.sk.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
public class OrderRequestDto {
    @NotBlank
    @Pattern(regexp = "^(BUY|SELL)$", message = "주문 유형은 BUY 또는 SELL이어야 합니다.")
    private String orderType;

    @NotBlank
    @Pattern(regexp = "^(LIMIT|MARKET)$", message = "주문 방식은 LIMIT 또는 MARKET이어야 합니다.")
    private String priceType;

    @NotBlank
    @Pattern(regexp = "^[A-Z0-9]{2,10}$", message = "유효하지 않은 자산 코드입니다.")
    private String assetType;

    @NotNull
    @DecimalMin(value = "0.0", inclusive = false, message = "가격은 0보다 커야 합니다.")
    @DecimalMax(value = "999999999999", message = "가격이 허용 범위를 초과했습니다.")
    private BigDecimal price;

    @NotNull
    @DecimalMin(value = "0.0", inclusive = false, message = "수량은 0보다 커야 합니다.")
    @DecimalMax(value = "999999999999", message = "수량이 허용 범위를 초과했습니다.")
    private BigDecimal amount;
}
