package com.rookies.sk.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Date;
import java.util.UUID;

@Slf4j
@Component
public class JwtTokenProvider {

    private static final long ACCESS_TOKEN_EXPIRE_TIME = 1000 * 60 * 30; // 30 mins
    private static final long REFRESH_TOKEN_EXPIRE_TIME = 1000 * 60 * 60 * 24 * 7; // 7 days

    private final Key key;

    public JwtTokenProvider(@Value("${jwt.secret}") String secretKey) {
        this.key = Keys.hmacShaKeyFor(secretKey.getBytes(StandardCharsets.UTF_8));
    }

    public String createAccessToken(String email, String role, Long memberId) {
        return createToken(email, role, memberId, null, "ACCESS", ACCESS_TOKEN_EXPIRE_TIME);
    }

    public String createAccessToken(String email, String role, Long memberId, String name) {
        return createToken(email, role, memberId, name, "ACCESS", ACCESS_TOKEN_EXPIRE_TIME);
    }

    public String createRefreshToken(String email) {
        return createToken(email, null, null, null, "REFRESH", REFRESH_TOKEN_EXPIRE_TIME);
    }

    private String createToken(String email, String role, Long memberId, String name, String tokenType, long expireTime) {
        Claims claims = Jwts.claims().setSubject(email);
        if (role != null)
            claims.put("role", role);
        if (memberId != null)
            claims.put("memberId", memberId);
        if (name != null)
            claims.put("name", name);
        claims.put("tokenType", tokenType);
        claims.put("jti", UUID.randomUUID().toString());

        Date now = new Date();
        Date validity = new Date(now.getTime() + expireTime);

        // V-15: Session Fixation (No JTI or unique identifier that changes on login)
        return Jwts.builder()
                .setClaims(claims)
                .setIssuedAt(now)
                .setExpiration(validity)
                .signWith(key, SignatureAlgorithm.HS256)
                .compact();
    }

    public boolean validateToken(String token) {
        try {
            Jws<Claims> claims = Jwts.parserBuilder().setSigningKey(key).build().parseClaimsJws(token);
            return !claims.getBody().getExpiration().before(new Date());
        } catch (JwtException | IllegalArgumentException e) {
            log.error("Invalid JWT token: {}", e.getMessage());
            return false;
        }
    }

    public String getEmail(String token) {
        return parseClaims(token).getSubject();
    }

    public String getRole(String token) {
        return (String) parseClaims(token).get("role");
    }

    public String getTokenId(String token) {
        Claims claims = parseClaims(token);
        Object tokenId = claims.get("jti");
        if (tokenId instanceof String value && !value.isBlank()) {
            return value;
        }
        return sha256(token);
    }

    public Date getExpiration(String token) {
        return parseClaims(token).getExpiration();
    }

    public String getTokenType(String token) {
        Claims claims = parseClaims(token);
        Object tokenType = claims.get("tokenType");
        if (tokenType instanceof String value && !value.isBlank()) {
            return value;
        }

        Object role = claims.get("role");
        return role instanceof String && !((String) role).isBlank() ? "ACCESS" : "REFRESH";
    }

    private Claims parseClaims(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(key)
                .build()
                .parseClaimsJws(token)
                .getBody();
    }

    private String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder builder = new StringBuilder(hash.length * 2);
            for (byte b : hash) {
                builder.append(String.format("%02x", b));
            }
            return builder.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }
}
