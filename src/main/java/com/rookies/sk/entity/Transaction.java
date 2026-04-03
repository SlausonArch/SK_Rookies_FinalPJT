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
@Table(name = "TRANSACTIONS")
public class Transaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "TX_ID")
    private Long txId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "MEMBER_ID", nullable = false)
    private Member member;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ORDER_ID")
    private Order order;

    @Column(name = "TX_TYPE", nullable = false, length = 20)
    private String txType;

    @Column(name = "ASSET_TYPE", nullable = false, length = 20)
    private String assetType;

    @Column(name = "AMOUNT", nullable = false, precision = 19, scale = 8)
    private BigDecimal amount;

    @Column(name = "PRICE", precision = 19, scale = 8)
    private BigDecimal price;

    @Column(name = "TOTAL_VALUE", precision = 19, scale = 8)
    private BigDecimal totalValue;

    @Column(name = "FEE", precision = 19, scale = 8)
    @Builder.Default
    private BigDecimal fee = BigDecimal.ZERO;

    @Column(name = "TX_DATE")
    private LocalDateTime txDate;

    // --- New fields for Bank and Internal Wallet Transfers ---

    @Column(name = "FROM_ADDRESS", length = 255)
    private String fromAddress;

    @Column(name = "TO_ADDRESS", length = 255)
    private String toAddress;

    @Column(name = "TX_HASH", length = 255)
    private String txHash;

    @Column(name = "BANK_NAME", length = 50)
    private String bankName;

    @Column(name = "ACCOUNT_NUMBER", length = 100)
    private String accountNumber;

    @Column(name = "NOTE", length = 500)
    private String note;

    @Column(name = "STATUS", length = 20)
    @Builder.Default
    private String status = "COMPLETED"; // e.g., PENDING, COMPLETED, FAILED

    @PrePersist
    public void prePersist() {
        this.txDate = LocalDateTime.now();
        if (this.status == null) {
            this.status = "COMPLETED";
        }
    }
}
