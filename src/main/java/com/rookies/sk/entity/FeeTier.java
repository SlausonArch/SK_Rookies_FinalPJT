package com.rookies.sk.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Table(name = "FEE_TIERS")
public class FeeTier {

    @Id
    @Column(name = "TIER_LEVEL")
    private Long tierLevel;

    @Column(name = "TIER_NAME", nullable = false, length = 50)
    private String tierName;

    @Column(name = "MIN_VOLUME", precision = 19, scale = 4)
    private BigDecimal minVolume;

    @Column(name = "MAX_VOLUME", precision = 19, scale = 4)
    private BigDecimal maxVolume;

    @Column(name = "FEE_RATE", nullable = false, precision = 5, scale = 4)
    private BigDecimal feeRate;
}
