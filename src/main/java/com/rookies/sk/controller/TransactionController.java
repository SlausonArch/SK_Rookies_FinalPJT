package com.rookies.sk.controller;

import com.rookies.sk.dto.TransactionResponseDto;
import com.rookies.sk.service.TransactionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/transactions")
@RequiredArgsConstructor
public class TransactionController {

    private final TransactionService transactionService;

    @GetMapping
    public ResponseEntity<List<TransactionResponseDto>> getTransactions(
            @RequestParam(required = false) String assetType,
            @AuthenticationPrincipal UserDetails userDetails) {
        if (assetType != null && !assetType.isBlank()) {
            return ResponseEntity.ok(transactionService.getTransactionsByAsset(
                    userDetails.getUsername(), assetType));
        }
        return ResponseEntity.ok(transactionService.getTransactions(userDetails.getUsername()));
    }
}
