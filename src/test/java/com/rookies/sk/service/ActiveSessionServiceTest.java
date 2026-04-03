package com.rookies.sk.service;

import com.rookies.sk.entity.ActiveSession;
import com.rookies.sk.repository.ActiveSessionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ActiveSessionServiceTest {

    @Mock
    private TokenBlacklistService tokenBlacklistService;

    @Mock
    private ActiveSessionRepository activeSessionRepository;

    private ActiveSessionService activeSessionService;
    private Map<String, ActiveSession> store;

    @BeforeEach
    void setUp() {
        activeSessionService = new ActiveSessionService(tokenBlacklistService, activeSessionRepository);
        store = new HashMap<>();

        when(activeSessionRepository.findById(anyString()))
                .thenAnswer(invocation -> Optional.ofNullable(store.get(invocation.getArgument(0))));
        when(activeSessionRepository.save(any(ActiveSession.class)))
                .thenAnswer(invocation -> {
                    ActiveSession session = invocation.getArgument(0);
                    store.put(session.getSessionKey(), session);
                    return session;
                });
        lenient().doAnswer(invocation -> {
            store.remove(invocation.getArgument(0));
            return null;
        }).when(activeSessionRepository).deleteById(anyString());
        lenient().doAnswer(invocation -> {
            String email = invocation.getArgument(0);
            store.values().removeIf(session -> session.getMemberEmail().equalsIgnoreCase(email));
            return null;
        }).when(activeSessionRepository).deleteByMemberEmailIgnoreCase(anyString());
    }

    @Test
    void keepsUserAndAdminSessionsSeparateForSameEmail() {
        LocalDateTime expiresAt = LocalDateTime.now().plusMinutes(30);

        activeSessionService.activate("staff@vce.com", "USER", "user-jti", expiresAt);
        activeSessionService.activate("staff@vce.com", "ADMIN", "admin-jti", expiresAt);

        assertTrue(activeSessionService.isActive("staff@vce.com", "USER", "user-jti"));
        assertTrue(activeSessionService.isActive("staff@vce.com", "ADMIN", "admin-jti"));
        verify(tokenBlacklistService, never()).revokeByJti(anyString(), anyString(), any(), anyString());
    }

    @Test
    void replacesOnlySameScopeSession() {
        LocalDateTime expiresAt = LocalDateTime.now().plusMinutes(30);

        activeSessionService.activate("staff@vce.com", "USER", "old-user-jti", expiresAt);
        activeSessionService.activate("staff@vce.com", "USER", "new-user-jti", expiresAt.plusMinutes(5));

        assertTrue(activeSessionService.isActive("staff@vce.com", "USER", "new-user-jti"));
        verify(tokenBlacklistService).revokeByJti("old-user-jti", "staff@vce.com", expiresAt, "NEW_LOGIN");
    }
}
