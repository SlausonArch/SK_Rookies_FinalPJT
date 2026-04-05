package com.rookies.sk.controller;

import com.rookies.sk.service.FileService;
import lombok.RequiredArgsConstructor;
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

@Slf4j
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/files")
public class FileController {

    private final FileService fileService;

    @GetMapping("/id-photo/{filename}")
    @PreAuthorize("hasAnyRole('VCESYS_CORE','VCESYS_MGMT','VCESYS_EMP')")
    public ResponseEntity<byte[]> getIdPhoto(@PathVariable String filename) {
        // UUID.확장자 형식만 허용 (경로 탐색 방지)
        if (!filename.matches("^[0-9a-fA-F\\-]{36}\\.(jpg|jpeg|png)$")) {
            return ResponseEntity.badRequest().build();
        }

        try {
            byte[] content = fileService.readIdPhoto(filename);
            String ext = filename.substring(filename.lastIndexOf('.') + 1).toLowerCase();
            MediaType mediaType = ext.equals("png") ? MediaType.IMAGE_PNG : MediaType.IMAGE_JPEG;

            return ResponseEntity.ok()
                    .contentType(mediaType)
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                    .header("X-Content-Type-Options", "nosniff")
                    .header("Cache-Control", "no-store")
                    .body(content);

        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        } catch (IOException e) {
            log.error("Failed to serve id photo: {}", filename, e);
            return ResponseEntity.notFound().build();
        }
    }
}
