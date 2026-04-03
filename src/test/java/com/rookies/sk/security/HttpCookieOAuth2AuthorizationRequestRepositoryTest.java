package com.rookies.sk.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;

import static org.junit.jupiter.api.Assertions.assertTrue;

class HttpCookieOAuth2AuthorizationRequestRepositoryTest {

    private static final String SECRET = "test-secret-key-test-secret-key-test-secret-key";

    @Test
    void sharesOauthCookiesAcrossSubdomainsWhenCookieDomainConfigured() {
        HttpCookieOAuth2AuthorizationRequestRepository repository =
                new HttpCookieOAuth2AuthorizationRequestRepository(new ObjectMapper(), SECRET, ".vceapp.com");

        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/oauth2/authorization/naver");
        request.setSecure(true);
        request.addParameter("frontend_url", "https://bank.vceapp.com");

        MockHttpServletResponse response = new MockHttpServletResponse();
        repository.saveAuthorizationRequest(createAuthorizationRequest(), request, response);

        String setCookieHeader = response.getHeaders("Set-Cookie").get(0);
        String frontendCookieHeader = response.getHeaders("Set-Cookie").get(1);

        assertTrue(setCookieHeader.contains("Domain=.vceapp.com"));
        assertTrue(setCookieHeader.contains("Secure"));
        assertTrue(frontendCookieHeader.contains("Domain=.vceapp.com"));
    }

    @Test
    void derivesRootCookieDomainForVceSubdomains() {
        HttpCookieOAuth2AuthorizationRequestRepository repository =
                new HttpCookieOAuth2AuthorizationRequestRepository(new ObjectMapper(), SECRET, "");

        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/oauth2/authorization/naver");
        request.setServerName("bank.vceapp.com");
        request.setSecure(true);
        MockHttpServletResponse response = new MockHttpServletResponse();

        repository.saveAuthorizationRequest(createAuthorizationRequest(), request, response);

        String setCookieHeader = response.getHeaders("Set-Cookie").get(0);
        assertTrue(setCookieHeader.contains("Domain=.vceapp.com"));
    }

    @Test
    void leavesCookieDomainUnsetWhenNotConfigured() {
        HttpCookieOAuth2AuthorizationRequestRepository repository =
                new HttpCookieOAuth2AuthorizationRequestRepository(new ObjectMapper(), SECRET, "");

        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/oauth2/authorization/naver");
        request.setServerName("localhost");
        MockHttpServletResponse response = new MockHttpServletResponse();
        repository.saveAuthorizationRequest(createAuthorizationRequest(), request, response);

        String setCookieHeader = response.getHeaders("Set-Cookie").get(0);
        assertTrue(!setCookieHeader.contains("Domain="));
    }

    private OAuth2AuthorizationRequest createAuthorizationRequest() {
        return OAuth2AuthorizationRequest.authorizationCode()
                .authorizationUri("https://nid.naver.com/oauth2.0/authorize")
                .clientId("naver-client")
                .redirectUri("https://vceapp.com/login/oauth2/code/naver")
                .state("state")
                .scope("email", "name")
                .attributes(java.util.Map.of("registration_id", "naver"))
                .build();
    }
}
