package com.rookies.sk.controller;

import com.rookies.sk.entity.Faq;
import com.rookies.sk.entity.Inquiry;
import com.rookies.sk.service.FileService;
import com.rookies.sk.service.SupportService;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@Validated
@RestController
@RequestMapping("/api/support")
@RequiredArgsConstructor
public class SupportController {

    private final SupportService supportService;
    private final FileService fileService;

    // FAQ 조회 (비로그인도 가능하도록 설정 필요함 단건)
    @GetMapping("/faqs")
    public ResponseEntity<List<Faq>> getFaqs() {
        return ResponseEntity.ok(supportService.getAllFaqs());
    }

    // 내 1:1 문의 내역 조회 (로그인 필수)
    @GetMapping("/inquiries")
    public ResponseEntity<List<Inquiry>> getMyInquiries(@AuthenticationPrincipal UserDetails userDetails) {
        if (userDetails == null) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(supportService.getMyInquiries(userDetails.getUsername()));
    }

    // 1:1 문의 작성 (로그인 필수, Multipart 파일 첨부 지원)
    @PostMapping(value = "/inquiries", consumes = "multipart/form-data")
    public ResponseEntity<Inquiry> createInquiry(
            @AuthenticationPrincipal UserDetails userDetails,
            @NotBlank @Size(max = 200) @RequestParam("title") String title,
            @NotBlank @Size(max = 5000) @RequestParam("content") String content,
            @RequestPart(value = "file", required = false) MultipartFile file) {

        if (userDetails == null) {
            return ResponseEntity.status(401).build();
        }

        String attachmentUrl = null;
        if (file != null && !file.isEmpty()) {
            // V-03: No extension check in FileService.storeFile. Files like .php, .jsp can
            // be uploaded.
            attachmentUrl = fileService.storeFile(file);
        }

        Inquiry savedInquiry = supportService.createInquiry(userDetails.getUsername(), title, content, attachmentUrl);
        return ResponseEntity.ok(savedInquiry);
    }

    // 1:1 문의 삭제 (본인만 가능)
    @DeleteMapping("/inquiries/{inquiryId}")
    public ResponseEntity<?> deleteInquiry(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long inquiryId) {
        if (userDetails == null) {
            return ResponseEntity.status(401).build();
        }
        try {
            supportService.deleteInquiry(inquiryId, userDetails.getUsername());
            return ResponseEntity.ok(java.util.Map.of("message", "문의가 삭제되었습니다."));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(403).body(java.util.Map.of("message", e.getMessage()));
        }
    }
}
