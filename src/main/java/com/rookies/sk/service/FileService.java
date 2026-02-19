package com.rookies.sk.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.UUID;

@Slf4j
@Service
public class FileService {

    private final String UPLOAD_DIR;

    public FileService() {
        // Docker 환경에서는 /app/uploads, 로컬 개발 환경에서는 ./uploads
        String uploadDir = System.getenv("UPLOAD_DIR");
        if (uploadDir == null || uploadDir.isEmpty()) {
            uploadDir = "./uploads";
        }
        this.UPLOAD_DIR = uploadDir.endsWith("/") ? uploadDir : uploadDir + "/";
        
        // 디렉토리가 없으면 생성
        File directory = new File(UPLOAD_DIR);
        if (!directory.exists()) {
            directory.mkdirs();
            log.info("Created upload directory: {}", UPLOAD_DIR);
        }
    }

    public String storeFile(MultipartFile file) {
        try {
            if (file.isEmpty()) {
                throw new RuntimeException("Failed to store empty file.");
            }

            // V-03: No extension validation. WebShell (.php, .jsp) allowed.
            String originalFilename = file.getOriginalFilename();
            // V-03: Filename might not be randomized enough, or we might return the
            // original name.
            // For this scenario, let's keep original extension but randomize name to avoid
            // collision,
            // BUT return the full path which is dangerous.

            String filename = UUID.randomUUID() + "_" + originalFilename;
            Path targetLocation = Paths.get(UPLOAD_DIR + filename);

            Files.copy(file.getInputStream(), targetLocation);
            
            log.info("File stored successfully: {}", filename);

            // V-03: Return absolute path or relative path that might be accessible
            return "/uploads/" + filename;

        } catch (IOException e) {
            log.error("Failed to store file: {}", file.getOriginalFilename(), e);
            throw new RuntimeException("Failed to store file " + file.getOriginalFilename(), e);
        }
    }
}
