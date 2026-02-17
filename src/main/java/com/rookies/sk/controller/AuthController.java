package com.rookies.sk.controller;

import com.rookies.sk.dto.AdminLoginRequest;
import com.rookies.sk.dto.AdminLoginResponse;
import com.rookies.sk.dto.SignupRequestDto;
import com.rookies.sk.entity.Member;
import com.rookies.sk.security.JwtTokenProvider;
import com.rookies.sk.service.FileService;
import com.rookies.sk.service.MemberService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@Slf4j
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final MemberService memberService;
    private final FileService fileService;
    private final JwtTokenProvider jwtTokenProvider;
    private final PasswordEncoder passwordEncoder;

    @PostMapping("/admin/login")
    public ResponseEntity<?> adminLogin(@RequestBody AdminLoginRequest request) {
        try {
            // 이메일로 회원 조회
            Member member = memberService.findByEmailForLogin(request.getEmail());

            // 비밀번호 검증
            if (member.getPassword() == null || !passwordEncoder.matches(request.getPassword(), member.getPassword())) {
                return ResponseEntity.status(401).body("Invalid credentials");
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
}
