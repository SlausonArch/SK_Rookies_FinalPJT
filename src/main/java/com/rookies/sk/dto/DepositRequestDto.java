package com.rookies.sk.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
public class DepositRequestDto {
    private String assetType;

    @NotNull(message = "금액은 필수입니다.")
    @DecimalMin(value = "0.00000001", message = "금액은 0보다 커야 합니다.")
    private BigDecimal amount;

    private String bankName;
    private String accountNumber;
}
