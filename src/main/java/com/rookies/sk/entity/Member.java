package com.rookies.sk.entity;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@EntityListeners(AuditingEntityListener.class)
@Table(name = "MEMBERS")
public class Member {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "MEMBER_ID")
    private Long memberId;

    @Column(nullable = false, unique = true, length = 100)
    private String email;

    @Column(length = 255) // Password can be null for OAuth2 only users initially
    private String password;

    @Column(nullable = false, length = 50)
    private String name;

    @Column(name = "RRN_PREFIX", length = 20)
    private String rrnPrefix;

    @Column(name = "PHONE_NUMBER", length = 20)
    private String phoneNumber;

    @Column(length = 200)
    private String address;

    @Column(name = "BANK_NAME", length = 30)
    private String bankName;

    @Column(name = "ACCOUNT_NUMBER", length = 50)
    private String accountNumber;

    @Column(name = "ACCOUNT_HOLDER", length = 50)
    private String accountHolder;

    @Column(name = "ID_PHOTO_URL", length = 255)
    private String idPhotoUrl;

    @Column(name = "REFERRAL_CODE", length = 20, unique = true)
    private String referralCode;

    @Column(name = "REFERRED_BY_CODE", length = 20)
    private String referredByCode;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    @Builder.Default
    private Role role = Role.GUEST;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    @Builder.Default
    private Status status = Status.PENDING;

    @Column(name = "LOGIN_FAIL_COUNT")
    @Builder.Default
    private int loginFailCount = 0;

    @Column(name = "BANK_BALANCE", nullable = false, precision = 19, scale = 8)
    @Builder.Default
    private java.math.BigDecimal bankBalance = new java.math.BigDecimal("50000000");

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "TIER_LEVEL")
    private FeeTier feeTier;

    @CreatedDate
    @Column(name = "CREATED_AT", updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(name = "UPDATED_AT")
    private LocalDateTime updatedAt;

    public enum Role {
        GUEST, USER, VCESYS_EMP, VCESYS_MGMT, VCESYS_CORE
    }

    public enum Status {
        PENDING, ACTIVE, LOCKED, WITHDRAWN, AUTH_FAILED
    }
}
