package com.rookies.sk.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Collection;
import java.util.HashMap;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class UpbitPriceService {

    private static final String UPBIT_TICKER_URL = "https://api.upbit.com/v1/ticker?markets=";

    private final ObjectMapper objectMapper;
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(2))
            .build();

    public Map<String, BigDecimal> fetchCurrentPrices(Collection<String> assetTypes) {
        if (assetTypes == null || assetTypes.isEmpty()) {
            return Map.of();
        }

        String markets = assetTypes.stream()
                .map(this::toUpbitMarketCode)
                .filter(code -> !code.isBlank())
                .collect(Collectors.joining(","));
        if (markets.isBlank()) {
            return Map.of();
        }

        String requestUrl = UPBIT_TICKER_URL + markets;
        HttpRequest request = HttpRequest.newBuilder(URI.create(requestUrl))
                .GET()
                .timeout(Duration.ofSeconds(4))
                .header("Accept", "application/json")
                .build();

        try {
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                log.debug("Upbit ticker call failed. status={}", response.statusCode());
                return Map.of();
            }

            JsonNode root = objectMapper.readTree(response.body());
            if (!root.isArray()) {
                return Map.of();
            }

            Map<String, BigDecimal> prices = new HashMap<>();
            for (JsonNode node : root) {
                String market = node.path("market").asText("");
                if (!market.startsWith("KRW-")) {
                    continue;
                }
                BigDecimal tradePrice = node.path("trade_price").decimalValue();
                if (tradePrice == null || tradePrice.compareTo(BigDecimal.ZERO) <= 0) {
                    continue;
                }
                String assetType = market.substring("KRW-".length()).toUpperCase();
                prices.put(assetType, tradePrice);
            }
            return prices;
        } catch (Exception e) {
            log.debug("Failed to fetch upbit prices: {}", e.getMessage());
            return Map.of();
        }
    }

    private String toUpbitMarketCode(String assetType) {
        if (assetType == null || assetType.isBlank()) {
            return "";
        }
        return "KRW-" + assetType.trim().toUpperCase();
    }
}
