package com.rookies.sk.config;

import com.rookies.sk.repository.MemberRepository;
import com.rookies.sk.security.JwtAuthenticationFilter;
import com.rookies.sk.security.JwtTokenProvider;
import com.rookies.sk.security.OAuth2SuccessHandler;
import com.rookies.sk.service.CustomOAuth2UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
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
@RequiredArgsConstructor
public class SecurityConfig {

        private final CustomOAuth2UserService customOAuth2UserService;
        private final OAuth2SuccessHandler oAuth2SuccessHandler;
        private final JwtTokenProvider jwtTokenProvider;
        private final MemberRepository memberRepository;
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
                                .csrf(AbstractHttpConfigurer::disable) // Disable CSRF for REST API
                                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
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
                                                .requestMatchers("/api/auth/me/**", "/api/auth/withdraw")
                                                .authenticated()
                                                .requestMatchers("/", "/login/**", "/oauth2/**", "/api/auth/**",
                                                                "/error", "/uploads/**")
                                                .permitAll()
                                                .requestMatchers(HttpMethod.GET, "/api/community/posts/**").permitAll()
                                                .requestMatchers(HttpMethod.GET, "/api/news").permitAll()
                                                .requestMatchers(HttpMethod.GET, "/api/market/**").permitAll()
                                                .requestMatchers(HttpMethod.GET, "/api/support/faqs").permitAll()
                                                .requestMatchers("/api/auth/signup/complete").hasRole("GUEST") // Need
                                                                                                               // Guest
                                                                                                               // role
                                                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                                                .anyRequest().authenticated())
                                .oauth2Login(oauth2 -> oauth2
                                                .authorizationEndpoint(auth -> auth
                                                                .authorizationRequestRepository(
                                                                                cookieAuthorizationRequestRepository))
                                                .userInfoEndpoint(userInfo -> userInfo
                                                                .userService(customOAuth2UserService))
                                                .successHandler(oAuth2SuccessHandler))
                                .addFilterBefore(new JwtAuthenticationFilter(jwtTokenProvider, memberRepository),
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
