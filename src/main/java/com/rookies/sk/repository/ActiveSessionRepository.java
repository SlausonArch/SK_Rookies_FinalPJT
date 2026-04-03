package com.rookies.sk.repository;

import com.rookies.sk.entity.ActiveSession;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;

public interface ActiveSessionRepository extends JpaRepository<ActiveSession, String> {

    void deleteByExpiresAtBefore(LocalDateTime cutoff);

    void deleteByMemberEmailIgnoreCase(String memberEmail);
}
