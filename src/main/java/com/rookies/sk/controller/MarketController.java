package com.rookies.sk.controller;

import com.rookies.sk.service.UpbitQuotationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/market")
@RequiredArgsConstructor
public class MarketController {

    private final UpbitQuotationService upbitQuotationService;

    @GetMapping(value = "/all", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> getMarkets() {
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_JSON)
                .body(upbitQuotationService.fetchMarkets());
    }

    @GetMapping(value = "/ticker", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> getTickers(@RequestParam String markets) {
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_JSON)
                .body(upbitQuotationService.fetchTickers(markets));
    }

    @GetMapping(value = "/candles/minutes/{unit}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> getMinuteCandles(
            @PathVariable int unit,
            @RequestParam String market,
            @RequestParam(defaultValue = "200") int count
    ) {
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_JSON)
                .body(upbitQuotationService.fetchMinuteCandles(market, unit, count));
    }

    @GetMapping(value = "/candles/days", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> getDayCandles(
            @RequestParam String market,
            @RequestParam(defaultValue = "200") int count
    ) {
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_JSON)
                .body(upbitQuotationService.fetchDayCandles(market, count));
    }

    @GetMapping(value = "/orderbook", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> getOrderbook(@RequestParam String markets) {
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_JSON)
                .body(upbitQuotationService.fetchOrderbook(markets));
    }

    @GetMapping(value = "/trades/ticks", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> getTradeTicks(
            @RequestParam String market,
            @RequestParam(defaultValue = "50") int count
    ) {
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_JSON)
                .body(upbitQuotationService.fetchTradeTicks(market, count));
    }
}
