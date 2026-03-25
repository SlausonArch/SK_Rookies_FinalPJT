package com.rookies.sk.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 사용자당 하나의 활성 세션(Access Token JTI)만 허용.
 * 새 로그인 시:
 *   1. 이전 JTI를 RevokedToken DB에 블랙리스트 등록 (서버 재시작 후에도 무효)
 *   2. 새 JTI를 in-memory 맵에 등록 (빠른 검증용)
 */
@Component
@RequiredArgsConstructor
public class ActiveSessionService {

    private final TokenBlacklistService tokenBlacklistService;

    private record SessionEntry(String jti, LocalDateTime expiresAt) {}

    private final ConcurrentHashMap<String, SessionEntry> activeSessions = new ConcurrentHashMap<>();

    /** 로그인/토큰 발급 시 활성 JTI 등록. 이전 JTI는 즉시 블랙리스트 처리. */
    public void activate(String email, String jti, LocalDateTime expiresAt) {
        if (email == null || jti == null) return;
        SessionEntry old = activeSessions.put(email, new SessionEntry(jti, expiresAt));
        if (old != null && !old.jti().equals(jti)) {
            tokenBlacklistService.revokeByJti(old.jti(), email, old.expiresAt(), "NEW_LOGIN");
        }
    }

    /** 필터에서 토큰이 현재 활성 세션인지 확인 */
    public boolean isActive(String email, String jti) {
        if (email == null || jti == null) return false;
        SessionEntry entry = activeSessions.get(email);
        return entry != null && jti.equals(entry.jti());
    }

    /** 로그아웃/탈퇴 시 세션 제거 */
    public void invalidate(String email) {
        if (email != null) {
            activeSessions.remove(email);
        }
    }
}
