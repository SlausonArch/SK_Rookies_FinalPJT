package com.rookies.sk.controller;

import com.rookies.sk.dto.OrderRequestDto;
import com.rookies.sk.dto.OrderResponseDto;
import com.rookies.sk.service.OrderService;
import lombok.RequiredArgsConstructor;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
public class OrderController {

    private final OrderService orderService;

    @PostMapping
    public ResponseEntity<OrderResponseDto> createOrder(
            @Valid @RequestBody OrderRequestDto request,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(orderService.createOrder(userDetails.getUsername(), request));
    }

    @GetMapping
    public ResponseEntity<List<OrderResponseDto>> getOrders(
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(orderService.getOrders(userDetails.getUsername()));
    }

    @GetMapping("/open")
    public ResponseEntity<List<OrderResponseDto>> getOpenOrders(
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(orderService.getOpenOrders(userDetails.getUsername()));
    }

    @DeleteMapping("/{orderId}")
    public ResponseEntity<OrderResponseDto> cancelOrder(
            @PathVariable Long orderId,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(orderService.cancelOrder(userDetails.getUsername(), orderId));
    }
}
