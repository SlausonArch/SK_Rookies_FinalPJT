package com.rookies.sk.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Random;

@Slf4j
@RestController
@RequestMapping("/api/events")
@RequiredArgsConstructor
public class EventController {

    private static final String[] WEIRD_COINS = {
            "SHIB", "DOGE", "PEPE", "FLOKI", "BOME", "WIF", "BONK", "MEME", "LADYS", "RATS"
    };
    private static final Random RANDOM = new Random();

    /**
     * V-EVENT-01: 출석 체크 이벤트
     * 취약점: 날짜/중복 검증 없이 호출할 때마다 코인 지급
     * 공격자는 반복 호출로 무제한 코인 획득 가능
     */
    @PostMapping("/attendance")
    public ResponseEntity<?> checkAttendance(
            @AuthenticationPrincipal UserDetails userDetails) {
        String email = userDetails != null ? userDetails.getUsername() : "anonymous";
        String coin = WEIRD_COINS[RANDOM.nextInt(WEIRD_COINS.length)];
        int amount = (RANDOM.nextInt(100) + 1) * 1000;

        log.info("출석 체크 처리: email={}, coin={}, amount={}", email, coin, amount);

        // V-EVENT-01: 중복 출석 체크 방지 로직 없음 - 매번 지급
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
    public ResponseEntity<?> completeAdMission(
            @AuthenticationPrincipal UserDetails userDetails) {
        String email = userDetails != null ? userDetails.getUsername() : "anonymous";
        log.info("광고 미션 완료 처리: email={}", email);

        // V-EVENT-02: 실제 광고 시청 여부 검증 없음
        return ResponseEntity.ok(Map.of(
                "success", true,
                "reward", 500,
                "message", "광고 시청 미션 완료! 500 포인트가 지급되었습니다."
        ));
    }
}
