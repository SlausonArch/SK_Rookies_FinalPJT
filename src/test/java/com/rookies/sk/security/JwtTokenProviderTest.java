package com.rookies.sk.security;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.util.Date;

import static org.junit.jupiter.api.Assertions.assertEquals;

class JwtTokenProviderTest {

    private static final String SECRET = "test-secret-key-test-secret-key-test-secret-key";

    private final JwtTokenProvider jwtTokenProvider = new JwtTokenProvider(SECRET);

    @Test
    void createsAdminScopedAccessToken() {
        String token = jwtTokenProvider.createAccessToken(
                "staff@vce.com",
                "VCESYS_EMP",
                41L,
                "Staff",
                SessionScope.ADMIN);

        assertEquals("ACCESS", jwtTokenProvider.getTokenType(token));
        assertEquals(SessionScope.ADMIN, jwtTokenProvider.getSessionScopeValue(token));
    }

    @Test
    void defaultsLegacyTokensToUserScope() {
        Key key = Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8));
        Date now = new Date();
        String legacyToken = Jwts.builder()
                .setSubject("legacy@vce.com")
                .claim("role", "USER")
                .claim("memberId", 1L)
                .claim("tokenType", "ACCESS")
                .claim("jti", "legacy-jti")
                .setIssuedAt(now)
                .setExpiration(new Date(now.getTime() + 60_000))
                .signWith(key, SignatureAlgorithm.HS256)
                .compact();

        assertEquals(SessionScope.USER, jwtTokenProvider.getSessionScopeValue(legacyToken));
    }
}
