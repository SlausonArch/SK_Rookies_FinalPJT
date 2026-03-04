package com.rookies.sk.dto;

import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;

@Getter
@Builder
public class AssetSummaryDto {
    private BigDecimal krwBalance;
    private BigDecimal totalInvestment; // 총 투자원금 (입금 - 출금)
    private BigDecimal totalAssetValue; // 총 자산 가치 (KRW + 코인 평가액)
    private BigDecimal profitLoss; // 총 손익
    private BigDecimal profitRate; // 수익률
}
