package com.rookies.sk.service;

import com.rookies.sk.entity.Member;
import com.rookies.sk.repository.MemberRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserService;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class CustomOAuth2UserService implements OAuth2UserService<OAuth2UserRequest, OAuth2User> {

    private final MemberRepository memberRepository;

    @Override
    public OAuth2User loadUser(OAuth2UserRequest userRequest) throws OAuth2AuthenticationException {
        OAuth2UserService<OAuth2UserRequest, OAuth2User> delegate = new DefaultOAuth2UserService();
        OAuth2User oAuth2User = delegate.loadUser(userRequest);

        String registrationId = userRequest.getClientRegistration().getRegistrationId();
        String userNameAttributeName = userRequest.getClientRegistration().getProviderDetails()
                .getUserInfoEndpoint().getUserNameAttributeName();

        Map<String, Object> attributes = oAuth2User.getAttributes();
        UserProfile userProfile = UserProfile.extract(registrationId, attributes);

        Member member = saveOrUpdate(userProfile);

        // 기존 속성에 우리가 생성한 이메일 정보를 추가하여 전달
        java.util.Map<String, Object> customAttributes = new java.util.HashMap<>(attributes);
        customAttributes.put("internal_email", member.getEmail());

        return new DefaultOAuth2User(
                Collections.singleton(new SimpleGrantedAuthority("ROLE_" + member.getRole().name())),
                customAttributes,
                userNameAttributeName);
    }

    private Member saveOrUpdate(UserProfile userProfile) {
        // 이메일이 없으면 oauthId 기반의 placeholder 이메일 생성
        String effectiveEmail = (userProfile.getEmail() != null) ? userProfile.getEmail() : userProfile.getOauthId() + "@placeholder.com";
        
        return memberRepository.findByEmail(effectiveEmail)
                .map(existingMember -> {
                    // 탈퇴 계정이 재가입 시도 → 계정 초기화하여 재가입 허용
                    if (existingMember.getStatus() == Member.Status.WITHDRAWN) {
                        existingMember.setRole(Member.Role.GUEST);
                        existingMember.setStatus(Member.Status.PENDING);
                        existingMember.setName(userProfile.getName());
                        existingMember.setPassword(UUID.randomUUID().toString());
                        existingMember.setIdPhotoUrl(null);
                        existingMember.setLoginFailCount(0);
                        return memberRepository.save(existingMember);
                    }
                    return existingMember;
                })
                .orElseGet(() -> {
                    Member newMember = Member.builder()
                            .email(effectiveEmail)
                            .name(userProfile.getName())
                            .role(Member.Role.GUEST)
                            .status(Member.Status.PENDING)
                            .password(UUID.randomUUID().toString())
                            .build();
                    return memberRepository.save(newMember);
                });
    }
}
