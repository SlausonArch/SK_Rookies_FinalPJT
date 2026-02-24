package com.rookies.sk.controller;

import com.rookies.sk.service.AdminService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final AdminService adminService;

    @GetMapping("/members")
    public ResponseEntity<List<Map<String, Object>>> getAllMembers() {
        return ResponseEntity.ok(adminService.getAllMembers());
    }

    @GetMapping("/members/search")
    public ResponseEntity<Map<String, Object>> searchMembers(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String role,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return ResponseEntity.ok(adminService.searchMembers(q, role, status, page, size));
    }

    @PatchMapping("/members/{memberId}/status")
    public ResponseEntity<Map<String, Object>> updateMemberStatus(
            @PathVariable Long memberId,
            @RequestBody Map<String, String> body) {
        String status = body.get("status");
        return ResponseEntity.ok(adminService.updateMemberStatus(memberId, status));
    }

    @PatchMapping("/members/{memberId}/approve-id")
    public ResponseEntity<Map<String, Object>> approveMemberIdentity(@PathVariable Long memberId) {
        return ResponseEntity.ok(adminService.approveMemberIdentity(memberId));
    }

    @GetMapping("/orders")
    public ResponseEntity<List<Map<String, Object>>> getAllOrders() {
        return ResponseEntity.ok(adminService.getAllOrders());
    }

    @GetMapping("/assets")
    public ResponseEntity<List<Map<String, Object>>> getAllAssets() {
        return ResponseEntity.ok(adminService.getAllAssets());
    }

    @GetMapping("/transactions")
    public ResponseEntity<List<Map<String, Object>>> getAllTransactions() {
        return ResponseEntity.ok(adminService.getAllTransactions());
    }

    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getStats() {
        return ResponseEntity.ok(adminService.getStats());
    }

    @GetMapping("/transactions/search")
    public ResponseEntity<Map<String, Object>> searchTransactions(
            @RequestParam(required = false) String memberEmail,
            @RequestParam(required = false) String assetType,
            @RequestParam(required = false) String txType,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return ResponseEntity.ok(
                adminService.searchTransactions(
                        memberEmail,
                        assetType,
                        txType,
                        from,
                        to,
                        page,
                        size
                )
    );}
    @GetMapping("/inquiries")
    public ResponseEntity<List<Map<String, Object>>> getAllInquiries() {
        return ResponseEntity.ok(adminService.getAllInquiries());
    }

    @PatchMapping("/inquiries/{inquiryId}/reply")
    public ResponseEntity<Map<String, Object>> replyToInquiry(
            @PathVariable Long inquiryId,
            @RequestBody Map<String, String> body) {
        String status = body.getOrDefault("status", "ANSWERED");
        String reply = body.get("reply");
        return ResponseEntity.ok(adminService.replyToInquiry(inquiryId, status, reply));
    }
}
