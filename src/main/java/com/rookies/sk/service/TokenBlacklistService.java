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

    @Transactional
    public void revokeTokens(String accessToken, String refreshToken, String reason) {
        revokeToken(accessToken, reason);
        revokeToken(refreshToken, reason);
        revokedTokenRepository.deleteByExpiresAtBefore(LocalDateTime.now());
    }
}
