package com.rookies.sk.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.time.Instant;
import java.util.Date;
import java.util.Iterator;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class SignupTokenStore {

    private static final long TTL_SECONDS = 300;
    private static final String PURPOSE = "SIGNUP_CODE";

    private record Entry(String accessToken, String email, Instant expiresAt) {}

    private final Map<String, Entry> legacyStore = new ConcurrentHashMap<>();
    private final Key key;

    public SignupTokenStore(@Value("${jwt.secret}") String secretKey) {
        this.key = Keys.hmacShaKeyFor(secretKey.getBytes(StandardCharsets.UTF_8));
    }

    public String store(String accessToken, String email) {
        evictExpired();

        Date now = new Date();
        Date expiresAt = new Date(now.getTime() + (TTL_SECONDS * 1000));

        // Keep a short-lived legacy in-memory copy so already-issued codes from the same instance continue to work.
        String legacyCode = UUID.randomUUID().toString().replace("-", "");
        legacyStore.put(legacyCode, new Entry(accessToken, email, Instant.ofEpochMilli(expiresAt.getTime())));

        return Jwts.builder()
                .claim("purpose", PURPOSE)
                .claim("accessToken", accessToken)
                .claim("email", email)
                .setIssuedAt(now)
                .setExpiration(expiresAt)
                .signWith(key, SignatureAlgorithm.HS256)
                .compact();
    }

    public record TokenInfo(String accessToken, String email) {}

    public TokenInfo consume(String code) {
        TokenInfo legacy = consumeLegacy(code);
        if (legacy != null) {
            return legacy;
        }

        try {
            Claims claims = Jwts.parserBuilder()
                    .setSigningKey(key)
                    .build()
                    .parseClaimsJws(code)
                    .getBody();

            if (!PURPOSE.equals(claims.get("purpose", String.class))) {
                return null;
            }

            String accessToken = claims.get("accessToken", String.class);
            String email = claims.get("email", String.class);
            if (accessToken == null || accessToken.isBlank()) {
                return null;
            }

            return new TokenInfo(accessToken, email != null ? email : "");
        } catch (Exception e) {
            return null;
        }
    }

    private TokenInfo consumeLegacy(String code) {
        Entry entry = legacyStore.get(code);
        if (entry == null) {
            return null;
        }
        if (Instant.now().isAfter(entry.expiresAt())) {
            legacyStore.remove(code);
            return null;
        }
        return new TokenInfo(entry.accessToken(), entry.email());
    }

    private void evictExpired() {
        Instant now = Instant.now();
        Iterator<Map.Entry<String, Entry>> it = legacyStore.entrySet().iterator();
        while (it.hasNext()) {
            if (now.isAfter(it.next().getValue().expiresAt())) {
                it.remove();
            }
        }
    }
}
