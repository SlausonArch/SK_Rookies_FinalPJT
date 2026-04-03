package com.rookies.sk.security;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.security.oauth2.client.web.AuthorizationRequestRepository;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;

@Slf4j
@Component
public class HttpCookieOAuth2AuthorizationRequestRepository
        implements AuthorizationRequestRepository<OAuth2AuthorizationRequest> {

    public static final String OAUTH2_AUTHORIZATION_REQUEST_COOKIE_NAME = "oauth2_auth_request";
    public static final String REDIRECT_URI_PARAM_COOKIE_NAME = "frontend_url";
    private static final int COOKIE_EXPIRE_SECONDS = 180;

    private final ObjectMapper objectMapper;
    private final String hmacSecret;
    private final String cookieDomain;

    public HttpCookieOAuth2AuthorizationRequestRepository(
            ObjectMapper objectMapper,
            @Value("${jwt.secret}") String jwtSecret,
            @Value("${app.cookie-domain:}") String cookieDomain) {
        this.objectMapper = objectMapper;
        // JWT Secret을 HMAC 키로 재사용
        this.hmacSecret = jwtSecret;
        this.cookieDomain = cookieDomain;
    }

    @Override
    public OAuth2AuthorizationRequest loadAuthorizationRequest(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies != null) {
            for (Cookie cookie : cookies) {
                if (OAUTH2_AUTHORIZATION_REQUEST_COOKIE_NAME.equals(cookie.getName())) {
                    return deserialize(cookie.getValue());
                }
            }
        }
        return null;
    }

    @Override
    public void saveAuthorizationRequest(OAuth2AuthorizationRequest authorizationRequest, HttpServletRequest request,
            HttpServletResponse response) {
        if (authorizationRequest == null) {
            removeAuthorizationRequestCookies(request, response);
            return;
        }

        addCookie(request, response, OAUTH2_AUTHORIZATION_REQUEST_COOKIE_NAME, serialize(authorizationRequest),
                COOKIE_EXPIRE_SECONDS);
        String redirectUriAfterLogin = request.getParameter(REDIRECT_URI_PARAM_COOKIE_NAME);
        if (redirectUriAfterLogin != null && !redirectUriAfterLogin.isBlank()) {
            addCookie(request, response, REDIRECT_URI_PARAM_COOKIE_NAME, redirectUriAfterLogin, COOKIE_EXPIRE_SECONDS);
        }
    }

    @Override
    public OAuth2AuthorizationRequest removeAuthorizationRequest(HttpServletRequest request,
            HttpServletResponse response) {
        return this.loadAuthorizationRequest(request);
    }

    public void removeAuthorizationRequestCookies(HttpServletRequest request, HttpServletResponse response) {
        deleteCookie(request, response, OAUTH2_AUTHORIZATION_REQUEST_COOKIE_NAME);
        deleteCookie(request, response, REDIRECT_URI_PARAM_COOKIE_NAME);
    }

    private void addCookie(HttpServletRequest request, HttpServletResponse response, String name, String value, int maxAge) {
        response.addHeader(HttpHeaders.SET_COOKIE, buildCookie(request, name, value, maxAge).toString());
    }

    private void deleteCookie(HttpServletRequest request, HttpServletResponse response, String name) {
        Cookie[] cookies = request.getCookies();
        if (cookies != null) {
            for (Cookie cookie : cookies) {
                if (cookie.getName().equals(name)) {
                    response.addHeader(HttpHeaders.SET_COOKIE, buildCookie(request, name, "", 0).toString());
                }
            }
        }
    }

    private ResponseCookie buildCookie(HttpServletRequest request, String name, String value, int maxAge) {
        ResponseCookie.ResponseCookieBuilder builder = ResponseCookie.from(name, value)
                .path("/")
                .httpOnly(true)
                .maxAge(maxAge)
                .sameSite("Lax")
                .secure(request.isSecure());

        String resolvedCookieDomain = resolveCookieDomain(request);
        if (StringUtils.hasText(resolvedCookieDomain)) {
            builder.domain(resolvedCookieDomain);
        }

        return builder.build();
    }

    private String resolveCookieDomain(HttpServletRequest request) {
        if (StringUtils.hasText(cookieDomain)) {
            return cookieDomain;
        }

        String host = request.getServerName();
        if (!StringUtils.hasText(host)) {
            return null;
        }

        String normalizedHost = host.toLowerCase();
        if ("vceapp.com".equals(normalizedHost) || normalizedHost.endsWith(".vceapp.com")) {
            return ".vceapp.com";
        }

        return null;
    }

    /**
     * OAuth2AuthorizationRequest를 JSON으로 직렬화 후 HMAC-SHA256 서명 추가
     * 형식: Base64(JSON).Base64(HMAC)
     */
    private String serialize(OAuth2AuthorizationRequest request) {
        try {
            Map<String, Object> data = new HashMap<>();
            data.put("authorizationUri", request.getAuthorizationUri());
            data.put("clientId", request.getClientId());
            data.put("redirectUri", request.getRedirectUri());
            data.put("state", request.getState());
            data.put("scopes", request.getScopes());
            data.put("grantType", request.getGrantType().getValue());
            data.put("additionalParameters", request.getAdditionalParameters());
            data.put("attributes", request.getAttributes());

            String json = objectMapper.writeValueAsString(data);
            String encodedJson = Base64.getUrlEncoder().encodeToString(json.getBytes(StandardCharsets.UTF_8));
            String signature = computeHmac(encodedJson);
            return encodedJson + "." + signature;
        } catch (Exception e) {
            throw new RuntimeException("OAuth2 request serialization failed", e);
        }
    }

    /**
     * HMAC 서명 검증 후 역직렬화
     */
    private OAuth2AuthorizationRequest deserialize(String value) {
        try {
            String[] parts = value.split("\\.", 2);
            if (parts.length != 2) {
                log.warn("Invalid OAuth2 cookie format");
                return null;
            }
            String encodedJson = parts[0];
            String signature = parts[1];

            // 서명 검증
            String expectedSignature = computeHmac(encodedJson);
            if (!expectedSignature.equals(signature)) {
                log.warn("OAuth2 cookie signature mismatch - possible tampering detected");
                return null;
            }

            String json = new String(Base64.getUrlDecoder().decode(encodedJson), StandardCharsets.UTF_8);
            Map<String, Object> data = objectMapper.readValue(json, new TypeReference<>() {});

            @SuppressWarnings("unchecked")
            java.util.Set<String> scopes = new java.util.LinkedHashSet<>(
                    (java.util.List<String>) data.getOrDefault("scopes", java.util.List.of()));
            @SuppressWarnings("unchecked")
            Map<String, Object> additionalParams = (Map<String, Object>) data.getOrDefault("additionalParameters", Map.of());
            @SuppressWarnings("unchecked")
            Map<String, Object> attributes = (Map<String, Object>) data.getOrDefault("attributes", Map.of());

            return OAuth2AuthorizationRequest.authorizationCode()
                    .authorizationUri((String) data.get("authorizationUri"))
                    .clientId((String) data.get("clientId"))
                    .redirectUri((String) data.get("redirectUri"))
                    .state((String) data.get("state"))
                    .scopes(scopes)
                    .additionalParameters(additionalParams)
                    .attributes(attributes)
                    .build();
        } catch (Exception e) {
            log.warn("OAuth2 cookie deserialization failed: {}", e.getMessage());
            return null;
        }
    }

    private String computeHmac(String data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            SecretKeySpec keySpec = new SecretKeySpec(
                    hmacSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
            mac.init(keySpec);
            byte[] hash = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(hash);
        } catch (Exception e) {
            throw new RuntimeException("HMAC computation failed", e);
        }
    }
}
