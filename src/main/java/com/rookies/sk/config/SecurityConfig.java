package com.rookies.sk.config;

import com.rookies.sk.repository.MemberRepository;
import com.rookies.sk.security.JwtAuthenticationFilter;
import com.rookies.sk.security.JwtTokenProvider;
import com.rookies.sk.security.OAuth2SuccessHandler;
import com.rookies.sk.service.CustomOAuth2UserService;
import com.rookies.sk.service.TokenBlacklistService;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

        private final CustomOAuth2UserService customOAuth2UserService;
        private final OAuth2SuccessHandler oAuth2SuccessHandler;
        private final JwtTokenProvider jwtTokenProvider;
        private final MemberRepository memberRepository;
        private final TokenBlacklistService tokenBlacklistService;
        private final com.rookies.sk.service.ActiveSessionService activeSessionService;
        private final com.rookies.sk.security.HttpCookieOAuth2AuthorizationRequestRepository cookieAuthorizationRequestRepository;

        @org.springframework.beans.factory.annotation.Value("${app.cors.allowed-origins}")
        private List<String> allowedOrigins;

        @Bean
        public PasswordEncoder passwordEncoder() {
                return new BCryptPasswordEncoder();
        }

        @Bean
        public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
                http
                                .httpBasic(AbstractHttpConfigurer::disable)
                                .csrf(AbstractHttpConfigurer::disable)
                                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                                .headers(headers -> headers
                                                .frameOptions(frame -> frame.deny())
                                                .contentTypeOptions(ct -> {})
                                                .httpStrictTransportSecurity(hsts -> hsts
                                                                .includeSubDomains(true)
                                                                .maxAgeInSeconds(31536000))
                                                .addHeaderWriter((req, res) -> {
                                                        res.setHeader("X-Content-Type-Options", "nosniff");
                                                        res.setHeader("X-Frame-Options", "DENY");
                                                        res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
                                                        res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
                                                }))
                                .sessionManagement(session -> session
                                                .sessionCreationPolicy(SessionCreationPolicy.STATELESS)) // V-15:
                                                                                                         // Even if
                                                                                                         // stateless,
                                                                                                         // implementation
                                                                                                         // might
                                                                                                         // be
                                                                                                         // weak?
                                                                                                         // We
                                                                                                         // simulated
                                                                                                         // Session
                                                                                                         // Fixation
                                                                                                         // via
                                                                                                         // logic,
                                                                                                         // not
                                                                                                         // necessarily
                                                                                                         // here.
                                .authorizeHttpRequests(auth -> auth
                                                .requestMatchers(HttpMethod.TRACE, "/**").denyAll()
                                                // 관리자 API: 실제 사용하지 않는 취약 메소드 차단
                                                .requestMatchers(HttpMethod.HEAD, "/api/admin/**").denyAll()
                                                .requestMatchers(HttpMethod.PUT, "/api/admin/**").denyAll()
                                                .requestMatchers(HttpMethod.HEAD, "/api/auth/admin/**").denyAll()
                                                // 인증 필요 엔드포인트 (permitAll 규칙보다 먼저 배치)
                                                .requestMatchers(HttpMethod.PUT, "/api/auth/me").authenticated()
                                                .requestMatchers(HttpMethod.PATCH, "/api/auth/me").authenticated()
                                                .requestMatchers(HttpMethod.PUT, "/api/community/comments/**").authenticated()
                                                .requestMatchers(HttpMethod.DELETE, "/api/community/comments/**").authenticated()
                                                .requestMatchers(HttpMethod.PUT, "/api/community/posts/**").authenticated()
                                                .requestMatchers(HttpMethod.DELETE, "/api/community/posts/**").authenticated()
                                                .requestMatchers("/api/auth/me", "/api/auth/me/**", "/api/auth/withdraw",
                                                                "/api/auth/logout")
                                                .authenticated()
                                                .requestMatchers("/", "/login/**", "/oauth2/**", "/api/auth/**",
                                                                "/error", "/uploads/**")
                                                .permitAll()
                                                .requestMatchers(HttpMethod.GET, "/api/community/posts/**").permitAll()
                                                .requestMatchers(HttpMethod.GET, "/api/news").permitAll()
                                                .requestMatchers(HttpMethod.GET, "/api/market/**").permitAll()
                                                .requestMatchers(HttpMethod.GET, "/api/support/faqs").permitAll()
                                                .requestMatchers("/api/auth/signup/complete").hasRole("GUEST")
                                                .requestMatchers("/api/files/id-photo/**")
                                                .hasAnyRole("VCESYS_CORE", "VCESYS_MGMT", "VCESYS_EMP")
                                                .requestMatchers("/api/admin/**")
                                                .hasAnyRole("VCESYS_CORE", "VCESYS_MGMT", "VCESYS_EMP")
                                                .anyRequest().authenticated())
                                .oauth2Login(oauth2 -> oauth2
                                                .authorizationEndpoint(auth -> auth
                                                                .authorizationRequestRepository(
                                                                                cookieAuthorizationRequestRepository))
                                                .userInfoEndpoint(userInfo -> userInfo
                                                                .userService(customOAuth2UserService))
                                                .successHandler(oAuth2SuccessHandler))
                                .addFilterBefore(
                                                new JwtAuthenticationFilter(jwtTokenProvider, memberRepository,
                                                                tokenBlacklistService, activeSessionService),
                                                UsernamePasswordAuthenticationFilter.class)
                                .exceptionHandling(exception -> exception
                                                .defaultAuthenticationEntryPointFor(
                                                                new org.springframework.security.web.authentication.HttpStatusEntryPoint(
                                                                                org.springframework.http.HttpStatus.UNAUTHORIZED),
                                                                new org.springframework.security.web.util.matcher.AntPathRequestMatcher(
                                                                                "/api/**")));

                return http.build();
        }

        @Bean
        public CorsConfigurationSource corsConfigurationSource() {
                CorsConfiguration configuration = new CorsConfiguration();
                // Externalized CORS Origins
                configuration.setAllowedOriginPatterns(allowedOrigins);
                configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
                configuration.setAllowedHeaders(List.of("*"));
                configuration.setAllowCredentials(true);

                UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
                source.registerCorsConfiguration("/**", configuration);
                return source;
        }
}
