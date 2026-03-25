package com.rookies.sk.security;

import com.rookies.sk.entity.Member;
import com.rookies.sk.repository.MemberRepository;
import com.rookies.sk.service.ActiveSessionService;
import com.rookies.sk.service.TokenBlacklistService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Collections;
import java.util.List;

@Slf4j
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtTokenProvider tokenProvider;
    private final MemberRepository memberRepository;
    private final TokenBlacklistService tokenBlacklistService;
    private final ActiveSessionService activeSessionService;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String token = resolveToken(request);
        log.info("Request URI: {}", request.getRequestURI());
        log.info("Resolved Token: {}", token != null ? "Token present" : "Token missing");

        // V-02: Weak check - just valid signature with weak key
        if (token != null && tokenProvider.validateToken(token)) {
            if (tokenBlacklistService.isRevoked(token)) {
                writeJsonError(response, HttpServletResponse.SC_UNAUTHORIZED, "TOKEN_REVOKED");
                return;
            }

            String email = tokenProvider.getEmail(token);
            String role = tokenProvider.getRole(token);

            // ACCESS 토큰인 경우 활성 세션(단일 로그인) 검증
            if ("ACCESS".equals(tokenProvider.getTokenType(token))) {
                String jti = tokenProvider.getTokenId(token);
                if (!activeSessionService.isActive(email, jti)) {
                    writeJsonError(response, HttpServletResponse.SC_UNAUTHORIZED, "DUPLICATE_LOGIN");
                    return;
                }
            }
            log.info("Token Valid. Email: {}, Role: {}", email, role);

            Member member = memberRepository.findByEmail(email).orElse(null);
            if (member == null) {
                writeJsonError(response, HttpServletResponse.SC_UNAUTHORIZED, "MEMBER_NOT_FOUND");
                return;
            }
            if (member.getStatus() == Member.Status.WITHDRAWN) {
                writeJsonError(response, HttpServletResponse.SC_FORBIDDEN, "WITHDRAWN_ACCOUNT");
                return;
            }
            if (member.getStatus() == Member.Status.AUTH_FAILED) {
                String requestURI = request.getRequestURI();
                if (!requestURI.startsWith("/api/support/inquiries") && !requestURI.equals("/api/auth/logout")) {
                    writeJsonError(response, HttpServletResponse.SC_FORBIDDEN, "AUTH_FAILED_ACCOUNT");
                    return;
                }
            }
            if (!StringUtils.hasText(role)) {
                writeJsonError(response, HttpServletResponse.SC_UNAUTHORIZED, "INVALID_TOKEN_ROLE");
                return;
            }

            // Reconstruct Authentication object from Token
            List<GrantedAuthority> authorities = Collections
                    .singletonList(new SimpleGrantedAuthority(role.startsWith("ROLE_") ? role : "ROLE_" + role));
            UserDetails userDetails = new User(email, "", authorities);
            Authentication authentication = new UsernamePasswordAuthenticationToken(userDetails, "", authorities);

            SecurityContextHolder.getContext().setAuthentication(authentication);
        } else if (token != null) {
            log.warn("Token Invalid");
        }

        filterChain.doFilter(request, response);
    }

    private String resolveToken(HttpServletRequest request) {
        String bearerToken = request.getHeader("Authorization");
        if (StringUtils.hasText(bearerToken) && bearerToken.startsWith("Bearer ")) {
            return bearerToken.substring(7);
        }
        return null;
    }

    private void writeJsonError(HttpServletResponse response, int status, String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write("{\"message\":\"" + message + "\"}");
    }
}
