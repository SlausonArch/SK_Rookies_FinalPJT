package com.rookies.sk.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Table(name = "ORDERS")
public class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "ORDER_ID")
    private Long orderId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "MEMBER_ID", nullable = false)
    private Member member;

    @Column(name = "ORDER_TYPE", nullable = false, length = 10)
    private String orderType;

    @Column(name = "PRICE_TYPE", length = 10)
    @Builder.Default
    private String priceType = "LIMIT";

    @Column(name = "ASSET_TYPE", nullable = false, length = 20)
    private String assetType;

    @Column(name = "PRICE", precision = 19, scale = 8)
    private BigDecimal price;

    @Column(name = "AMOUNT", nullable = false, precision = 19, scale = 8)
    private BigDecimal amount;

    @Column(name = "FILLED_AMOUNT", precision = 19, scale = 8)
    @Builder.Default
    private BigDecimal filledAmount = BigDecimal.ZERO;

    @Column(name = "STATUS", length = 20)
    @Builder.Default
    private String status = "PENDING";

    @Column(name = "CREATED_AT")
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        this.createdAt = LocalDateTime.now();
    }
}
