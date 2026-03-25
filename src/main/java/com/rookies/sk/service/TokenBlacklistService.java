package com.rookies.sk.service;

import com.rookies.sk.entity.RevokedToken;
import com.rookies.sk.repository.RevokedTokenRepository;
import com.rookies.sk.security.JwtTokenProvider;
import io.jsonwebtoken.JwtException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.time.ZoneId;

@Service
@RequiredArgsConstructor
public class TokenBlacklistService {

    private final RevokedTokenRepository revokedTokenRepository;
    private final JwtTokenProvider jwtTokenProvider;

    @Transactional(readOnly = true)
    public boolean isRevoked(String token) {
        if (!StringUtils.hasText(token)) {
            return false;
        }

        try {
            String tokenId = jwtTokenProvider.getTokenId(token);
            return StringUtils.hasText(tokenId) && revokedTokenRepository.existsById(tokenId);
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }

    @Transactional
    public void revokeToken(String token, String reason) {
        if (!StringUtils.hasText(token) || !jwtTokenProvider.validateToken(token)) {
            return;
        }

        String tokenId = jwtTokenProvider.getTokenId(token);
        if (!StringUtils.hasText(tokenId) || revokedTokenRepository.existsById(tokenId)) {
            return;
        }

        revokedTokenRepository.save(RevokedToken.builder()
                .tokenId(tokenId)
                .memberEmail(jwtTokenProvider.getEmail(token))
                .tokenType(jwtTokenProvider.getTokenType(token))
                .revokedReason(reason)
                .expiresAt(jwtTokenProvider.getExpiration(token).toInstant().atZone(ZoneId.systemDefault()).toLocalDateTime())
                .revokedAt(LocalDateTime.now())
                .build());
    }

    /** 토큰 문자열 없이 JTI만으로 블랙리스트 등록 (새 로그인 시 이전 토큰 무효화용) */
    @Transactional
    public void revokeByJti(String jti, String email, LocalDateTime expiresAt, String reason) {
        if (!StringUtils.hasText(jti) || !StringUtils.hasText(email)) return;
        if (revokedTokenRepository.existsById(jti)) return;
        revokedTokenRepository.save(RevokedToken.builder()
                .tokenId(jti)
                .memberEmail(email)
                .tokenType("ACCESS")
                .revokedReason(reason)
                .expiresAt(expiresAt)
                .revokedAt(LocalDateTime.now())
                .build());
    }

    @Transactional
    public void revokeTokens(String accessToken, String refreshToken, String reason) {
        revokeToken(accessToken, reason);
        revokeToken(refreshToken, reason);
        revokedTokenRepository.deleteByExpiresAtBefore(LocalDateTime.now());
    }
}
