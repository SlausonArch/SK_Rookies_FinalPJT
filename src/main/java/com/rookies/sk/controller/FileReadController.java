package com.rookies.sk.controller;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

@Slf4j
@RestController
@RequestMapping("/api/files")
public class FileReadController {

    // 서버 문서 기본 디렉토리 (개인정보처리방침 등 공개 문서 저장 위치)
    private static final String DOCS_BASE_DIR = "./docs/";

    /**
     * V-04 (Path Traversal / File Inclusion):
     * path 파라미터를 검증 없이 파일 경로에 직접 사용
     *
     * 정상 사용: GET /api/files?path=privacy_policy.md
     * 공격 예시: GET /api/files?path=../uploads/<파일명>
     *           GET /api/files?path=system_architecture_analysis.md  (민감 문서 접근)
     *           GET /api/files?path=../../etc/passwd                  (시스템 파일 접근)
     */
    @GetMapping(produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> readFile(@RequestParam String path) {
        log.info("파일 읽기 요청: path={}", path);

        try {
            // V-04: 경로 정규화(normalize) 또는 검증 없이 사용자 입력을 그대로 resolve
            Path filePath = Paths.get(DOCS_BASE_DIR).resolve(path);
            log.info("실제 파일 경로: {}", filePath.toAbsolutePath());

            String content = Files.readString(filePath);
            return ResponseEntity.ok(content);
        } catch (IOException e) {
            log.warn("파일 읽기 실패: path={}, error={}", path, e.getMessage());
            return ResponseEntity.status(404).body("파일을 찾을 수 없습니다: " + path);
        }
    }
}
