package com.rookies.sk.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

@Slf4j
@Service
public class UpbitQuotationService {

    private static final String UPBIT_API = "https://api.upbit.com/v1";

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(2))
            .build();

    public String fetchMarkets() {
        return sendGet(UPBIT_API + "/market/all");
    }

    public String fetchTickers(String markets) {
        if (markets == null || markets.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "markets query is required");
        }
        String encoded = URLEncoder.encode(markets, StandardCharsets.UTF_8);
        return sendGet(UPBIT_API + "/ticker?markets=" + encoded);
    }

    public String fetchMinuteCandles(String market, int unit, int count) {
        validateMarket(market);
        validateCount(count);
        if (unit <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "unit must be positive");
        }
        String encodedMarket = URLEncoder.encode(market, StandardCharsets.UTF_8);
        return sendGet(UPBIT_API + "/candles/minutes/" + unit + "?market=" + encodedMarket + "&count=" + count);
    }

    public String fetchDayCandles(String market, int count) {
        validateMarket(market);
        validateCount(count);
        String encodedMarket = URLEncoder.encode(market, StandardCharsets.UTF_8);
        return sendGet(UPBIT_API + "/candles/days?market=" + encodedMarket + "&count=" + count);
    }

    public String fetchOrderbook(String markets) {
        if (markets == null || markets.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "markets query is required");
        }
        String encoded = URLEncoder.encode(markets, StandardCharsets.UTF_8);
        return sendGet(UPBIT_API + "/orderbook?markets=" + encoded);
    }

    public String fetchTradeTicks(String market, int count) {
        validateMarket(market);
        validateCount(count);
        String encodedMarket = URLEncoder.encode(market, StandardCharsets.UTF_8);
        return sendGet(UPBIT_API + "/trades/ticks?market=" + encodedMarket + "&count=" + count);
    }

    private void validateMarket(String market) {
        if (market == null || market.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "market query is required");
        }
    }

    private void validateCount(int count) {
        if (count <= 0 || count > 500) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "count must be between 1 and 500");
        }
    }

    private String sendGet(String url) {
        HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                .GET()
                .timeout(Duration.ofSeconds(5))
                .header("Accept", "application/json")
                .build();

        try {
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() >= 200 && response.statusCode() < 300) {
                return response.body();
            }
            if (response.statusCode() == 429) {
                log.warn("Upbit quotation rate limited. url={}", url);
                throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Upbit rate limit exceeded");
            }
            log.warn("Upbit quotation call failed. status={}, url={}", response.statusCode(), url);
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Failed to fetch quotation data");
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            log.warn("Upbit quotation call error. url={}, message={}", url, e.getMessage());
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Failed to fetch quotation data");
        }
    }
}
