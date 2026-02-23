package com.rookies.sk.controller;

import com.rookies.sk.dto.AdminLoginRequest;
import com.rookies.sk.dto.AdminLoginResponse;
import com.rookies.sk.dto.SignupRequestDto;
import com.rookies.sk.entity.Member;
import com.rookies.sk.security.JwtTokenProvider;
import com.rookies.sk.service.FileService;
import com.rookies.sk.service.MemberService;
import com.rookies.sk.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.math.BigDecimal;

@Slf4j
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private static final String LOCKED_ACCOUNT_MESSAGE = "LOCKED_ACCOUNT";

    private final MemberService memberService;
    private final FileService fileService;
    private final JwtTokenProvider jwtTokenProvider;
    private final PasswordEncoder passwordEncoder;
    private final TransactionRepository transactionRepository;

    @PostMapping("/test/login")
    public ResponseEntity<?> testLogin(@RequestBody AdminLoginRequest request) {
        try {
            Member member = memberService.findByEmailForLogin(request.getEmail());

            if (member.getPassword() == null || !passwordEncoder.matches(request.getPassword(), member.getPassword())) {
                return ResponseEntity.status(401).body("이메일 또는 비밀번호가 올바르지 않습니다.");
            }

            if (member.getStatus() == Member.Status.LOCKED) {
                return ResponseEntity.status(403).body(LOCKED_ACCOUNT_MESSAGE);
            }

            if (member.getRole() == Member.Role.GUEST) {
                return ResponseEntity.status(403).body("회원가입이 완료되지 않은 계정입니다.");
            }

            String accessToken = jwtTokenProvider.createAccessToken(
                    member.getEmail(), member.getRole().name(), member.getMemberId());
            String refreshToken = jwtTokenProvider.createRefreshToken(member.getEmail());

            return ResponseEntity.ok(java.util.Map.of(
                    "accessToken", accessToken,
                    "refreshToken", refreshToken,
                    "role", member.getRole().name(),
                    "email", member.getEmail(),
                    "name", member.getName()));
        } catch (Exception e) {
            log.error("Test login failed", e);
            return ResponseEntity.status(401).body("로그인 실패");
        }
    }

    @PostMapping("/admin/login")
    public ResponseEntity<?> adminLogin(@RequestBody AdminLoginRequest request) {
        try {
            // 이메일로 회원 조회
            Member member = memberService.findByEmailForLogin(request.getEmail());

            // 비밀번호 검증
            if (member.getPassword() == null || !passwordEncoder.matches(request.getPassword(), member.getPassword())) {
                return ResponseEntity.status(401).body("Invalid credentials");
            }

            if (member.getStatus() == Member.Status.LOCKED) {
                return ResponseEntity.status(403).body(LOCKED_ACCOUNT_MESSAGE);
            }

            // 관리자 권한 확인
            if (member.getRole() != Member.Role.ADMIN) {
                return ResponseEntity.status(403).body("Access denied");
            }

            // JWT 토큰 생성
            String accessToken = jwtTokenProvider.createAccessToken(
                    member.getEmail(),
                    member.getRole().name(),
                    member.getMemberId());

            // 응답 생성
            AdminLoginResponse response = new AdminLoginResponse(
                    accessToken,
                    member.getRole().name(),
                    member.getEmail(),
                    member.getName());

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Admin login failed", e);
            return ResponseEntity.status(401).body("Login failed");
        }
    }

    @GetMapping("/me")
    public ResponseEntity<?> getMyInfo(@AuthenticationPrincipal UserDetails userDetails) {
        try {
            Member member = memberService.findByEmailForLogin(userDetails.getUsername());

            if (member.getReferralCode() == null || member.getReferralCode().isEmpty()) {
                memberService.assignReferralCode(member);
            }

            BigDecimal totalVolume = transactionRepository.sumTotalVolumeByMemberId(member.getMemberId());
            if (totalVolume == null) {
                totalVolume = BigDecimal.ZERO;
            }

            BigDecimal nextTierVolume;
            if (totalVolume.compareTo(new BigDecimal("100000000")) < 0) {
                nextTierVolume = new BigDecimal("100000000"); // 1억 (Silver)
            } else if (totalVolume.compareTo(new BigDecimal("2000000000")) < 0) {
                nextTierVolume = new BigDecimal("2000000000"); // 20억 (Gold)
            } else if (totalVolume.compareTo(new BigDecimal("20000000000")) < 0) {
                nextTierVolume = new BigDecimal("20000000000"); // 200억 (VIP)
            } else {
                nextTierVolume = new BigDecimal("20000000000"); // VIP MAX
            }

            java.util.Map<String, Object> result = new java.util.LinkedHashMap<>();
            result.put("memberId", member.getMemberId());
            result.put("email", member.getEmail());
            result.put("name", member.getName());
            result.put("phoneNumber", member.getPhoneNumber() != null ? member.getPhoneNumber() : "");
            result.put("address", member.getAddress() != null ? member.getAddress() : "");
            result.put("bankName", member.getBankName() != null ? member.getBankName() : "");
            result.put("accountNumber", member.getAccountNumber() != null ? member.getAccountNumber() : "");
            result.put("accountHolder", member.getAccountHolder() != null ? member.getAccountHolder() : "");
            result.put("role", member.getRole().name());
            result.put("status", member.getStatus().name());
            result.put("createdAt", member.getCreatedAt() != null ? member.getCreatedAt().toString() : "");
            result.put("totalVolume", totalVolume.toString());
            result.put("nextTierVolume", nextTierVolume.toString());
            result.put("referralCode", member.getReferralCode());
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.status(404).body("회원 정보를 찾을 수 없습니다.");
        }
    }

    @PutMapping("/me")
    public ResponseEntity<?> updateMyInfo(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody java.util.Map<String, String> body) {
        try {
            Member member = memberService.findByEmailForLogin(userDetails.getUsername());
            if (body.containsKey("name"))
                member.setName(body.get("name"));
            if (body.containsKey("phoneNumber"))
                member.setPhoneNumber(body.get("phoneNumber"));
            if (body.containsKey("address"))
                member.setAddress(body.get("address"));
            if (body.containsKey("bankName"))
                member.setBankName(body.get("bankName"));
            if (body.containsKey("accountNumber"))
                member.setAccountNumber(body.get("accountNumber"));
            if (body.containsKey("accountHolder"))
                member.setAccountHolder(body.get("accountHolder"));
            memberService.saveMember(member);
            return ResponseEntity.ok(java.util.Map.of("message", "회원 정보가 수정되었습니다."));
        } catch (Exception e) {
            return ResponseEntity.status(400).body("회원 정보 수정에 실패했습니다.");
        }
    }

    @PostMapping("/signup/complete")
    public ResponseEntity<?> completeSignup(
            @RequestPart("data") SignupRequestDto dto,
            @RequestPart("file") MultipartFile file,
            @AuthenticationPrincipal UserDetails userDetails) {

        // Extract email, find member (Ideally passed via UserDetails or Token)
        String email = userDetails.getUsername();
        // We need Member ID. In real app, UserDetails might have it, or we fetch by
        // email.
        // Let's assuming fetching by email for now, though slightly inefficient.
        // Better: CustomUserDetails

        // For V-01 demonstration, we might strictly rely on the ID passed in param?
        // But for signup, we must rely on the authenticated GUEST token.

        // Let's fetch member ID from token claims if possible, or query by email.
        // JwtTokenProvider puts memberId in claims.
        // But UserDetails is standard.
        // Let's just find by email since email is unique.

        // Wait, creating memberService.findByEmail methods is needed.
        // Or assume ID is available.

        // Let's add findByEmail to MemberService or Repository usage.
        // To avoid circular dependency or extra complexity, let's keep it simple.

        // Simulating ID lookup
        // Ideally we shouldn't trust client provided ID for signup completion of OWN
        // account.

        String filePath = fileService.storeFile(file);

        // We need to look up the member based on the CURRENTLY LOGGED IN user (GUEST)
        // memberRepository is not injected here.
        // Let's refactor MemberService to handle email lookup or pass ID if we extract
        // it.

        // Refactoring plan: call memberService.completeSignupByEmail

        Member updatedMember = memberService.completeSignupByEmail(email, dto, filePath);

        // Issue new tokens
        String newAccessToken = jwtTokenProvider.createAccessToken(updatedMember.getEmail(),
                updatedMember.getRole().name(), updatedMember.getMemberId());

        return ResponseEntity.ok(newAccessToken);
    }

    @PostMapping("/withdraw")
    public ResponseEntity<?> withdrawAccount(@AuthenticationPrincipal UserDetails userDetails) {
        try {
            Member member = memberService.findByEmailForLogin(userDetails.getUsername());
            memberService.withdrawMember(member);
            return ResponseEntity.ok(java.util.Map.of("message", "회원 탈퇴가 완료되었습니다."));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(java.util.Map.of("message", "회원 탈퇴 실패: " + e.getMessage()));
        }
    }
}
