package com.rookies.sk.scheduler;

import com.rookies.sk.entity.Order;
import com.rookies.sk.repository.OrderRepository;
import com.rookies.sk.service.OrderService;
import com.rookies.sk.service.UpbitPriceService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Slf4j
@Component
@RequiredArgsConstructor
public class ExternalLimitOrderMatchScheduler {

    private static final List<String> OPEN_STATUSES = List.of("PENDING", "PARTIAL");

    private final OrderRepository orderRepository;
    private final OrderService orderService;
    private final UpbitPriceService upbitPriceService;

    @Scheduled(
            fixedDelayString = "${order.external-match.fixed-delay-ms:2000}",
            initialDelayString = "${order.external-match.initial-delay-ms:5000}"
    )
    public void matchOpenOrdersByExternalPrice() {
        List<Order> openLimitOrders = orderRepository.findByPriceTypeAndStatusInOrderByCreatedAtAsc("LIMIT", OPEN_STATUSES);
        if (openLimitOrders.isEmpty()) {
            return;
        }

        Set<String> assetTypes = openLimitOrders.stream()
                .map(Order::getAssetType)
                .filter(this::isTradableAsset)
                .map(String::toUpperCase)
                .collect(Collectors.toSet());
        if (assetTypes.isEmpty()) {
            return;
        }

        Map<String, BigDecimal> priceMap = upbitPriceService.fetchCurrentPrices(assetTypes);
        if (priceMap.isEmpty()) {
            return;
        }

        for (Order order : openLimitOrders) {
            String assetType = order.getAssetType() == null ? "" : order.getAssetType().trim().toUpperCase();
            if (assetType.isBlank()) {
                continue;
            }
            BigDecimal marketPrice = priceMap.get(assetType);
            if (marketPrice == null) {
                continue;
            }

            try {
                orderService.tryExecuteExternalLimitFill(order.getOrderId(), marketPrice);
            } catch (Exception e) {
                log.debug("External limit fill failed. orderId={}, reason={}", order.getOrderId(), e.getMessage());
            }
        }
    }

    private boolean isTradableAsset(String assetType) {
        if (assetType == null || assetType.isBlank()) {
            return false;
        }
        return !"KRW".equalsIgnoreCase(assetType.trim());
    }
}
