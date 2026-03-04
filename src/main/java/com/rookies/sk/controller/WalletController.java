package com.rookies.sk.controller;

import com.rookies.sk.service.WalletService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.Map;

@RestController
@RequestMapping("/api/wallets")
@RequiredArgsConstructor
public class WalletController {

    private final WalletService walletService;

    @GetMapping("/{assetType}/address")
    public ResponseEntity<?> getDepositAddress(
            @PathVariable String assetType,
            @AuthenticationPrincipal UserDetails userDetails) {
        String address = walletService.getOrCreateDepositAddress(userDetails.getUsername(), assetType);
        return ResponseEntity.ok(Map.of("address", address));
    }

    @PostMapping("/transfer")
    public ResponseEntity<?> transfer(
            @RequestBody TransferRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        try {
            walletService.internalTransfer(
                    userDetails.getUsername(),
                    request.getAssetType(),
                    request.getToAddress(),
                    request.getAmount(),
                    request.getCurrentPrice());
            return ResponseEntity.ok(Map.of("message", "이체가 성공적으로 완료되었습니다."));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @Data
    public static class TransferRequest {
        private String assetType;
        private String toAddress;
        private BigDecimal amount;
        private BigDecimal currentPrice;
    }
}
