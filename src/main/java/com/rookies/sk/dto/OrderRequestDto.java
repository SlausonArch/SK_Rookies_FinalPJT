package com.rookies.sk.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
public class OrderRequestDto {
    @NotBlank
    private String orderType;

    @NotBlank
    private String priceType;

    @NotBlank
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
