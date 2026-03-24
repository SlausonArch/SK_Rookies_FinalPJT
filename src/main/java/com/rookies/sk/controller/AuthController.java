package com.rookies.sk.controller;

import com.rookies.sk.dto.AdminLoginRequest;
import com.rookies.sk.dto.AdminLoginResponse;
import com.rookies.sk.dto.SignupRequestDto;
import com.rookies.sk.dto.TokenRevokeRequestDto;
import com.rookies.sk.entity.Member;
import com.rookies.sk.security.JwtTokenProvider;
import com.rookies.sk.service.FileService;
import com.rookies.sk.service.MemberService;
import com.rookies.sk.service.TokenBlacklistService;
import com.rookies.sk.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.password.PasswordEncoder;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

@Slf4j
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private static final String WITHDRAWN_ACCOUNT_MESSAGE = "WITHDRAWN_ACCOUNT";

    private final MemberService memberService;
    private final FileService fileService;
    private final JwtTokenProvider jwtTokenProvider;
    private final PasswordEncoder passwordEncoder;
    private final TransactionRepository transactionRepository;
    private final TokenBlacklistService tokenBlacklistService;

    private static final int MAX_LOGIN_FAIL = 5;
    private static final int MAX_ADMIN_LOGIN_FAIL = 3;

    private static String sha256Hex(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : hash) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 not available", e);
        }
    }

    @PostMapping("/test/login")
    public ResponseEntity<?> testLogin(@RequestBody AdminLoginRequest request) {
        log.info("Test login request received for email: {}", request.getEmail());
        try {
            Member member = memberService.findByEmailForLogin(request.getEmail());

            if (member.getStatus() == Member.Status.WITHDRAWN) {
                return ResponseEntity.status(403).body(WITHDRAWN_ACCOUNT_MESSAGE);
            }

            if (member.getStatus() == Member.Status.AUTH_FAILED) {
                return ResponseEntity.status(403).body("인증 실패로 계정이 잠겼습니다. 문의 게시판을 통해 해제 요청해 주세요.");
            }

            if (member.getPassword() == null || !passwordEncoder.matches(request.getPassword(), member.getPassword())) {
                int failCount = member.getLoginFailCount() + 1;
                member.setLoginFailCount(failCount);
                if (failCount >= MAX_LOGIN_FAIL) {
                    member.setStatus(Member.Status.AUTH_FAILED);
                    memberService.saveMember(member);
                    return ResponseEntity.status(403).body("인증 실패 횟수(" + MAX_LOGIN_FAIL + "회)를 초과하여 계정이 잠겼습니다.");
                }
                memberService.saveMember(member);
                return ResponseEntity.status(401).body("이메일 또는 비밀번호가 올바르지 않습니다. (실패 " + failCount + "/" + MAX_LOGIN_FAIL + ")");
            }

            if (member.getRole() == Member.Role.GUEST) {
                return ResponseEntity.status(403).body("회원가입이 완료되지 않은 계정입니다.");
            }

            member.setLoginFailCount(0);
            memberService.saveMember(member);

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
        log.info("Admin login request received for email: {}", request.getEmail());
        try {
            Member member = memberService.findByEmailForLogin(request.getEmail());

            if (member.getStatus() == Member.Status.WITHDRAWN) {
                return ResponseEntity.status(403).body(WITHDRAWN_ACCOUNT_MESSAGE);
            }

            if (member.getStatus() == Member.Status.AUTH_FAILED) {
                return ResponseEntity.status(403).body("인증 실패로 계정이 잠겼습니다.");
            }

            boolean passwordMatch = member.getPassword() != null &&
                    sha256Hex(request.getPassword()).equals(member.getPassword());
            if (!passwordMatch) {
                int failCount = member.getLoginFailCount() + 1;
                member.setLoginFailCount(failCount);
                if (failCount >= MAX_ADMIN_LOGIN_FAIL) {
                    member.setStatus(Member.Status.AUTH_FAILED);
                    memberService.saveMember(member);
                    return ResponseEntity.status(403).body("인증 실패 횟수(" + MAX_ADMIN_LOGIN_FAIL + "회)를 초과하여 계정이 잠겼습니다.");
                }
                memberService.saveMember(member);
                return ResponseEntity.status(401).body("Invalid credentials (" + failCount + "/" + MAX_ADMIN_LOGIN_FAIL + ")");
            }

            // 관리자 권한 확인 (VCESYS_CORE, VCESYS_MGMT, VCESYS_EMP 허용)
            if (member.getRole() != Member.Role.VCESYS_CORE &&
                    member.getRole() != Member.Role.VCESYS_MGMT &&
                    member.getRole() != Member.Role.VCESYS_EMP) {
                return ResponseEntity.status(403).body("Access denied");
            }

            member.setLoginFailCount(0);
            memberService.saveMember(member);

            String accessToken = jwtTokenProvider.createAccessToken(
                    member.getEmail(),
                    member.getRole().name(),
                    member.getMemberId(),
                    member.getName());

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
            result.put("hasIdPhoto", member.getIdPhotoUrl() != null && !member.getIdPhotoUrl().isBlank());
            result.put("idPhotoUrl", member.getIdPhotoUrl() != null ? member.getIdPhotoUrl() : "");
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

    @PostMapping("/me/id-photo")
    public ResponseEntity<?> submitIdPhoto(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestPart("file") MultipartFile file) {
        try {
            String filePath = fileService.storeFile(file);
            Member member = memberService.submitIdPhotoByEmail(userDetails.getUsername(), filePath);
            return ResponseEntity.ok(java.util.Map.of(
                    "message", "신분증이 제출되었습니다. 관리자 승인 전까지 LOCKED 상태로 유지됩니다.",
                    "status", member.getStatus().name(),
                    "idPhotoUrl", member.getIdPhotoUrl() != null ? member.getIdPhotoUrl() : ""));
        } catch (Exception e) {
            return ResponseEntity.status(400).body(java.util.Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/signup/complete")
    public ResponseEntity<?> completeSignup(
            @Valid @RequestPart("data") SignupRequestDto dto,
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

    @PostMapping("/refresh")
    public ResponseEntity<?> refreshToken(@RequestBody(required = false) java.util.Map<String, String> body) {
        String refreshToken = body != null ? body.get("refreshToken") : null;
        if (refreshToken == null || refreshToken.isBlank()) {
            return ResponseEntity.status(400).body("refreshToken이 필요합니다.");
        }
        if (!jwtTokenProvider.validateToken(refreshToken)) {
            return ResponseEntity.status(401).body("유효하지 않은 refresh token입니다.");
        }
        if (!"REFRESH".equals(jwtTokenProvider.getTokenType(refreshToken))) {
            return ResponseEntity.status(401).body("refresh token이 아닙니다.");
        }
        // 이미 사용된(블랙리스트) refresh token 차단
        if (tokenBlacklistService.isRevoked(refreshToken)) {
            return ResponseEntity.status(401).body("이미 사용된 refresh token입니다.");
        }
        try {
            String email = jwtTokenProvider.getEmail(refreshToken);
            Member member = memberService.findByEmailForLogin(email);

            // 기존 refresh token 즉시 무효화 (재사용 방지)
            tokenBlacklistService.revokeTokens(null, refreshToken, "REFRESH_ROTATION");

            String newAccessToken = jwtTokenProvider.createAccessToken(
                    email, member.getRole().name(), member.getMemberId());
            String newRefreshToken = jwtTokenProvider.createRefreshToken(email);

            return ResponseEntity.ok(java.util.Map.of(
                    "accessToken", newAccessToken,
                    "refreshToken", newRefreshToken));
        } catch (Exception e) {
            return ResponseEntity.status(401).body("토큰 갱신에 실패했습니다.");
        }
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
            @RequestBody(required = false) TokenRevokeRequestDto request) {
        tokenBlacklistService.revokeTokens(
                resolveBearerToken(authorizationHeader),
                request != null ? request.getRefreshToken() : null,
                "LOGOUT");
        return ResponseEntity.ok(java.util.Map.of("message", "로그아웃이 완료되었습니다."));
    }

    @PostMapping("/withdraw")
    public ResponseEntity<?> withdrawAccount(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
            @RequestBody(required = false) TokenRevokeRequestDto request) {
        try {
            Member member = memberService.findByEmailForLogin(userDetails.getUsername());
            memberService.withdrawMember(member);
            tokenBlacklistService.revokeTokens(
                    resolveBearerToken(authorizationHeader),
                    request != null ? request.getRefreshToken() : null,
                    "WITHDRAW");
            return ResponseEntity.ok(java.util.Map.of("message", "회원 탈퇴가 완료되었습니다."));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(java.util.Map.of("message", "회원 탈퇴 실패: " + e.getMessage()));
        }
    }

    private String resolveBearerToken(String authorizationHeader) {
        if (authorizationHeader == null || !authorizationHeader.startsWith("Bearer ")) {
            return null;
        }
        return authorizationHeader.substring(7);
    }
}
