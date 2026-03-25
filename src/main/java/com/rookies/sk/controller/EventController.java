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
import java.time.LocalDate;
import java.time.LocalDateTime;
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

    private static final String TX_ATTENDANCE = "ATTENDANCE_REWARD";
    private static final String TX_AD_MISSION = "AD_MISSION_REWARD";
    private static final int AD_MISSION_DAILY_LIMIT = 3;

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

    private LocalDateTime startOfToday() {
        return LocalDate.now().atStartOfDay();
    }

    private LocalDateTime startOfTomorrow() {
        return LocalDate.now().plusDays(1).atStartOfDay();
    }

    /** 오늘의 이벤트 참여 현황 조회 */
    @GetMapping("/status")
    public ResponseEntity<?> getEventStatus(@AuthenticationPrincipal UserDetails userDetails) {
        if (userDetails == null) {
            return ResponseEntity.status(401).body(Map.of("error", "로그인이 필요합니다."));
        }
        Member member = memberRepository.findByEmail(userDetails.getUsername()).orElse(null);
        if (member == null) {
            return ResponseEntity.status(404).body(Map.of("error", "사용자를 찾을 수 없습니다."));
        }

        long attendanceCount = transactionRepository.countByMember_MemberIdAndTxTypeAndTxDateBetween(
                member.getMemberId(), TX_ATTENDANCE, startOfToday(), startOfTomorrow());
        long adMissionCount = transactionRepository.countByMember_MemberIdAndTxTypeAndTxDateBetween(
                member.getMemberId(), TX_AD_MISSION, startOfToday(), startOfTomorrow());

        return ResponseEntity.ok(Map.of(
                "attendanceDone", attendanceCount > 0,
                "adMissionCount", (int) Math.min(adMissionCount, AD_MISSION_DAILY_LIMIT)
        ));
    }

    /** 출석 체크 — 하루 1회 제한 */
    @PostMapping("/attendance")
    @Transactional
    public ResponseEntity<?> checkAttendance(@AuthenticationPrincipal UserDetails userDetails) {
        if (userDetails == null) {
            return ResponseEntity.status(401).body(Map.of("error", "로그인이 필요합니다."));
        }
        Member member = memberRepository.findByEmail(userDetails.getUsername()).orElse(null);
        if (member == null) {
            return ResponseEntity.status(404).body(Map.of("error", "사용자를 찾을 수 없습니다."));
        }

        long todayCount = transactionRepository.countByMember_MemberIdAndTxTypeAndTxDateBetween(
                member.getMemberId(), TX_ATTENDANCE, startOfToday(), startOfTomorrow());
        if (todayCount > 0) {
            return ResponseEntity.status(409).body(Map.of("message", "오늘은 이미 출석 체크를 완료했습니다."));
        }

        String coin = pickRandomCoin();
        int amount = (RANDOM.nextInt(100) + 1) * 1000;

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
                .txType(TX_ATTENDANCE)
                .assetType(coin)
                .amount(BigDecimal.valueOf(amount))
                .price(BigDecimal.ZERO)
                .totalValue(BigDecimal.ZERO)
                .fee(BigDecimal.ZERO)
                .status("COMPLETED")
                .build());

        log.info("출석 체크 완료: email={}, coin={}, amount={}", member.getEmail(), coin, amount);

        return ResponseEntity.ok(Map.of(
                "success", true,
                "coin", coin,
                "amount", amount,
                "message", "출석 체크 완료! " + coin + " " + amount + "개가 지급되었습니다."
        ));
    }

    /** 광고 보기 미션 — 하루 3회 제한 */
    @PostMapping("/ad-mission")
    @Transactional
    public ResponseEntity<?> completeAdMission(@AuthenticationPrincipal UserDetails userDetails) {
        if (userDetails == null) {
            return ResponseEntity.status(401).body(Map.of("error", "로그인이 필요합니다."));
        }
        Member member = memberRepository.findByEmail(userDetails.getUsername()).orElse(null);
        if (member == null) {
            return ResponseEntity.status(404).body(Map.of("error", "사용자를 찾을 수 없습니다."));
        }

        long todayCount = transactionRepository.countByMember_MemberIdAndTxTypeAndTxDateBetween(
                member.getMemberId(), TX_AD_MISSION, startOfToday(), startOfTomorrow());
        if (todayCount >= AD_MISSION_DAILY_LIMIT) {
            return ResponseEntity.status(409).body(Map.of("message", "오늘 광고 보기 미션을 모두 완료했습니다. (3/3)"));
        }

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
                .txType(TX_AD_MISSION)
                .assetType("KRW")
                .amount(BigDecimal.valueOf(5000))
                .price(BigDecimal.ZERO)
                .totalValue(BigDecimal.valueOf(5000))
                .fee(BigDecimal.ZERO)
                .status("COMPLETED")
                .build());

        int newCount = (int) (todayCount + 1);
        log.info("광고 미션 완료: email={}, count={}/{}", member.getEmail(), newCount, AD_MISSION_DAILY_LIMIT);

        return ResponseEntity.ok(Map.of(
                "success", true,
                "reward", 5000,
                "adMissionCount", newCount,
                "message", "광고 시청 미션 완료! 5,000 KRW가 지급되었습니다."
        ));
    }
}
