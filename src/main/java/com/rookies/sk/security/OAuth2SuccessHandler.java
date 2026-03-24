package com.rookies.sk.security;

import com.rookies.sk.entity.Member;
import com.rookies.sk.repository.MemberRepository;

import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.Cookie;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

import java.io.IOException;

@Slf4j
@Component
@RequiredArgsConstructor
public class OAuth2SuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    private final JwtTokenProvider tokenProvider;
    private final MemberRepository memberRepository;
    private final HttpCookieOAuth2AuthorizationRequestRepository httpCookieOAuth2AuthorizationRequestRepository;

    @org.springframework.beans.factory.annotation.Value("${app.frontend-url}")
    private String frontendUrl;

    @org.springframework.beans.factory.annotation.Value("${app.cors.allowed-origins}")
    private java.util.List<String> allowedOrigins;

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response,
            Authentication authentication) throws IOException, ServletException {
        OAuth2User oAuth2User = (OAuth2User) authentication.getPrincipal();

        // CustomOAuth2UserService에서 넣어준 내부 식별용 이메일 추출
        String internalEmail = (String) oAuth2User.getAttribute("internal_email");
        Member member = memberRepository.findByEmail(internalEmail)
                .orElseThrow(() -> new RuntimeException("Member not found"));

        String targetFrontendUrl = this.frontendUrl;
        if (request.getCookies() != null) {
            for (jakarta.servlet.http.Cookie cookie : request.getCookies()) {
                if (HttpCookieOAuth2AuthorizationRequestRepository.REDIRECT_URI_PARAM_COOKIE_NAME
                        .equals(cookie.getName())) {
                    try {
                        String decoded = java.net.URLDecoder.decode(cookie.getValue(), "UTF-8");
                        if (decoded.contains(",")) {
                            decoded = decoded.split(",")[0];
                        }
                        // 화이트리스트 검증: 허용된 origin으로 시작하는 경우만 사용
                        String candidate = decoded;
                        boolean allowed = allowedOrigins.stream().anyMatch(origin -> candidate.startsWith(origin));
                        if (allowed) {
                            targetFrontendUrl = candidate;
                        }
                    } catch (Exception e) {
                        // 디코딩 실패 시 기본 URL 사용
                    }
                    break;
                }
            }
        }
        if (targetFrontendUrl != null && targetFrontendUrl.contains(",")) {
            targetFrontendUrl = targetFrontendUrl.split(",")[0];
        }

        httpCookieOAuth2AuthorizationRequestRepository.removeAuthorizationRequestCookies(request, response);

        if (member.getStatus() == Member.Status.WITHDRAWN) {
            String targetUrl = UriComponentsBuilder.fromUriString(targetFrontendUrl + "/login")
                    .queryParam("error", "WITHDRAWN_ACCOUNT")
                    .build().toUriString();
            getRedirectStrategy().sendRedirect(request, response, targetUrl);
            return;
        }

        // 프론트엔드 회원가입창에 미리 채워줄 "진짜 이메일" (있을 때만)
        String socialEmail = null;
        if (oAuth2User.getAttributes().containsKey("email")) {
            socialEmail = (String) oAuth2User.getAttributes().get("email");
        } else if (oAuth2User.getAttributes().containsKey("kakao_account")) {
            var account = (java.util.Map) oAuth2User.getAttributes().get("kakao_account");
            socialEmail = (String) account.get("email");
        } else if (oAuth2User.getAttributes().containsKey("response")) {
            var resp = (java.util.Map) oAuth2User.getAttributes().get("response");
            socialEmail = (String) resp.get("email");
        }

        String accessToken = tokenProvider.createAccessToken(member.getEmail(), member.getRole().name(),
                member.getMemberId());
        String refreshToken = tokenProvider.createRefreshToken(member.getEmail());

        String targetUrl;
        if (member.getRole() == Member.Role.GUEST) {
            targetUrl = UriComponentsBuilder.fromUriString(targetFrontendUrl + "/signup/complete")
                    .queryParam("token", accessToken)
                    .queryParam("email", socialEmail != null ? socialEmail : "")
                    .build().toUriString();
        } else {
            targetUrl = UriComponentsBuilder.fromUriString(targetFrontendUrl + "/oauth/callback")
                    .queryParam("accessToken", accessToken)
                    .queryParam("refreshToken", refreshToken)
                    .build().toUriString();
        }

        getRedirectStrategy().sendRedirect(request, response, targetUrl);
    }
}
