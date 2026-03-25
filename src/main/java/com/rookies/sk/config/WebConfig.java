package com.rookies.sk.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        String uploadDir = System.getenv("UPLOAD_DIR");
        if (uploadDir == null || uploadDir.isEmpty()) {
            uploadDir = "./uploads";
        }
        if (!uploadDir.endsWith("/")) {
            uploadDir = uploadDir + "/";
        }
        // 커뮤니티 첨부파일 공개 서빙 (신분증은 /api/files/id-photo/** 인증 엔드포인트 사용)
        registry.addResourceHandler("/uploads/**")
                .addResourceLocations("file:" + uploadDir);
    }
}
