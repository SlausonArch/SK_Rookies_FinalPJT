package com.rookies.sk.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.io.File;
import java.nio.file.Path;
import java.nio.file.Paths;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // /uploads/** 경로로 들어오는 요청을 uploads/ 폴더와 연결
        // Docker 환경과 로컬 환경 모두 지원
        
        // Docker에서는 /app/uploads, 로컬에서는 ./uploads
        String uploadDir = System.getenv("UPLOAD_DIR");
        if (uploadDir == null || uploadDir.isEmpty()) {
            // 로컬 개발 환경: ./uploads 사용
            uploadDir = "./uploads";
        }
        
        // 절대 경로로 변환
        Path uploadPath = Paths.get(uploadDir).toAbsolutePath().normalize();
        String uploadPathUri = uploadPath.toUri().toString();

        registry.addResourceHandler("/uploads/**")
                .addResourceLocations(uploadPathUri);
    }
}
