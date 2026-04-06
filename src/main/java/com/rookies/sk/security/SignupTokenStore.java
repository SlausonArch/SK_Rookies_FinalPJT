package com.rookies.sk.security;

import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Iterator;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class SignupTokenStore {

    private static final long TTL_SECONDS = 300; // 5분

    private record Entry(String accessToken, String email, Instant expiresAt) {}

    private final Map<String, Entry> store = new ConcurrentHashMap<>();

    public String store(String accessToken, String email) {
        evictExpired();
        String code = UUID.randomUUID().toString().replace("-", "");
        store.put(code, new Entry(accessToken, email, Instant.now().plusSeconds(TTL_SECONDS)));
        return code;
    }

    public record TokenInfo(String accessToken, String email) {}

    public TokenInfo consume(String code) {
        Entry entry = store.get(code);
        if (entry == null) {
            return null;
        }
        if (Instant.now().isAfter(entry.expiresAt())) {
            store.remove(code);
            return null;
        }
        return new TokenInfo(entry.accessToken(), entry.email());
    }

    private void evictExpired() {
        Instant now = Instant.now();
        Iterator<Map.Entry<String, Entry>> it = store.entrySet().iterator();
        while (it.hasNext()) {
            if (now.isAfter(it.next().getValue().expiresAt())) {
                it.remove();
            }
        }
    }
}
