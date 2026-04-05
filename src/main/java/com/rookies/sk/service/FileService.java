package com.rookies.sk.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Slf4j
@Service
public class FileService {

    private final String UPLOAD_DIR;

    private static final Set<String> ALLOWED_EXTENSIONS = Set.of("jpg", "jpeg", "png");
    private static final long MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

    // 확장자별 Magic Byte (파일 시그니처)
    private static final Map<String, byte[]> MAGIC_BYTES = Map.of(
            "jpg",  new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF},
            "jpeg", new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF},
            "png",  new byte[]{(byte) 0x89, 0x50, 0x4E, 0x47}
    );

    private final String ID_PHOTO_DIR;

    public FileService() {
        String uploadDir = System.getenv("UPLOAD_DIR");
        if (uploadDir == null || uploadDir.isEmpty()) {
            uploadDir = "./uploads";
        }
        this.UPLOAD_DIR = uploadDir.endsWith("/") ? uploadDir : uploadDir + "/";
        this.ID_PHOTO_DIR = this.UPLOAD_DIR + "id-photos/";

        new File(UPLOAD_DIR).mkdirs();
        new File(ID_PHOTO_DIR).mkdirs();
        log.info("Upload dirs ready: {}, {}", UPLOAD_DIR, ID_PHOTO_DIR);
    }

    /** 커뮤니티 첨부파일 저장 (공개 경로 /uploads/) */
    public String storeFile(MultipartFile file) {
        if (file.isEmpty()) {
            throw new RuntimeException("빈 파일은 업로드할 수 없습니다.");
        }

        if (file.getSize() > MAX_FILE_SIZE) {
            throw new RuntimeException("파일 크기는 10MB를 초과할 수 없습니다.");
        }

        String originalFilename = file.getOriginalFilename();
        if (originalFilename == null || !originalFilename.contains(".")) {
            throw new RuntimeException("파일 확장자를 확인할 수 없습니다.");
        }

        String ext = originalFilename.substring(originalFilename.lastIndexOf('.') + 1).toLowerCase();
        if (!ALLOWED_EXTENSIONS.contains(ext)) {
            throw new RuntimeException("허용되지 않는 파일 형식입니다. (허용: jpg, jpeg, png)");
        }

        try (InputStream inputStream = file.getInputStream()) {
            validateMagicBytes(inputStream, ext);
        } catch (IOException e) {
            throw new RuntimeException("파일을 읽을 수 없습니다.");
        }

        try {
            String filename = UUID.randomUUID() + "." + ext;
            Path targetLocation = Paths.get(UPLOAD_DIR + filename);
            Files.copy(file.getInputStream(), targetLocation);
            log.info("File stored: {}", filename);
            return "/uploads/" + filename;
        } catch (IOException e) {
            log.error("Failed to store file", e);
            throw new RuntimeException("파일 저장에 실패했습니다.");
        }
    }

    /** 신분증 파일 저장 (비공개 경로 /uploads/id-photos/ — 직접 URL 접근 불가) */
    public String storeIdPhoto(MultipartFile file) {
        if (file.isEmpty()) {
            throw new RuntimeException("빈 파일은 업로드할 수 없습니다.");
        }
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new RuntimeException("파일 크기는 10MB를 초과할 수 없습니다.");
        }

        String originalFilename = file.getOriginalFilename();
        if (originalFilename == null || !originalFilename.contains(".")) {
            throw new RuntimeException("파일 확장자를 확인할 수 없습니다.");
        }

        String ext = originalFilename.substring(originalFilename.lastIndexOf('.') + 1).toLowerCase();
        if (!ALLOWED_EXTENSIONS.contains(ext)) {
            throw new RuntimeException("허용되지 않는 파일 형식입니다. (허용: jpg, jpeg, png)");
        }

        try (InputStream inputStream = file.getInputStream()) {
            validateMagicBytes(inputStream, ext);
        } catch (IOException e) {
            throw new RuntimeException("파일을 읽을 수 없습니다.");
        }

        try {
            String filename = UUID.randomUUID() + "." + ext;
            Path targetLocation = Paths.get(ID_PHOTO_DIR + filename);
            Files.copy(file.getInputStream(), targetLocation);
            log.info("Id photo stored: {}", filename);
            return "id-photos/" + filename;  // /uploads/ 기준 상대경로 (웹 URL 아님)
        } catch (IOException e) {
            log.error("Failed to store id photo", e);
            throw new RuntimeException("파일 저장에 실패했습니다.");
        }
    }

    /** 신분증 파일 읽기 (FileController 전용) */
    public byte[] readIdPhoto(String filename) throws IOException {
        // 파일명은 UUID.ext 형식만 허용 (경로 탐색 방지)
        if (filename == null || filename.contains("..") || filename.contains("/") || filename.contains("\\")) {
            throw new IllegalArgumentException("잘못된 파일명");
        }
        Path filePath = Paths.get(ID_PHOTO_DIR).toAbsolutePath().normalize()
                .resolve(filename).normalize();
        if (!filePath.startsWith(Paths.get(ID_PHOTO_DIR).toAbsolutePath().normalize())) {
            throw new IllegalArgumentException("경로 탐색 차단");
        }
        return Files.readAllBytes(filePath);
    }

    private void validateMagicBytes(InputStream inputStream, String ext) {
        byte[] expected = MAGIC_BYTES.get(ext);
        if (expected == null) return;

        try {
            byte[] header = new byte[expected.length];
            int read = inputStream.read(header, 0, expected.length);
            if (read < expected.length) {
                throw new RuntimeException("파일이 너무 작습니다.");
            }
            for (int i = 0; i < expected.length; i++) {
                if (header[i] != expected[i]) {
                    throw new RuntimeException("파일 형식이 확장자와 일치하지 않습니다.");
                }
            }
        } catch (IOException e) {
            throw new RuntimeException("파일 헤더 검증 중 오류가 발생했습니다.");
        }
    }
}
