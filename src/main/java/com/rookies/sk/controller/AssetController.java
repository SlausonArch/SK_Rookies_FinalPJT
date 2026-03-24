package com.rookies.sk.controller;

import com.rookies.sk.dto.AssetResponseDto;
import com.rookies.sk.dto.AssetSummaryDto;
import com.rookies.sk.dto.DepositRequestDto;
import com.rookies.sk.service.AssetService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/assets")
@RequiredArgsConstructor
public class AssetController {

    private final AssetService assetService;

    @GetMapping
    public ResponseEntity<List<AssetResponseDto>> getAssets(
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(assetService.getAssets(userDetails.getUsername()));
    }

    @GetMapping("/summary")
    public ResponseEntity<AssetSummaryDto> getAssetSummary(
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(assetService.getAssetSummary(userDetails.getUsername()));
    }

    @GetMapping("/{assetType}")
    public ResponseEntity<AssetResponseDto> getAsset(
            @PathVariable String assetType,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(assetService.getAsset(userDetails.getUsername(), assetType));
    }

    @PostMapping("/deposit")
    public ResponseEntity<AssetResponseDto> deposit(
            @RequestBody DepositRequestDto request,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(assetService.deposit(userDetails.getUsername(), request));
    }

    @PostMapping("/withdraw")
    public ResponseEntity<AssetResponseDto> withdraw(
            @RequestBody DepositRequestDto request,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(assetService.withdraw(userDetails.getUsername(), request));
    }

    @GetMapping("/bank-balance")
    public ResponseEntity<Map<String, BigDecimal>> getBankBalance(
            @AuthenticationPrincipal UserDetails userDetails) {
        BigDecimal balance = assetService.getBankBalance(userDetails.getUsername());
        return ResponseEntity.ok(Map.of("bankBalance", balance));
    }
}
