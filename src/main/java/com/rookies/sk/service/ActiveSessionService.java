package com.rookies.sk.service;

import com.rookies.sk.entity.ActiveSession;
import com.rookies.sk.repository.ActiveSessionRepository;
import com.rookies.sk.security.SessionScope;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class ActiveSessionService {

    private final TokenBlacklistService tokenBlacklistService;
    private final ActiveSessionRepository activeSessionRepository;

    @Transactional
    public void activate(String email, String sessionScope, String jti, LocalDateTime expiresAt) {
        if (!StringUtils.hasText(email) || !StringUtils.hasText(jti) || expiresAt == null) {
            return;
        }

        String normalizedEmail = normalizeEmail(email);
        String normalizedScope = SessionScope.from(sessionScope).name();
        String sessionKey = buildSessionKey(normalizedEmail, normalizedScope);

        ActiveSession old = activeSessionRepository.findById(sessionKey).orElse(null);
        if (old != null && !jti.equals(old.getTokenId())) {
            tokenBlacklistService.revokeByJti(old.getTokenId(), normalizedEmail, old.getExpiresAt(), "NEW_LOGIN");
        }

        activeSessionRepository.save(ActiveSession.builder()
                .sessionKey(sessionKey)
                .memberEmail(normalizedEmail)
                .sessionScope(normalizedScope)
                .tokenId(jti)
                .expiresAt(expiresAt)
                .updatedAt(LocalDateTime.now())
                .build());
        activeSessionRepository.deleteByExpiresAtBefore(LocalDateTime.now());
    }

    @Transactional(readOnly = true)
    public boolean isActive(String email, String sessionScope, String jti) {
        if (!StringUtils.hasText(email) || !StringUtils.hasText(jti)) {
            return false;
        }

        ActiveSession entry = activeSessionRepository.findById(
                buildSessionKey(normalizeEmail(email), SessionScope.from(sessionScope).name()))
                .orElse(null);
        return entry != null
                && !entry.getExpiresAt().isBefore(LocalDateTime.now())
                && jti.equals(entry.getTokenId());
    }

    @Transactional
    public void invalidate(String email, String sessionScope) {
        if (!StringUtils.hasText(email)) {
            return;
        }
        activeSessionRepository.deleteById(
                buildSessionKey(normalizeEmail(email), SessionScope.from(sessionScope).name()));
    }

    @Transactional
    public void invalidateAll(String email) {
        if (!StringUtils.hasText(email)) {
            return;
        }
        activeSessionRepository.deleteByMemberEmailIgnoreCase(normalizeEmail(email));
    }

    private String buildSessionKey(String email, String sessionScope) {
        return sessionScope + ":" + email;
    }

    private String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }
}
