package com.rookies.sk.service;

import lombok.Builder;
import lombok.Getter;

import java.util.Map;

@Getter
@Builder
public class UserProfile {
    private final String oauthId;
    private final String name;
    private final String email;
    private final String imageUrl;

    public static UserProfile extract(String registrationId, Map<String, Object> attributes) {
        if ("naver".equals(registrationId)) {
            Map<String, Object> response = (Map<String, Object>) attributes.get("response");
            return UserProfile.builder()
                    .oauthId((String) response.get("id"))
                    .name((String) response.get("name"))
                    .email((String) response.get("email"))
                    .imageUrl((String) response.get("profile_image"))
                    .build();
        } else if ("kakao".equals(registrationId)) {
            Map<String, Object> kakaoAccount = (Map<String, Object>) attributes.get("kakao_account");
            String email = (kakaoAccount != null) ? (String) kakaoAccount.get("email") : null;
            
            Map<String, Object> profile = (kakaoAccount != null) ? (Map<String, Object>) kakaoAccount.get("profile") : null;
            String name = (profile != null) ? (String) profile.get("nickname") : "KakaoUser";
            String imageUrl = (profile != null) ? (String) profile.get("profile_image_url") : null;

            return UserProfile.builder()
                    .oauthId(String.valueOf(attributes.get("id")))
                    .name(name)
                    .email(email)
                    .imageUrl(imageUrl)
                    .build();
        }
        throw new IllegalArgumentException("Unknown OAuth2 Provider");
    }
}
