package com.rookies.sk.controller;

import com.rookies.sk.dto.AdminAssetReclaimRequestDto;
import com.rookies.sk.service.AdminService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;
import jakarta.servlet.http.HttpServletRequest;

import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;

import java.nio.file.Path;
import java.nio.file.Paths;
import java.io.File;
import java.nio.file.Files;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final AdminService adminService;

    @GetMapping("/members")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<List<Map<String, Object>>> getAllMembers() {
        return ResponseEntity.ok(adminService.getAllMembers());
    }

    @GetMapping("/members/search")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<Map<String, Object>> searchMembers(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String role,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(adminService.searchMembers(q, role, status, page, size));
    }

    @GetMapping("/members/{memberId}/unmask")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> getUnmaskedMemberInfo(
            @PathVariable Long memberId,
            HttpServletRequest request) {
        return ResponseEntity.ok(adminService.getUnmaskedMemberInfo(memberId, request));
    }

    @GetMapping("/members/{memberId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'STAFF')")
    public ResponseEntity<Map<String, Object>> getMemberDetails(@PathVariable Long memberId) {
        return ResponseEntity.ok(adminService.getMemberDetails(memberId));
    }

    @PatchMapping("/members/{memberId}/status")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> updateMemberStatus(
            @PathVariable Long memberId,
            @RequestBody Map<String, String> body) {
        String status = body.get("status");
        return ResponseEntity.ok(adminService.updateMemberStatus(memberId, status));
    }

    @PatchMapping("/members/{memberId}/approve-id")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<Map<String, Object>> approveMemberIdentity(@PathVariable Long memberId) {
        return ResponseEntity.ok(adminService.approveMemberIdentity(memberId));
    }

    @PatchMapping("/members/{memberId}/assets/reclaim")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> reclaimMemberAsset(
            @PathVariable Long memberId,
            @RequestBody AdminAssetReclaimRequestDto body) {
        return ResponseEntity.ok(
                adminService.reclaimMemberAsset(
                        memberId,
                        body.getAssetType(),
                        body.getAmount(),
                        body.getReason()));
    }

    @GetMapping("/orders")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<List<Map<String, Object>>> getAllOrders() {
        return ResponseEntity.ok(adminService.getAllOrders());
    }

    @GetMapping("/assets")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<List<Map<String, Object>>> getAllAssets() {
        return ResponseEntity.ok(adminService.getAllAssets());
    }

    @GetMapping("/transactions")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<List<Map<String, Object>>> getAllTransactions() {
        return ResponseEntity.ok(adminService.getAllTransactions());
    }

    @GetMapping("/stats")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'STAFF')")
    public ResponseEntity<Map<String, Object>> getStats() {
        return ResponseEntity.ok(adminService.getStats());
    }

    @GetMapping("/transactions/search")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<Map<String, Object>> searchTransactions(
            @RequestParam(required = false) String memberEmail,
            @RequestParam(required = false) String assetType,
            @RequestParam(required = false) String txType,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(
                adminService.searchTransactions(
                        memberEmail,
                        assetType,
                        txType,
                        from,
                        to,
                        page,
                        size));
    }

    @GetMapping("/inquiries")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'STAFF')")
    public ResponseEntity<List<Map<String, Object>>> getAllInquiries() {
        return ResponseEntity.ok(adminService.getAllInquiries());
    }

    @PatchMapping("/inquiries/{inquiryId}/reply")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'STAFF')")
    public ResponseEntity<Map<String, Object>> replyToInquiry(
            @PathVariable Long inquiryId,
            @RequestBody Map<String, String> body) {
        String status = body.getOrDefault("status", "ANSWERED");
        String reply = body.get("reply");
        return ResponseEntity.ok(adminService.replyToInquiry(inquiryId, status, reply));
    }

    // ── 직원(Staff) 관리 ──────────────────────────────────────────────

    @GetMapping("/staff")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<Map<String, Object>>> getStaffMembers() {
        return ResponseEntity.ok(adminService.getStaffMembers());
    }

    @PostMapping("/staff")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> createStaffMember(
            @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(adminService.createStaffMember(
                body.get("email"),
                body.get("password"),
                body.get("name"),
                body.get("role")));
    }

    @DeleteMapping("/staff/{memberId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> deleteStaffMember(
            @PathVariable Long memberId) {
        return ResponseEntity.ok(adminService.deleteStaffMember(memberId));
    }

    // [VULNERABILITY] Path Traversal / LFI
    // filePath 파라미터에 대한 시큐어 코딩(검증 및 상위 디렉터리 접근 제한)이 누락되어 있습니다.
    // 이는 공격자가 임의의 시스템 파일에 접근하게 돕는 의도적 취약점 코드입니다.
    @GetMapping("/files/download")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<Resource> downloadFile(@RequestParam String filePath) {
        try {
            Path path;
            // /uploads/ 경로는 실제 업로드 디렉터리(UPLOAD_DIR)로 매핑
            if (filePath.startsWith("/uploads/")) {
                String uploadDir = System.getenv("UPLOAD_DIR");
                if (uploadDir == null || uploadDir.isEmpty()) {
                    uploadDir = "./uploads";
                }
                String filename = filePath.substring("/uploads/".length());
                path = Paths.get(uploadDir).toAbsolutePath().normalize().resolve(filename);
            } else {
                // V-PATH-TRAVERSAL: 검증 없이 사용자 입력을 그대로 사용 (의도적 취약점)
                path = Paths.get(filePath);
            }
            Resource resource = new UrlResource(path.toUri());

            if (resource.exists() || resource.isReadable()) {
                String contentType = Files.probeContentType(path);
                if (contentType == null) {
                    contentType = "application/octet-stream";
                }

                File file = path.toFile();
                return ResponseEntity.ok()
                        .contentType(MediaType.parseMediaType(contentType))
                        .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + file.getName() + "\"")
                        .body(resource);
            } else {
                return ResponseEntity.notFound().build();
            }
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }
}
