package com.rookies.sk.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Spring Security 6의 CSRF 지연 로딩(deferred) 문제 해결 필터.
 *
 * CookieCsrfTokenRepository는 CsrfToken.getToken()이 실제로 호출될 때만
 * XSRF-TOKEN 쿠키를 응답에 기록한다. 이 필터는 모든 요청에서 토큰을
 * 강제 로드하여 SPA(React)가 쿠키를 읽고 X-XSRF-TOKEN 헤더로 전송할
 * 수 있도록 보장한다.
 */
public class CsrfCookieFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        CsrfToken csrfToken = (CsrfToken) request.getAttribute(CsrfToken.class.getName());
        if (csrfToken != null) {
            // 지연 로드를 강제 실행 → XSRF-TOKEN 쿠키가 응답에 포함됨
            csrfToken.getToken();
        }
        filterChain.doFilter(request, response);
    }
}
