package com.rookies.sk.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.util.Date;

@Slf4j
@Component
public class JwtTokenProvider {

    // V-02: Weak Secret Key (Intentional Vulnerability)
    // Using a simple string instead of a secure random key
    private static final String SECRET_KEY = "vce_secret_key_for_educational_purpose_only_do_not_use_in_production";
    private static final long ACCESS_TOKEN_EXPIRE_TIME = 1000 * 60 * 30; // 30 mins
    private static final long REFRESH_TOKEN_EXPIRE_TIME = 1000 * 60 * 60 * 24 * 7; // 7 days

    private final Key key;

    public JwtTokenProvider() {
        // V-02: Using HS256 with a known weak secret
        this.key = Keys.hmacShaKeyFor(SECRET_KEY.getBytes(StandardCharsets.UTF_8));
    }

    public String createAccessToken(String email, String role, Long memberId) {
        return createToken(email, role, memberId, ACCESS_TOKEN_EXPIRE_TIME);
    }

    public String createRefreshToken(String email) {
        return createToken(email, null, null, REFRESH_TOKEN_EXPIRE_TIME);
    }

    private String createToken(String email, String role, Long memberId, long expireTime) {
        Claims claims = Jwts.claims().setSubject(email);
        if (role != null)
            claims.put("role", role);
        if (memberId != null)
            claims.put("memberId", memberId);

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
        return Jwts.parserBuilder().setSigningKey(key).build().parseClaimsJws(token).getBody().getSubject();
    }

    public String getRole(String token) {
        return (String) Jwts.parserBuilder().setSigningKey(key).build().parseClaimsJws(token).getBody().get("role");
    }
}
