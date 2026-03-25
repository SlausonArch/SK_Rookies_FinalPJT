package com.rookies.sk.controller;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

@Slf4j
@RestController
@RequestMapping("/api/files")
public class FileController {

    private final String UPLOAD_DIR;

    public FileController() {
        String uploadDir = System.getenv("UPLOAD_DIR");
        if (uploadDir == null || uploadDir.isEmpty()) {
            uploadDir = "./uploads";
        }
        this.UPLOAD_DIR = uploadDir.endsWith("/") ? uploadDir : uploadDir + "/";
    }

    @GetMapping("/id-photo/{filename}")
    @PreAuthorize("hasAnyRole('VCESYS_CORE','VCESYS_MGMT','VCESYS_EMP')")
    public ResponseEntity<byte[]> getIdPhoto(@PathVariable String filename) {
        // 파일명 검증: 경로 탐색 방지 (슬래시, 역슬래시, 점 두 개 금지)
        if (filename == null || filename.contains("..") || filename.contains("/") || filename.contains("\\")) {
            return ResponseEntity.badRequest().build();
        }

        // UUID.확장자 형식만 허용
        if (!filename.matches("^[0-9a-fA-F\\-]{36}\\.(jpg|jpeg|png)$")) {
            return ResponseEntity.badRequest().build();
        }

        try {
            Path filePath = Paths.get(UPLOAD_DIR).toAbsolutePath().normalize()
                    .resolve(filename).normalize();

            // 업로드 디렉터리 밖으로 나가는지 검증
            if (!filePath.startsWith(Paths.get(UPLOAD_DIR).toAbsolutePath().normalize())) {
                return ResponseEntity.badRequest().build();
            }

            if (!Files.exists(filePath)) {
                return ResponseEntity.notFound().build();
            }

            byte[] content = Files.readAllBytes(filePath);
            String ext = filename.substring(filename.lastIndexOf('.') + 1).toLowerCase();
            MediaType mediaType = ext.equals("png") ? MediaType.IMAGE_PNG : MediaType.IMAGE_JPEG;

            return ResponseEntity.ok()
                    .contentType(mediaType)
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                    .header("X-Content-Type-Options", "nosniff")
                    .header("Cache-Control", "no-store")
                    .body(content);

        } catch (IOException e) {
            log.error("Failed to serve file: {}", filename, e);
            return ResponseEntity.internalServerError().build();
        }
    }
}
