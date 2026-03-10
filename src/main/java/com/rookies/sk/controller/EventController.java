package com.rookies.sk.controller;

import com.rookies.sk.entity.Asset;
import com.rookies.sk.entity.Member;
import com.rookies.sk.entity.Transaction;
import com.rookies.sk.repository.AssetRepository;
import com.rookies.sk.repository.MemberRepository;
import com.rookies.sk.repository.TransactionRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Random;

@Slf4j
@RestController
@RequestMapping("/api/events")
@RequiredArgsConstructor
public class EventController {

    private final MemberRepository memberRepository;
    private final AssetRepository assetRepository;
    private final TransactionRepository transactionRepository;

    // Upbit KRW 마켓에서 유효한 코인 목록 (시작 시 로드)
    private static final String[] FALLBACK_COINS = {
            "BTC", "ETH", "XRP", "SOL", "ADA", "DOT", "AVAX", "LINK", "ATOM", "DOGE"
    };
    private List<String> validCoins = new ArrayList<>(List.of(FALLBACK_COINS));
    private static final Random RANDOM = new Random();

    @PostConstruct
    public void loadValidCoins() {
        try {
            RestTemplate restTemplate = new RestTemplate();
            List<?> markets = restTemplate.getForObject(
                    "https://api.upbit.com/v1/market/all?is_details=false", List.class);
            if (markets != null) {
                List<String> coins = new ArrayList<>();
                for (Object item : markets) {
                    if (item instanceof Map<?, ?> m) {
                        String market = (String) m.get("market");
                        if (market != null && market.startsWith("KRW-")) {
                            coins.add(market.replace("KRW-", ""));
                        }
                    }
                }
                if (!coins.isEmpty()) {
                    validCoins = coins;
                    log.info("업비트 KRW 마켓 {}개 코인 로드 완료", coins.size());
                }
            }
        } catch (Exception e) {
            log.warn("업비트 마켓 목록 로드 실패, 기본 목록 사용: {}", e.getMessage());
        }
    }

    private String pickRandomCoin() {
        return validCoins.get(RANDOM.nextInt(validCoins.size()));
    }

    /**
     * V-EVENT-01: 출석 체크 이벤트
     * 취약점: 날짜/중복 검증 없이 호출할 때마다 코인 지급
     * 공격자는 반복 호출로 무제한 코인 획득 가능
     */
    @PostMapping("/attendance")
    @Transactional
    public ResponseEntity<?> checkAttendance(
            @AuthenticationPrincipal UserDetails userDetails) {
        if (userDetails == null) {
            return ResponseEntity.status(401).body(Map.of("error", "로그인이 필요합니다."));
        }

        String email = userDetails.getUsername();
        Member member = memberRepository.findByEmail(email).orElse(null);
        if (member == null) {
            return ResponseEntity.status(404).body(Map.of("error", "사용자를 찾을 수 없습니다."));
        }

        String coin = pickRandomCoin();
        int amount = (RANDOM.nextInt(100) + 1) * 1000;

        log.info("출석 체크 처리: email={}, coin={}, amount={}", email, coin, amount);

        // V-EVENT-01: 중복 출석 체크 방지 로직 없음 - 매번 지급
        Asset asset = assetRepository.findByMember_MemberIdAndAssetType(member.getMemberId(), coin)
                .orElseGet(() -> Asset.builder()
                        .member(member)
                        .assetType(coin)
                        .balance(BigDecimal.ZERO)
                        .build());
        asset.setBalance(asset.getBalance().add(BigDecimal.valueOf(amount)));
        assetRepository.save(asset);

        transactionRepository.save(Transaction.builder()
                .member(member)
                .txType("EVENT_REWARD")
                .assetType(coin)
                .amount(BigDecimal.valueOf(amount))
                .price(BigDecimal.ZERO)
                .totalValue(BigDecimal.ZERO)
                .fee(BigDecimal.ZERO)
                .status("COMPLETED")
                .build());

        return ResponseEntity.ok(Map.of(
                "success", true,
                "coin", coin,
                "amount", amount,
                "message", "출석 체크 완료! " + coin + " " + amount + "개가 지급되었습니다."
        ));
    }

    /**
     * V-EVENT-02: 광고 보기 미션
     * 취약점: 광고를 실제로 시청하지 않아도 API 호출만으로 미션 성공 처리
     * 페이지 방문 또는 API 직접 호출 시 즉시 보상 지급
     */
    @PostMapping("/ad-mission")
    @Transactional
    public ResponseEntity<?> completeAdMission(
            @AuthenticationPrincipal UserDetails userDetails) {
        if (userDetails == null) {
            return ResponseEntity.status(401).body(Map.of("error", "로그인이 필요합니다."));
        }

        String email = userDetails.getUsername();
        Member member = memberRepository.findByEmail(email).orElse(null);
        if (member == null) {
            return ResponseEntity.status(404).body(Map.of("error", "사용자를 찾을 수 없습니다."));
        }

        log.info("광고 미션 완료 처리: email={}", email);

        // V-EVENT-02: 실제 광고 시청 여부 검증 없음 - KRW 포인트로 적립
        Asset krwAsset = assetRepository.findByMember_MemberIdAndAssetType(member.getMemberId(), "KRW")
                .orElseGet(() -> Asset.builder()
                        .member(member)
                        .assetType("KRW")
                        .balance(BigDecimal.ZERO)
                        .build());
        krwAsset.setBalance(krwAsset.getBalance().add(BigDecimal.valueOf(5000)));
        assetRepository.save(krwAsset);

        transactionRepository.save(Transaction.builder()
                .member(member)
                .txType("EVENT_REWARD")
                .assetType("KRW")
                .amount(BigDecimal.valueOf(5000))
                .price(BigDecimal.ZERO)
                .totalValue(BigDecimal.valueOf(5000))
                .fee(BigDecimal.ZERO)
                .status("COMPLETED")
                .build());

        return ResponseEntity.ok(Map.of(
                "success", true,
                "reward", 5000,
                "message", "광고 시청 미션 완료! 5,000 KRW가 지급되었습니다."
        ));
    }
}
