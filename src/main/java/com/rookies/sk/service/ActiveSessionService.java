package com.rookies.sk.service;

import org.springframework.stereotype.Component;

import java.util.concurrent.ConcurrentHashMap;

/**
 * 사용자당 하나의 활성 세션(Access Token JTI)만 허용.
 * 새 로그인 시 이전 토큰의 JTI를 덮어써서 중복 로그인을 차단합니다.
 */
@Component
public class ActiveSessionService {

    private final ConcurrentHashMap<String, String> activeSessions = new ConcurrentHashMap<>();

    /** 로그인/토큰 발급 시 활성 JTI 등록 */
    public void activate(String email, String jti) {
        if (email != null && jti != null) {
            activeSessions.put(email, jti);
        }
    }

    /** 필터에서 토큰이 현재 활성 세션인지 확인 */
    public boolean isActive(String email, String jti) {
        if (email == null || jti == null) return false;
        return jti.equals(activeSessions.get(email));
    }

    /** 로그아웃/탈퇴 시 세션 제거 */
    public void invalidate(String email) {
        if (email != null) {
            activeSessions.remove(email);
        }
    }
}
