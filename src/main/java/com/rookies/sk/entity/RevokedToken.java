package com.rookies.sk.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Table(name = "REVOKED_TOKENS")
public class RevokedToken {

    @Id
    @Column(name = "TOKEN_ID", nullable = false, updatable = false, length = 64)
    private String tokenId;

    @Column(name = "MEMBER_EMAIL", length = 100)
    private String memberEmail;

    @Column(name = "TOKEN_TYPE", nullable = false, length = 20)
    private String tokenType;

    @Column(name = "REVOKED_REASON", length = 100)
    private String revokedReason;

    @Column(name = "EXPIRES_AT", nullable = false)
    private LocalDateTime expiresAt;

    @Column(name = "REVOKED_AT", nullable = false)
    private LocalDateTime revokedAt;
}
