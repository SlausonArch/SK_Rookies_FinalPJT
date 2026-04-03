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
@Table(name = "ACTIVE_SESSIONS")
public class ActiveSession {

    @Id
    @Column(name = "SESSION_KEY", nullable = false, updatable = false, length = 160)
    private String sessionKey;

    @Column(name = "MEMBER_EMAIL", nullable = false, length = 100)
    private String memberEmail;

    @Column(name = "SESSION_SCOPE", nullable = false, length = 20)
    private String sessionScope;

    @Column(name = "TOKEN_ID", nullable = false, length = 64)
    private String tokenId;

    @Column(name = "EXPIRES_AT", nullable = false)
    private LocalDateTime expiresAt;

    @Column(name = "UPDATED_AT", nullable = false)
    private LocalDateTime updatedAt;
}
