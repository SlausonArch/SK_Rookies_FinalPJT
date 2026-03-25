package com.rookies.sk.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {
    // /uploads/** 정적 서빙 제거 - /api/files/id-photo/{filename} 인증 엔드포인트로 대체
}
