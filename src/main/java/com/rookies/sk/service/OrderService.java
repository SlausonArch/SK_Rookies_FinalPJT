package com.rookies.sk.service;

import com.rookies.sk.dto.OrderRequestDto;
import com.rookies.sk.dto.OrderResponseDto;
import com.rookies.sk.entity.*;
import com.rookies.sk.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class OrderService {

    private final OrderRepository orderRepository;
    private final AssetRepository assetRepository;
    private final TransactionRepository transactionRepository;
    private final FeeTierRepository feeTierRepository;
    private final MemberRepository memberRepository;
    private final AssetService assetService;

    @Transactional
    public OrderResponseDto createOrder(String email, OrderRequestDto req) {
        Member member = memberRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("회원을 찾을 수 없습니다."));

        String assetType = req.getAssetType().toUpperCase();
        String orderType = req.getOrderType().toUpperCase();
        BigDecimal price = req.getPrice();
        BigDecimal amount = req.getAmount();

        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new RuntimeException("주문 수량은 0보다 커야 합니다.");
        }
        if (price == null || price.compareTo(BigDecimal.ZERO) <= 0) {
            throw new RuntimeException("주문 가격은 0보다 커야 합니다.");
        }

        BigDecimal totalValue = price.multiply(amount);
        BigDecimal feeRate = getMemberFeeRate(member);
        BigDecimal fee = totalValue.multiply(feeRate).setScale(8, RoundingMode.HALF_UP);

        if ("BUY".equals(orderType)) {
            Asset krwAsset = assetRepository.findWithLockByMember_MemberIdAndAssetType(member.getMemberId(), "KRW")
                    .orElseThrow(() -> new RuntimeException("KRW 잔고가 없습니다."));

            BigDecimal required = totalValue.add(fee);
            BigDecimal available = krwAsset.getBalance().subtract(krwAsset.getLockedBalance());
            if (available.compareTo(required) < 0) {
                throw new RuntimeException("KRW 잔고가 부족합니다. 필요: " + required + ", 가용: " + available);
            }

            // 즉시 체결: KRW 차감, 코인 추가
            krwAsset.setBalance(krwAsset.getBalance().subtract(required));
            assetRepository.save(krwAsset);

            Asset coinAsset = assetService.findOrCreateAsset(member, assetType);
            coinAsset.setBalance(coinAsset.getBalance().add(amount));
            assetRepository.save(coinAsset);

        } else if ("SELL".equals(orderType)) {
            Asset coinAsset = assetRepository.findWithLockByMember_MemberIdAndAssetType(member.getMemberId(), assetType)
                    .orElseThrow(() -> new RuntimeException(assetType + " 잔고가 없습니다."));

            BigDecimal available = coinAsset.getBalance().subtract(coinAsset.getLockedBalance());
            if (available.compareTo(amount) < 0) {
                throw new RuntimeException(assetType + " 잔고가 부족합니다.");
            }

            // 즉시 체결: 코인 차감, KRW 추가
            coinAsset.setBalance(coinAsset.getBalance().subtract(amount));
            assetRepository.save(coinAsset);

            Asset krwAsset = assetService.findOrCreateAsset(member, "KRW");
            BigDecimal krwReceived = totalValue.subtract(fee);
            krwAsset.setBalance(krwAsset.getBalance().add(krwReceived));
            assetRepository.save(krwAsset);
        } else {
            throw new RuntimeException("주문 유형은 BUY 또는 SELL이어야 합니다.");
        }

        // 주문 기록 (즉시 체결)
        Order order = Order.builder()
                .member(member)
                .orderType(orderType)
                .priceType(req.getPriceType() != null ? req.getPriceType().toUpperCase() : "LIMIT")
                .assetType(assetType)
                .price(price)
                .amount(amount)
                .filledAmount(amount)
                .status("FILLED")
                .build();
        orderRepository.save(order);

        // 거래 기록
        Transaction tx = Transaction.builder()
                .member(member)
                .order(order)
                .txType(orderType)
                .assetType(assetType)
                .amount(amount)
                .price(price)
                .totalValue(totalValue)
                .fee(fee)
                .build();
        transactionRepository.save(tx);

        return toDto(order);
    }

    @Transactional
    public OrderResponseDto cancelOrder(String email, Long orderId) {
        Member member = memberRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("회원을 찾을 수 없습니다."));

        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new RuntimeException("주문을 찾을 수 없습니다."));

        if (!order.getMember().getMemberId().equals(member.getMemberId())) {
            throw new RuntimeException("본인의 주문만 취소할 수 있습니다.");
        }

        if (!"PENDING".equals(order.getStatus()) && !"PARTIAL".equals(order.getStatus())) {
            throw new RuntimeException("대기 중인 주문만 취소할 수 있습니다.");
        }

        BigDecimal remainingAmount = order.getAmount().subtract(order.getFilledAmount());
        BigDecimal totalValue = order.getPrice().multiply(remainingAmount);
        BigDecimal feeRate = getMemberFeeRate(member);
        BigDecimal fee = totalValue.multiply(feeRate).setScale(8, RoundingMode.HALF_UP);

        // 잠금 해제
        if ("BUY".equals(order.getOrderType())) {
            Asset krwAsset = assetRepository.findWithLockByMember_MemberIdAndAssetType(member.getMemberId(), "KRW")
                    .orElseThrow(() -> new RuntimeException("KRW 자산을 찾을 수 없습니다."));
            krwAsset.setLockedBalance(krwAsset.getLockedBalance().subtract(totalValue.add(fee)));
            assetRepository.save(krwAsset);
        } else {
            Asset coinAsset = assetRepository.findWithLockByMember_MemberIdAndAssetType(member.getMemberId(), order.getAssetType())
                    .orElseThrow(() -> new RuntimeException("자산을 찾을 수 없습니다."));
            coinAsset.setLockedBalance(coinAsset.getLockedBalance().subtract(remainingAmount));
            assetRepository.save(coinAsset);
        }

        order.setStatus("CANCELLED");
        orderRepository.save(order);

        return toDto(order);
    }

    @Transactional(readOnly = true)
    public List<OrderResponseDto> getOrders(String email) {
        Member member = memberRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("회원을 찾을 수 없습니다."));
        return orderRepository.findByMember_MemberIdOrderByCreatedAtDesc(member.getMemberId())
                .stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<OrderResponseDto> getOpenOrders(String email) {
        Member member = memberRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("회원을 찾을 수 없습니다."));
        return orderRepository.findByMember_MemberIdAndStatusOrderByCreatedAtDesc(member.getMemberId(), "PENDING")
                .stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    private BigDecimal getMemberFeeRate(Member member) {
        if (member.getFeeTier() != null) {
            return member.getFeeTier().getFeeRate();
        }
        return feeTierRepository.findById(1L)
                .map(FeeTier::getFeeRate)
                .orElse(new BigDecimal("0.0020"));
    }

    private OrderResponseDto toDto(Order order) {
        return OrderResponseDto.builder()
                .orderId(order.getOrderId())
                .orderType(order.getOrderType())
                .priceType(order.getPriceType())
                .assetType(order.getAssetType())
                .price(order.getPrice())
                .amount(order.getAmount())
                .filledAmount(order.getFilledAmount())
                .status(order.getStatus())
                .createdAt(order.getCreatedAt())
                .build();
    }
}
