package com.rookies.sk.security;

public enum SessionScope {
    USER,
    ADMIN;

    public static SessionScope from(String value) {
        if (ADMIN.name().equalsIgnoreCase(value)) {
            return ADMIN;
        }
        return USER;
    }

    public static SessionScope normalize(SessionScope value) {
        return value != null ? value : USER;
    }
}
