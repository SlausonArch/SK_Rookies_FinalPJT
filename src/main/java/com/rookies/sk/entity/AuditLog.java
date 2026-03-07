package com.rookies.sk.entity;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@EntityListeners(AuditingEntityListener.class)
@Table(name = "AUDIT_LOGS")
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "LOG_ID")
    private Long logId;

    @Column(name = "MEMBER_ID")
    private Long memberId;

    @Column(name = "ACTION", nullable = false, length = 100)
    private String action;

    @Column(name = "IP_ADDRESS", length = 50)
    private String ipAddress;

    @Column(name = "USER_AGENT", length = 255)
    private String userAgent;

    @Column(name = "TARGET_TABLE", length = 50)
    private String targetTable;

    @Column(name = "TARGET_ID")
    private Long targetId;

    @Lob
    @Column(name = "LOG_DETAIL")
    private String logDetail;

    @CreatedDate
    @Column(name = "CREATED_AT", updatable = false)
    private LocalDateTime createdAt;
}
