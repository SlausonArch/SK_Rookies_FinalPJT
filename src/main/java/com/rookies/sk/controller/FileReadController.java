package com.rookies.sk.controller;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

@Slf4j
@RestController
@RequestMapping("/api/files")
public class FileReadController {

    /**
     * 개인정보처리방침을 정적 리소스로 제공 (Path Traversal V-04 수정)
     * 동적 path 파라미터 제거 → 고정된 classpath 리소스만 반환
     */
    @GetMapping("/privacy-policy")
    public ResponseEntity<String> getPrivacyPolicy() {
        try {
            InputStream is = getClass().getResourceAsStream("/static/docs/privacy_policy.md");
            if (is == null) {
                return ResponseEntity.status(404).body("개인정보처리방침 문서를 찾을 수 없습니다.");
            }
            String content = new String(is.readAllBytes(), StandardCharsets.UTF_8);
            return ResponseEntity.ok()
                    .contentType(MediaType.TEXT_PLAIN)
                    .body(content);
        } catch (IOException e) {
            log.warn("개인정보처리방침 읽기 실패: {}", e.getMessage());
            return ResponseEntity.status(500).body("문서를 불러오는 데 실패했습니다.");
        }
    }
}
