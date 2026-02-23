package com.rookies.sk.security;

import com.rookies.sk.entity.Member;
import com.rookies.sk.repository.MemberRepository;

import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
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

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response,
            Authentication authentication) throws IOException, ServletException {
        OAuth2User oAuth2User = (OAuth2User) authentication.getPrincipal();

        // CustomOAuth2UserService에서 넣어준 내부 식별용 이메일 추출
        String internalEmail = (String) oAuth2User.getAttribute("internal_email");
        Member member = memberRepository.findByEmail(internalEmail)
                .orElseThrow(() -> new RuntimeException("Member not found"));

        if (member.getStatus() == Member.Status.LOCKED) {
            String targetUrl = UriComponentsBuilder.fromUriString("http://localhost:5173/login")
                    .queryParam("error", "LOCKED_ACCOUNT")
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
            targetUrl = UriComponentsBuilder.fromUriString("http://localhost:5173/signup/complete")
                    .queryParam("token", accessToken)
                    .queryParam("email", socialEmail != null ? socialEmail : "") 
                    .build().toUriString();
        } else {
            targetUrl = UriComponentsBuilder.fromUriString("http://localhost:5173/oauth/callback")
                    .queryParam("accessToken", accessToken)
                    .queryParam("refreshToken", refreshToken)
                    .build().toUriString();
        }

        getRedirectStrategy().sendRedirect(request, response, targetUrl);
    }
}
