package com.rookies.sk.security;

public enum SessionScope {
    USER,       // 레거시 — EXCHANGE 와 동일하게 취급
    ADMIN,
    EXCHANGE,
    BANK;

    public static SessionScope from(String value) {
        if (ADMIN.name().equalsIgnoreCase(value)) return ADMIN;
        if (BANK.name().equalsIgnoreCase(value)) return BANK;
        if (EXCHANGE.name().equalsIgnoreCase(value)) return EXCHANGE;
        return EXCHANGE; // USER 또는 미지정 → EXCHANGE (레거시 호환)
    }

    public static SessionScope normalize(SessionScope value) {
        return value != null ? value : EXCHANGE;
    }
}
