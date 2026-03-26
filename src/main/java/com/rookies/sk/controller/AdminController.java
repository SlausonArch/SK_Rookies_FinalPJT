package com.rookies.sk.controller;

import com.rookies.sk.dto.AdminAssetReclaimRequestDto;
import com.rookies.sk.service.AdminService;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;
import jakarta.servlet.http.HttpServletRequest;

import java.util.List;
import java.util.Map;

@Validated
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final AdminService adminService;

    @GetMapping("/members")
    @PreAuthorize("hasAnyRole('VCESYS_CORE', 'VCESYS_MGMT')")
    public ResponseEntity<List<Map<String, Object>>> getAllMembers() {
        return ResponseEntity.ok(adminService.getAllMembers());
    }

    @GetMapping("/members/search")
    @PreAuthorize("hasAnyRole('VCESYS_CORE', 'VCESYS_MGMT')")
    public ResponseEntity<Map<String, Object>> searchMembers(
            @RequestParam(required = false) @Size(max = 100) @Pattern(regexp = "^[^'\"\\-;=()/*]*$", message = "검색어에 허용되지 않는 문자가 포함되어 있습니다.") String q,
            @RequestParam(required = false) String role,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(adminService.searchMembers(q, role, status, page, size));
    }

    @GetMapping("/members/{memberId}/unmask")
    @PreAuthorize("hasRole('VCESYS_CORE')")
    public ResponseEntity<Map<String, Object>> getUnmaskedMemberInfo(
            @PathVariable Long memberId,
            HttpServletRequest request) {
        return ResponseEntity.ok(adminService.getUnmaskedMemberInfo(memberId, request));
    }

    @GetMapping("/members/{memberId}")
    @PreAuthorize("hasAnyRole('VCESYS_CORE', 'VCESYS_MGMT', 'VCESYS_EMP')")
    public ResponseEntity<Map<String, Object>> getMemberDetails(@PathVariable Long memberId) {
        return ResponseEntity.ok(adminService.getMemberDetails(memberId));
    }

    @PatchMapping("/members/{memberId}/status")
    @PreAuthorize("hasRole('VCESYS_CORE')")
    public ResponseEntity<Map<String, Object>> updateMemberStatus(
            @PathVariable Long memberId,
            @RequestBody Map<String, String> body) {
        String status = body.get("status");
        return ResponseEntity.ok(adminService.updateMemberStatus(memberId, status));
    }

    @PatchMapping("/members/{memberId}/approve-id")
    @PreAuthorize("hasAnyRole('VCESYS_CORE', 'VCESYS_MGMT')")
    public ResponseEntity<Map<String, Object>> approveMemberIdentity(@PathVariable Long memberId) {
        return ResponseEntity.ok(adminService.approveMemberIdentity(memberId));
    }

    @PatchMapping("/members/{memberId}/assets/reclaim")
    @PreAuthorize("hasRole('VCESYS_CORE')")
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
    @PreAuthorize("hasAnyRole('VCESYS_CORE', 'VCESYS_MGMT')")
    public ResponseEntity<List<Map<String, Object>>> getAllOrders() {
        return ResponseEntity.ok(adminService.getAllOrders());
    }

    @GetMapping("/assets")
    @PreAuthorize("hasAnyRole('VCESYS_CORE', 'VCESYS_MGMT')")
    public ResponseEntity<List<Map<String, Object>>> getAllAssets() {
        return ResponseEntity.ok(adminService.getAllAssets());
    }

    @GetMapping("/transactions")
    @PreAuthorize("hasAnyRole('VCESYS_CORE', 'VCESYS_MGMT')")
    public ResponseEntity<List<Map<String, Object>>> getAllTransactions() {
        return ResponseEntity.ok(adminService.getAllTransactions());
    }

    @GetMapping("/stats")
    @PreAuthorize("hasAnyRole('VCESYS_CORE', 'VCESYS_MGMT', 'VCESYS_EMP')")
    public ResponseEntity<Map<String, Object>> getStats() {
        return ResponseEntity.ok(adminService.getStats());
    }

    @GetMapping("/transactions/search")
    @PreAuthorize("hasAnyRole('VCESYS_CORE', 'VCESYS_MGMT')")
    public ResponseEntity<Map<String, Object>> searchTransactions(
            @RequestParam(required = false) @Size(max = 200) @Pattern(regexp = "^[^'\"\\-;=()/*]*$", message = "검색어에 허용되지 않는 문자가 포함되어 있습니다.") String memberEmail,
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
    @PreAuthorize("hasAnyRole('VCESYS_CORE', 'VCESYS_MGMT', 'VCESYS_EMP')")
    public ResponseEntity<List<Map<String, Object>>> getAllInquiries() {
        return ResponseEntity.ok(adminService.getAllInquiries());
    }

    @PatchMapping("/inquiries/{inquiryId}/reply")
    @PreAuthorize("hasAnyRole('VCESYS_CORE', 'VCESYS_MGMT', 'VCESYS_EMP')")
    public ResponseEntity<Map<String, Object>> replyToInquiry(
            @PathVariable Long inquiryId,
            @RequestBody Map<String, String> body) {
        String status = body.getOrDefault("status", "ANSWERED");
        String reply = body.get("reply");
        return ResponseEntity.ok(adminService.replyToInquiry(inquiryId, status, reply));
    }

    // ── 직원(Staff) 관리 ──────────────────────────────────────────────

    @GetMapping("/staff")
    @PreAuthorize("hasRole('VCESYS_CORE')")
    public ResponseEntity<List<Map<String, Object>>> getStaffMembers() {
        return ResponseEntity.ok(adminService.getStaffMembers());
    }

    @PostMapping("/staff")
    @PreAuthorize("hasRole('VCESYS_CORE')")
    public ResponseEntity<Map<String, Object>> createStaffMember(
            @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(adminService.createStaffMember(
                body.get("email"),
                body.get("password"),
                body.get("name"),
                body.get("role")));
    }

    @DeleteMapping("/staff/{memberId}")
    @PreAuthorize("hasRole('VCESYS_CORE')")
    public ResponseEntity<Map<String, Object>> deleteStaffMember(
            @PathVariable Long memberId) {
        return ResponseEntity.ok(adminService.deleteStaffMember(memberId));
    }

}
